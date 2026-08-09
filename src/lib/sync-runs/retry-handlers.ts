// Registry + Ausführung fälliger Retries. Bewusst schlank: pro Integration
// eine Funktion, die den Kontakt frisch lädt und die jeweilige Sync-Funktion
// mit resumeFrom erneut aufruft — kein generischer Job-Runner.
import { createServerClient } from '@/lib/supabase/server'
import { syncStoredContactToKlickTipp } from '@/lib/klicktipp-sync'
import { syncContactToDialfire } from '@/lib/dialfire-sync'
import { retryFacebookLead, type FacebookLeadRaw } from '@/lib/facebook-sync'
import { retryDialfirePullContact } from '@/lib/dialfire-pull-sync'
import { syncContactToSuperchat } from '@/lib/superchat-sync'
import { pushTerminToStrato, deleteTerminFromStrato } from '@/lib/strato-sync'
import { processEvent as processKlickTippWebhookEvent, type KlickTippWebhookEventCore } from '@/lib/klicktipp-webhook'
import { runWithTracking } from '@/lib/sync-runs/retry-runner'

type SupabaseClient = ReturnType<typeof createServerClient>

interface DueRun {
  id: string
  contact_id: string | null
  rule_id: string | null
  attempt_count: number
  data: Record<string, unknown> | null
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
  facebook: async (_supabase, run) => {
    const lead = run.data?.lead as FacebookLeadRaw | undefined
    if (!lead) return
    await retryFacebookLead(lead, { id: run.id, attempt_count: run.attempt_count })
  },
  dialfire_pull: async (supabase, run) => {
    if (!run.contact_id) return
    const { data: contact } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, dialfire_id, dialfire_campaign_id')
      .eq('id', run.contact_id)
      .single()
    if (!contact || !contact.dialfire_id || !contact.dialfire_campaign_id) return
    await retryDialfirePullContact(contact, { id: run.id, attempt_count: run.attempt_count })
  },
  superchat: async (supabase, run) => {
    if (!run.contact_id) return
    const { data: contact } = await supabase
      .from('contacts')
      .select(
        'id, first_name, last_name, email, phone_mobile, phone_office, anrede, company_name, street, hausnummer, postal_code, city, country, geburtstag, superchat_id'
      )
      .eq('id', run.contact_id)
      .single()
    if (!contact) return
    await syncContactToSuperchat(supabase, contact, {
      resumeFrom: { id: run.id, attempt_count: run.attempt_count },
    })
  },
  klicktipp_webhook: async (supabase, run) => {
    const fingerprint = run.data?.fingerprint as string | undefined
    if (!fingerprint || !run.contact_id) return

    const { data: storedEvent } = await supabase
      .from('klicktipp_webhook_events')
      .select('*')
      .eq('event_fingerprint', fingerprint)
      .single()
    if (!storedEvent) return

    const { data: contact } = await supabase.from('contacts').select('id').eq('id', run.contact_id).single()
    if (!contact) return

    const event: KlickTippWebhookEventCore = {
      eventType: storedEvent.event_type,
      occurredAt: storedEvent.occurred_at,
      emailStatus: storedEvent.email_status,
      klicktippId: storedEvent.klicktipp_id,
      campaignName: storedEvent.campaign_name,
      messageName: storedEvent.message_name,
      tagName: storedEvent.tag_name,
      linkLabel: storedEvent.link_label,
    }

    try {
      await runWithTracking(
        supabase,
        { runKind: 'item', integration: 'klicktipp_webhook', triggerType: 'webhook', contactId: contact.id, data: { fingerprint } },
        () => processKlickTippWebhookEvent(event, contact, fingerprint),
        { id: run.id, attempt_count: run.attempt_count }
      )
      await supabase
        .from('klicktipp_webhook_events')
        .update({ processing_status: 'processed', processed_at: new Date().toISOString() })
        .eq('event_fingerprint', fingerprint)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await supabase
        .from('klicktipp_webhook_events')
        .update({ processing_status: 'failed', processing_error: message.slice(0, 500), processed_at: new Date().toISOString() })
        .eq('event_fingerprint', fingerprint)
      throw err
    }
  },
  strato_calendar: async (supabase, run) => {
    const resumeFrom = { id: run.id, attempt_count: run.attempt_count }
    const action = run.data?.action
    if (action === 'push') {
      const terminId = run.data?.terminId as string | undefined
      if (!terminId) return
      await pushTerminToStrato(supabase, terminId, { triggerType: 'auto', resumeFrom })
    } else if (action === 'delete') {
      const href = run.data?.href as string | undefined
      if (!href) return
      await deleteTerminFromStrato(
        supabase,
        {
          href,
          terminId: (run.data?.terminId as string) ?? '',
          terminTitel: (run.data?.terminTitel as string) ?? '',
          contactId: run.contact_id,
        },
        { triggerType: 'auto', resumeFrom }
      )
    }
  },
}

/**
 * Verarbeitet fällige Retries für eine Integration (sync_runs mit
 * status='retrying' und next_retry_at in der Vergangenheit). Wird von
 * bestehenden Cron-Routen mit-aufgerufen (Piggyback), kein eigener
 * Scheduler-Baustein — das bleibt Fahrplan (offene Phase 5). Fehler einzelner Retries
 * blockieren nicht die übrigen (jeder Handler loggt selbst über
 * activities/sync_runs, hier nur grob abgefangen). Nur run_kind='item'
 * wird verarbeitet — Batch-Zeilen bekommen nie status='retrying' und dürfen
 * auch nie über einen Item-Handler "retried" werden (siehe
 * facebook-sync.ts/dialfire-pull-sync.ts, die Batch-Fehlschläge immer
 * direkt als dead_letter verbuchen).
 */
export async function processRetries(supabase: SupabaseClient, integration: string): Promise<{ processed: number }> {
  const handler = RETRY_HANDLERS[integration]
  if (!handler) return { processed: 0 }

  const { data: dueRuns, error } = await supabase
    .from('sync_runs')
    .select('id, contact_id, rule_id, attempt_count, data')
    .eq('integration', integration)
    .eq('run_kind', 'item')
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

/**
 * Führt den Retry-Handler für EINE Zeile sofort aus (statt auf den nächsten
 * Cron-Tick / next_retry_at zu warten) — genutzt vom "Retry jetzt"-Button im
 * Control Center. Funktioniert für `retrying`- UND `dead_letter`-Zeilen (der
 * Handler ruft intern mit resumeFrom auf, was unabhängig vom aktuellen
 * Status dieselbe Zeile weiterführt).
 */
export async function retryRunNow(supabase: SupabaseClient, runId: string): Promise<{ success: boolean; error?: string }> {
  const { data: run, error } = await supabase
    .from('sync_runs')
    .select('id, integration, contact_id, rule_id, attempt_count, data, run_kind')
    .eq('id', runId)
    .single()

  if (error || !run) return { success: false, error: 'Lauf nicht gefunden' }
  if (run.run_kind !== 'item') {
    return { success: false, error: 'Nur einzelne Läufe können erneut ausgeführt werden' }
  }

  const handler = RETRY_HANDLERS[run.integration]
  if (!handler) return { success: false, error: `Kein Retry-Handler für Integration "${run.integration}"` }

  try {
    await handler(supabase, run)
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Stoppt den automatischen Retry einer Zeile manuell (Nutzer-Aktion) —
 * setzt status='skipped', wodurch processRetries() sie danach nicht mehr
 * aufgreift. Nur für `retrying`-Zeilen sinnvoll.
 */
export async function pauseRun(supabase: SupabaseClient, runId: string): Promise<{ success: boolean; error?: string }> {
  const { data: run, error: fetchError } = await supabase
    .from('sync_runs')
    .select('status')
    .eq('id', runId)
    .single()

  if (fetchError || !run) return { success: false, error: 'Lauf nicht gefunden' }
  if (run.status !== 'retrying') {
    return { success: false, error: 'Nur wiederholende Läufe können pausiert werden' }
  }

  const { error } = await supabase
    .from('sync_runs')
    .update({ status: 'skipped', next_retry_at: null })
    .eq('id', runId)

  if (error) return { success: false, error: error.message }
  return { success: true }
}
