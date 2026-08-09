// Adapter für das Sync-Protokoll auf /sync: seit Phase 5 der Sync-
// Architektur-Vereinheitlichung schreiben facebook-sync.ts/
// dialfire-pull-sync.ts nicht mehr direkt in sync_log -- stattdessen wird
// hier aus den bereits vorhandenen sync_runs-Batch-/Item-Zeilen exakt das
// gleiche SyncLogEntry-Format synthetisiert (gleiche message-Formatstrings,
// gleiche Status-Logik wie vorher). sync_log selbst bleibt bestehen (CSV-
// Import schreibt weiterhin dorthin) -- beide Quellen werden gemischt
// zurückgegeben, damit alte Historie nicht aus der UI verschwindet.
import { createServerClient } from '@/lib/supabase/server'

type SupabaseClient = ReturnType<typeof createServerClient>

export interface SyncLogEntry {
  id: string
  created_at: string
  source: string
  count: number
  duplicates_skipped: number
  status: string
  message: string
  lead_ids: string[]
  lead_names: string[]
  error_details: Array<{ lead_id: string; email: string | null; error_message: string }>
  duplicate_details: Array<{ facebook_id: string; email: string | null; existing_contact_id: string | null; action: string; reason: string }>
}

const BATCH_INTEGRATIONS = ['facebook', 'dialfire_pull'] as const

interface SyncRunItem {
  id: string
  parent_run_id: string | null
  contact_id: string | null
  status: string
  error_detail: string | null
  data: Record<string, unknown> | null
  contact: { first_name: string | null; last_name: string | null } | null
}

function synthesizeFacebookEntry(batch: {
  id: string
  started_at: string
  data: Record<string, unknown> | null
}, items: SyncRunItem[]): SyncLogEntry {
  const d = batch.data ?? {}
  const synced = Number(d.synced ?? 0)
  const updated = Number(d.updated ?? 0)
  const skipped = Number(d.skipped ?? 0)
  const errors = Number(d.errors ?? 0)
  const status = errors > 0 ? (synced > 0 ? 'partial' : 'error') : 'success'

  const errorDetails = items
    .filter((i) => i.status === 'failed' || i.status === 'dead_letter')
    .map((i) => {
      const lead = (i.data?.lead ?? {}) as Record<string, unknown>
      return {
        lead_id: String(lead.id ?? ''),
        email: null,
        error_message: i.error_detail ?? '',
      }
    })

  const duplicateDetails = items
    .filter((i) => i.status === 'success')
    .flatMap((i) => {
      const result = (i.data?.result ?? {}) as Record<string, unknown>
      if (result.outcome !== 'linked') return []
      const lead = (i.data?.lead ?? {}) as Record<string, unknown>
      return [{
        facebook_id: String(lead.id ?? ''),
        email: typeof result.email === 'string' ? result.email : null,
        existing_contact_id: typeof result.contactId === 'string' ? result.contactId : null,
        action: 'linked',
        reason: 'email matched existing contact',
      }]
    })

  return {
    id: `sync_runs:${batch.id}`,
    created_at: batch.started_at,
    source: 'facebook',
    count: synced + updated,
    duplicates_skipped: skipped,
    status,
    message: `Synced: ${synced}, Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`,
    lead_ids: [],
    lead_names: [],
    error_details: errorDetails,
    duplicate_details: duplicateDetails,
  }
}

function synthesizeDialfirePullEntry(batch: {
  id: string
  started_at: string
  data: Record<string, unknown> | null
}, items: SyncRunItem[]): SyncLogEntry {
  const d = batch.data ?? {}
  const total = Number(d.total ?? 0)
  const updated = Number(d.updated ?? 0)
  const unchanged = Number(d.unchanged ?? 0)
  const errors = Number(d.errors ?? 0)
  const status = errors > 0 ? (updated + unchanged > 0 ? 'warning' : 'error') : 'success'

  const errorDetails = items
    .filter((i) => i.status === 'failed' || i.status === 'dead_letter')
    .map((i) => ({
      lead_id: i.contact_id ?? '',
      email: null,
      error_message: i.error_detail ?? '',
    }))

  const leadNames = items
    .filter((i) => {
      const result = (i.data?.result ?? {}) as Record<string, unknown>
      return i.status === 'success' && result.changed === true
    })
    .map((i) => [i.contact?.first_name, i.contact?.last_name].filter(Boolean).join(' '))
    .filter(Boolean)

  return {
    id: `sync_runs:${batch.id}`,
    created_at: batch.started_at,
    source: 'dialfire',
    count: updated,
    duplicates_skipped: 0,
    status,
    message: `${total} verbundene Kontakte geprüft — Aktualisiert: ${updated}, Unverändert: ${unchanged}, Fehler: ${errors}`,
    lead_ids: [],
    lead_names: leadNames,
    error_details: errorDetails,
    duplicate_details: [],
  }
}

/**
 * Liefert das Sync-Protokoll als Mischung aus historischen sync_log-Zeilen
 * (CSV-Import, sowie alte Facebook/Dialfire-Pull-Läufe von vor dieser
 * Migration) und aus sync_runs synthetisierten Facebook-/Dialfire-Pull-
 * Batch-Zeilen (der Weg, den neue Läufe seit Phase 5 nehmen).
 */
export async function getSyncLogEntries(supabase: SupabaseClient, limit: number): Promise<SyncLogEntry[]> {
  const [{ data: legacyRows }, { data: batchRows }] = await Promise.all([
    supabase.from('sync_log').select('*').order('created_at', { ascending: false }).limit(limit),
    supabase
      .from('sync_runs')
      .select('id, integration, started_at, data')
      .eq('run_kind', 'batch')
      .in('integration', BATCH_INTEGRATIONS as unknown as string[])
      .order('started_at', { ascending: false })
      .limit(limit),
  ])

  const batches = batchRows ?? []
  let synthesized: SyncLogEntry[] = []

  if (batches.length > 0) {
    const batchIds = batches.map((b) => b.id)
    const { data: itemRows } = await supabase
      .from('sync_runs')
      .select('id, parent_run_id, contact_id, status, error_detail, data, contact:contact_id(first_name, last_name)')
      .eq('run_kind', 'item')
      .in('parent_run_id', batchIds)

    const itemsByBatch = new Map<string, SyncRunItem[]>()
    for (const item of (itemRows ?? []) as unknown as SyncRunItem[]) {
      if (!item.parent_run_id) continue
      const list = itemsByBatch.get(item.parent_run_id) ?? []
      list.push(item)
      itemsByBatch.set(item.parent_run_id, list)
    }

    synthesized = batches.map((batch) => {
      const items = itemsByBatch.get(batch.id) ?? []
      return batch.integration === 'facebook'
        ? synthesizeFacebookEntry(batch, items)
        : synthesizeDialfirePullEntry(batch, items)
    })
  }

  const merged = [...(legacyRows ?? []), ...synthesized] as SyncLogEntry[]
  merged.sort((a, b) => b.created_at.localeCompare(a.created_at))
  return merged.slice(0, limit)
}
