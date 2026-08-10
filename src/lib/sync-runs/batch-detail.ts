// Detailansicht für einen einzelnen sync_runs-Batch-Lauf (Facebook,
// Dialfire-Pull, CSV-Import) — liefert dieselbe Art von Aufschlüsselung, die
// früher im (jetzt entfernten) Sync-Protokoll beim Aufklappen einer Zeile
// zu sehen war: importierte Kontakte, Duplikate, Fehler. Wird von der
// Automatisierungs-Läufe-Tabelle auf /sync lazy nachgeladen, wenn eine
// Batch-Zeile aufgeklappt wird (siehe /api/sync-runs/[id]/detail).
import { createServerClient } from '@/lib/supabase/server'

type SupabaseClient = ReturnType<typeof createServerClient>

export interface BatchDetail {
  summary: string
  importedNames: string[]
  duplicates: Array<{ label: string; reason: string }>
  errors: Array<{ label: string; message: string }>
}

interface BatchRun {
  id: string
  integration: string
  data: Record<string, unknown> | null
}

interface ItemRow {
  id: string
  status: string
  error_detail: string | null
  data: Record<string, unknown> | null
  contact: { first_name: string | null; last_name: string | null } | null
}

async function loadItems(supabase: SupabaseClient, batchId: string): Promise<ItemRow[]> {
  const { data } = await supabase
    .from('sync_runs')
    .select('id, status, error_detail, data, contact:contact_id(first_name, last_name)')
    .eq('run_kind', 'item')
    .eq('parent_run_id', batchId)
  return (data ?? []) as unknown as ItemRow[]
}

function contactLabel(contact: ItemRow['contact']): string {
  return [contact?.first_name, contact?.last_name].filter(Boolean).join(' ') || 'Ohne Namen'
}

function csvDetail(run: BatchRun): BatchDetail {
  const d = run.data ?? {}
  return {
    summary: String(d.message ?? ''),
    importedNames: Array.isArray(d.lead_names) ? (d.lead_names as string[]) : [],
    duplicates: [],
    errors: [],
  }
}

async function facebookDetail(supabase: SupabaseClient, run: BatchRun): Promise<BatchDetail> {
  const d = run.data ?? {}
  const items = await loadItems(supabase, run.id)

  const errors = items
    .filter((i) => i.status === 'failed' || i.status === 'dead_letter')
    .map((i) => {
      const lead = (i.data?.lead ?? {}) as Record<string, unknown>
      return { label: String(lead.id ?? 'Unbekannt'), message: i.error_detail ?? '' }
    })

  const duplicates = items
    .filter((i) => i.status === 'success')
    .flatMap((i) => {
      const result = (i.data?.result ?? {}) as Record<string, unknown>
      if (result.outcome !== 'linked') return []
      return [{ label: typeof result.email === 'string' ? result.email : 'Unbekannt', reason: 'E-Mail entspricht bestehendem Kontakt' }]
    })

  return {
    summary: `Synced: ${d.synced ?? 0}, Updated: ${d.updated ?? 0}, Skipped: ${d.skipped ?? 0}, Errors: ${d.errors ?? 0}`,
    importedNames: [],
    duplicates,
    errors,
  }
}

async function dialfirePullDetail(supabase: SupabaseClient, run: BatchRun): Promise<BatchDetail> {
  const d = run.data ?? {}
  const items = await loadItems(supabase, run.id)

  const errors = items
    .filter((i) => i.status === 'failed' || i.status === 'dead_letter')
    .map((i) => ({ label: contactLabel(i.contact), message: i.error_detail ?? '' }))

  const importedNames = items
    .filter((i) => {
      const result = (i.data?.result ?? {}) as Record<string, unknown>
      return i.status === 'success' && result.changed === true
    })
    .map((i) => contactLabel(i.contact))

  return {
    summary: `${d.total ?? 0} verbundene Kontakte geprüft — Aktualisiert: ${d.updated ?? 0}, Unverändert: ${d.unchanged ?? 0}, Fehler: ${d.errors ?? 0}`,
    importedNames,
    duplicates: [],
    errors,
  }
}

export async function getBatchDetail(supabase: SupabaseClient, run: BatchRun): Promise<BatchDetail | null> {
  if (run.integration === 'csv_import') return csvDetail(run)
  if (run.integration === 'facebook') return facebookDetail(supabase, run)
  if (run.integration === 'dialfire_pull') return dialfirePullDetail(supabase, run)
  return null
}
