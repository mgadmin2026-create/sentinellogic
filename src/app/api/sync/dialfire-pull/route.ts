// API Route: Dialfire Pull-Sync für alle verbundenen Kontakte (Batch)
// GET /api/sync/dialfire-pull — Lauf über alle verbundenen Kontakte,
// ruft pro Kontakt dieselbe Edge Function auf wie der manuelle Einzel-Sync
// (DialfireSyncPanel → /api/dialfire/pull-sync) und protokolliert einen
// gesammelten Eintrag in sync_log — analog zum Facebook-Sync-Mechanismus.
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface EdgeFunctionResult {
  success: boolean
  error?: string
  result?: {
    sync_status: 'success' | 'error' | 'conflict'
    changed_fields?: string[]
    error_message?: string
  }
}

const EDGE_FUNCTION_TIMEOUT_MS = 15_000
// Kontakte werden in Bündeln statt strikt nacheinander verarbeitet — bei
// mehreren hundert Dialfire-Kontakten würde ein rein sequenzieller Lauf die
// Laufzeitgrenze von Serverless-Functions reißen (jeder Aufruf geht bis zur
// echten Dialfire-API durch).
const CONCURRENCY = 8

async function invokeEdgeFunction(functionName: string, payload: unknown): Promise<EdgeFunctionResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), EDGE_FUNCTION_TIMEOUT_MS)

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supabaseKey}` },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Edge Function error ${res.status}: ${text}`)
    }

    return await res.json()
  } finally {
    clearTimeout(timeout)
  }
}

async function runWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let nextIndex = 0

  async function runNext(): Promise<void> {
    const current = nextIndex++
    if (current >= items.length) return
    results[current] = await worker(items[current])
    return runNext()
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runNext))
  return results
}

export async function GET() {
  try {
    const { data: contacts, error } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, dialfire_id, dialfire_campaign_id')
      .not('dialfire_id', 'is', null)
      .not('dialfire_campaign_id', 'is', null)
      .is('archived_at', null)

    if (error) throw new Error(error.message)

    let updated = 0
    let unchanged = 0
    let errors = 0
    const leadNames: string[] = []
    const errorDetails: Array<{ lead_id: string; email: string | null; error_message: string }> = []

    await runWithConcurrency(contacts ?? [], CONCURRENCY, async (contact) => {
      try {
        const data = await invokeEdgeFunction('dialfire-pull-sync', {
          contact_id: contact.id,
          dialfire_id: contact.dialfire_id,
          campaign_id: contact.dialfire_campaign_id,
        })

        if (data.success && data.result?.sync_status === 'success') {
          if ((data.result.changed_fields?.length ?? 0) > 0) {
            updated++
            leadNames.push(`${contact.first_name} ${contact.last_name}`)
          } else {
            unchanged++
          }
        } else {
          errors++
          errorDetails.push({
            lead_id: contact.id,
            email: null,
            error_message: data.result?.error_message || data.error || 'Unbekannter Fehler',
          })
        }
      } catch (err) {
        errors++
        errorDetails.push({
          lead_id: contact.id,
          email: null,
          error_message: err instanceof Error && err.name === 'AbortError' ? 'Zeitüberschreitung' : String(err),
        })
      }
    })

    const total = contacts?.length ?? 0
    const status = errors > 0 ? (updated + unchanged > 0 ? 'warning' : 'error') : 'success'

    const { error: syncLogError } = await supabase.from('sync_log').insert([
      {
        source: 'dialfire',
        count: updated,
        duplicates_skipped: 0,
        status,
        message: `${total} verbundene Kontakte geprüft — Aktualisiert: ${updated}, Unverändert: ${unchanged}, Fehler: ${errors}`,
        lead_ids: [],
        lead_names: leadNames,
        error_details: errorDetails,
        duplicate_details: [],
      },
    ])

    if (syncLogError) {
      console.error('[GET /api/sync/dialfire-pull] sync_log insert failed:', syncLogError)
    }

    return NextResponse.json({
      success: errors === 0,
      total,
      updated,
      unchanged,
      errors,
      error_details: errorDetails,
    })
  } catch (err) {
    console.error('[GET /api/sync/dialfire-pull]', err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
