// Registry + Ausführung fälliger Retries. Bewusst schlank: pro Integration
// eine Funktion, die den Kontakt frisch lädt und die jeweilige Sync-Funktion
// mit resumeFrom erneut aufruft — kein generischer Job-Runner.
import { createServerClient } from '@/lib/supabase/server'
import { syncStoredContactToKlickTipp } from '@/lib/klicktipp-sync'
import { syncContactToDialfire } from '@/lib/dialfire-sync'

type SupabaseClient = ReturnType<typeof createServerClient>

interface DueRun {
  id: string
  contact_id: string | null
  rule_id: string | null
  attempt_count: number
}

type RetryHandler = (supabase: SupabaseClient, run: DueRun) => Promise<void>

const RETRY_HANDLERS: Record<string, RetryHandler> = {
  klicktipp: async (supabase, run) => {
    if (!run.contact_id) return
    const { data: contact } = await supabase.from('contacts').select('*').eq('id', run.contact_id).single()
    if (!contact) return
    await syncStoredContactToKlickTipp(supabase, contact, {
      ruleId: run.rule_id,
      resumeFrom: { id: run.id, attempt_count: run.attempt_count },
    })
  },
  dialfire: async (supabase, run) => {
    if (!run.contact_id) return
    const { data: contact } = await supabase.from('contacts').select('*').eq('id', run.contact_id).single()
    if (!contact) return
    await syncContactToDialfire(supabase, contact, {
      ruleId: run.rule_id,
      resumeFrom: { id: run.id, attempt_count: run.attempt_count },
    })
  },
}

/**
 * Verarbeitet fällige Retries für eine Integration (sync_runs mit
 * status='retrying' und next_retry_at in der Vergangenheit). Wird von
 * bestehenden Cron-Routen mit-aufgerufen (Piggyback), kein eigener
 * Scheduler-Baustein — das bleibt Phase 3. Fehler einzelner Retries
 * blockieren nicht die übrigen (jeder Handler loggt selbst über
 * activities/sync_runs, hier nur grob abgefangen).
 */
export async function processRetries(supabase: SupabaseClient, integration: string): Promise<{ processed: number }> {
  const handler = RETRY_HANDLERS[integration]
  if (!handler) return { processed: 0 }

  const { data: dueRuns, error } = await supabase
    .from('sync_runs')
    .select('id, contact_id, rule_id, attempt_count')
    .eq('integration', integration)
    .eq('status', 'retrying')
    .lte('next_retry_at', new Date().toISOString())
    .limit(50)

  if (error) {
    console.error(`[sync-runs] processRetries(${integration}) Query fehlgeschlagen:`, error)
    return { processed: 0 }
  }
  if (!dueRuns?.length) return { processed: 0 }

  for (const run of dueRuns) {
    try {
      await handler(supabase, run)
    } catch (err) {
      console.error(`[sync-runs] Retry fehlgeschlagen für ${integration}/${run.id}:`, err)
    }
  }

  return { processed: dueRuns.length }
}
