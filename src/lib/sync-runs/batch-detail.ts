// Detailansicht für einen einzelnen sync_runs-Batch-Lauf (Facebook,
// Dialfire-Pull, CSV-Import) — liefert eine Aufschlüsselung pro Kontakt
// (Status, Fehlerdetail) statt der einen aggregierten Batch-Zeile in der
// Automatisierungs-Läufe-Tabelle auf /sync. Wird lazy nachgeladen, wenn
// eine Batch-Zeile aufgeklappt wird (siehe /api/sync-runs/[id]/detail).
import { createServerClient } from '@/lib/supabase/server'
import { extractLeadLabel, type FacebookLeadRaw } from '@/lib/facebook-sync'

type SupabaseClient = ReturnType<typeof createServerClient>

export interface BatchDetailItem {
  id: string
  label: string
  status: string
  attemptCount: number
  maxAttempts: number
  note?: string
  errorMessage?: string
}

export interface BatchDetail {
  summary: string
  items: BatchDetailItem[]
}

interface BatchRun {
  id: string
  integration: string
  data: Record<string, unknown> | null
}

interface ItemRow {
  id: string
  status: string
  attempt_count: number
  max_attempts: number
  error_detail: string | null
  data: Record<string, unknown> | null
  contact: { first_name: string | null; last_name: string | null } | null
}

async function loadItems(supabase: SupabaseClient, batchId: string): Promise<ItemRow[]> {
  const { data } = await supabase
    .from('sync_runs')
    .select('id, status, attempt_count, max_attempts, error_detail, data, contact:contact_id(first_name, last_name)')
    .eq('run_kind', 'item')
    .eq('parent_run_id', batchId)
  return (data ?? []) as unknown as ItemRow[]
}

function contactLabel(contact: ItemRow['contact']): string {
  return [contact?.first_name, contact?.last_name].filter(Boolean).join(' ') || 'Ohne Namen'
}

function csvDetail(run: BatchRun): BatchDetail {
  const d = run.data ?? {}
  const names = Array.isArray(d.lead_names) ? (d.lead_names as string[]) : []
  return {
    summary: String(d.message ?? ''),
    items: names.map((name) => ({ id: '', label: name, status: 'success', attemptCount: 1, maxAttempts: 1 })),
  }
}

async function facebookDetail(supabase: SupabaseClient, run: BatchRun): Promise<BatchDetail> {
  const d = run.data ?? {}
  const items = await loadItems(supabase, run.id)

  const detailItems: BatchDetailItem[] = items.map((i) => {
    const lead = (i.data?.lead ?? {}) as FacebookLeadRaw
    const result = (i.data?.result ?? {}) as Record<string, unknown>
    const label = (typeof result.email === 'string' && result.email) || extractLeadLabel(lead)
    const note =
      result.outcome === 'linked'
        ? 'Verknüpft mit bestehendem Kontakt'
        : result.outcome === 'created'
          ? 'Neu angelegt'
          : undefined
    return {
      id: i.id,
      label,
      status: i.status,
      attemptCount: i.attempt_count,
      maxAttempts: i.max_attempts,
      note,
      errorMessage: i.error_detail ?? undefined,
    }
  })

  return {
    summary: `Synced: ${d.synced ?? 0}, Updated: ${d.updated ?? 0}, Skipped: ${d.skipped ?? 0}, Errors: ${d.errors ?? 0}`,
    items: detailItems,
  }
}

async function dialfirePullDetail(supabase: SupabaseClient, run: BatchRun): Promise<BatchDetail> {
  const d = run.data ?? {}
  const items = await loadItems(supabase, run.id)

  const detailItems: BatchDetailItem[] = items.map((i) => {
    const result = (i.data?.result ?? {}) as Record<string, unknown>
    const changed = result.changed === true
    return {
      id: i.id,
      label: contactLabel(i.contact),
      status: i.status,
      attemptCount: i.attempt_count,
      maxAttempts: i.max_attempts,
      note: i.status === 'success' ? (changed ? 'Aktualisiert' : 'Unverändert') : undefined,
      errorMessage: i.error_detail ?? undefined,
    }
  })

  return {
    summary: `${d.total ?? 0} verbundene Kontakte geprüft — Aktualisiert: ${d.updated ?? 0}, Unverändert: ${d.unchanged ?? 0}, Fehler: ${d.errors ?? 0}`,
    items: detailItems,
  }
}

export async function getBatchDetail(supabase: SupabaseClient, run: BatchRun): Promise<BatchDetail | null> {
  if (run.integration === 'csv_import') return csvDetail(run)
  if (run.integration === 'facebook') return facebookDetail(supabase, run)
  if (run.integration === 'dialfire_pull') return dialfirePullDetail(supabase, run)
  return null
}
