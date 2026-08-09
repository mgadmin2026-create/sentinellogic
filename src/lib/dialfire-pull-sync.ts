// Geteilte Dialfire-Batch-Pull-Sync-Logik -- aus
// src/app/api/sync/dialfire-pull/route.ts extrahiert, damit sowohl der
// manuelle "Jetzt synchronisieren"-Button als auch der Cron-Trigger
// (/api/cron/dialfire-pull) dieselbe Implementierung nutzen.
//
// Seit Phase 3 der Sync-Architektur-Vereinheitlichung zusätzlich an
// sync_runs angebunden: ein run_kind='batch'-Eintrag für den gesamten Lauf,
// je ein run_kind='item'-Eintrag pro Kontakt darunter (parent_run_id). Das
// per-Kontakt-Audit-Log der Edge Function (dialfire_sync_log) bleibt
// unverändert (additiv, andere Zuständigkeit -- Feld-Diff statt Lauf-
// Protokoll). Seit Phase 5 ist sync_runs die alleinige Quelle für das
// Sync-Protokoll auf /sync (kein direktes sync_log-Schreiben mehr, siehe
// sync-log-adapter.ts).
import { createServerClient } from '@/lib/supabase/server'
import { recordRunStart, recordRunOutcome, runWithTracking, type ResumeRun } from '@/lib/sync-runs/retry-runner'
import { classifyError } from '@/lib/sync-runs/error-classification'

const supabase = createServerClient()

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

export interface DialfirePullContact {
  id: string
  first_name: string | null
  last_name: string | null
  dialfire_id: string
  dialfire_campaign_id: string
}

export interface DialfirePullContactResult {
  changed: boolean
  changedFields: string[]
}

/**
 * Pullt den aktuellen Dialfire-Stand für einen einzelnen Kontakt. Wirft bei
 * Netzwerk-/Timeout-Fehlern UND bei einem Business-Fehler der Edge Function
 * (data.success:false bzw. sync_status!=='success'), damit sowohl der
 * normale Lauf als auch ein späterer Retry über
 * runWithTracking()/classifyError() laufen.
 */
export async function pullDialfireContact(contact: DialfirePullContact): Promise<DialfirePullContactResult> {
  const data = await invokeEdgeFunction('dialfire-pull-sync', {
    contact_id: contact.id,
    dialfire_id: contact.dialfire_id,
    campaign_id: contact.dialfire_campaign_id,
  })

  if (data.success && data.result?.sync_status === 'success') {
    const changedFields = data.result.changed_fields ?? []
    return { changed: changedFields.length > 0, changedFields }
  }

  throw new Error(data.result?.error_message || data.error || 'Unbekannter Fehler')
}

export interface DialfirePullSyncResult {
  success: boolean
  total: number
  updated: number
  unchanged: number
  errors: number
  error_details: Array<{ lead_id: string; email: string | null; error_message: string }>
}

export async function runDialfirePullSync(triggerType: 'cron' | 'manual' = 'manual'): Promise<DialfirePullSyncResult> {
  const { data: contacts, error } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, dialfire_id, dialfire_campaign_id')
    .not('dialfire_id', 'is', null)
    .not('dialfire_campaign_id', 'is', null)
    .is('archived_at', null)

  if (error) throw new Error(error.message)

  const batchRun = await recordRunStart(supabase, {
    runKind: 'batch',
    integration: 'dialfire_pull',
    triggerType,
    data: { total: contacts?.length ?? 0 },
  })

  try {
    let updated = 0
    let unchanged = 0
    let errors = 0
    const errorDetails: Array<{ lead_id: string; email: string | null; error_message: string }> = []

    await runWithConcurrency(contacts ?? [], CONCURRENCY, async (contact) => {
      try {
        const result = await runWithTracking(
          supabase,
          {
            runKind: 'item',
            integration: 'dialfire_pull',
            triggerType,
            contactId: contact.id,
            parentRunId: batchRun?.id,
          },
          () => pullDialfireContact(contact)
        )

        if (result.changed) {
          updated++
        } else {
          unchanged++
        }
      } catch (err) {
        errors++
        errorDetails.push({
          lead_id: contact.id,
          email: null,
          error_message: err instanceof Error && err.name === 'AbortError' ? 'Zeitüberschreitung' : String(err instanceof Error ? err.message : err),
        })
      }
    })

    const total = contacts?.length ?? 0

    // sync_log wird seit Phase 5 nicht mehr direkt beschrieben -- das
    // Sync-Protokoll auf /sync liest diese Zahlen jetzt aus der
    // sync_runs-Batch-Zeile unten via src/lib/sync-runs/sync-log-adapter.ts.
    if (batchRun) {
      await recordRunOutcome(supabase, batchRun, {
        success: true,
        data: { total, updated, unchanged, errors },
      })
    }

    return {
      success: errors === 0,
      total,
      updated,
      unchanged,
      errors,
      error_details: errorDetails,
    }
  } catch (err) {
    if (batchRun) {
      const message = err instanceof Error ? err.message : String(err)
      const classification = classifyError(err)
      await recordRunOutcome(supabase, batchRun, {
        success: false,
        errorClass: classification.errorClass,
        // Batch-Zeilen werden nie erneut "retried" (das wäre der komplette
        // Lauf nochmal) -- der nächste reguläre Cron-Tick ist der faktische
        // Retry.
        retryable: false,
        errorDetail: message,
      })
    }
    throw err
  }
}

/**
 * Verarbeitet einen fälligen Retry für einen einzelnen Dialfire-Pull.
 * Genutzt von retry-handlers.ts -- Kontakt wird frisch aus der DB geladen
 * (dialfire_id/campaign_id runden über die DB, kein zusätzlicher Kontext
 * im sync_runs.data-Feld nötig).
 */
export async function retryDialfirePullContact(
  contact: DialfirePullContact,
  resumeFrom: ResumeRun
): Promise<DialfirePullContactResult> {
  return runWithTracking(
    supabase,
    { runKind: 'item', integration: 'dialfire_pull', triggerType: 'auto', contactId: contact.id },
    () => pullDialfireContact(contact),
    resumeFrom
  )
}
