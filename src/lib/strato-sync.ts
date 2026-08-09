// Konsolidierte STRATO-Kalender-Push-Logik -- vorher inline in
// src/app/api/termine/route.ts (POST) und src/app/api/termine/[id]/route.ts
// (PATCH/DELETE). Seit Phase 4 der Sync-Architektur-Vereinheitlichung
// zusätzlich an sync_runs angebunden.
//
// Asymmetrie zwischen Push und Delete: beim Push existiert die
// termine-Zeile bereits (lokal wurde vor dem STRATO-Aufruf gespeichert) --
// ein Retry lädt sie deshalb frisch per ID nach (aktueller Stand, u.a.
// korrekte SEQUENCE für ICS). Beim Delete wird der STRATO-Löschversuch VOR
// dem lokalen DB-Delete ausgeführt -- zum Retry-Zeitpunkt existiert die
// Zeile nicht mehr, deshalb bekommt deleteTerminFromStrato() den href
// explizit übergeben statt ihn nachzuladen.
import { createServerClient } from '@/lib/supabase/server'
import { getStratoConfig, pushStratoEvent, deleteStratoEvent } from '@/lib/strato-caldav'
import { logActivity } from '@/lib/activities-logger'
import { runWithTracking, type ResumeRun } from '@/lib/sync-runs/retry-runner'

type SupabaseClient = ReturnType<typeof createServerClient>

export interface StratoSyncMeta {
  triggerType?: 'manual' | 'auto'
  resumeFrom?: ResumeRun
}

export type StratoPushResult = { status: 'synced' } | { status: 'skipped' }

/**
 * Pusht den aktuellen Stand eines Termins zu STRATO (Create oder Update, je
 * nachdem ob external_href bereits gesetzt ist). Lädt den Termin frisch per
 * ID, damit ein späterer Retry nicht mit veralteten Daten pusht (z.B. wenn
 * der Termin zwischenzeitlich erneut bearbeitet wurde).
 */
export async function pushTerminToStrato(
  supabase: SupabaseClient,
  terminId: string,
  meta: StratoSyncMeta = {}
): Promise<StratoPushResult> {
  const stratoConfig = getStratoConfig()
  if (!stratoConfig) return { status: 'skipped' }

  const { data: termin } = await supabase.from('termine').select('*').eq('id', terminId).maybeSingle()
  if (!termin) return { status: 'skipped' } // inzwischen gelöscht -- nichts zu tun

  try {
    await runWithTracking(
      supabase,
      {
        runKind: 'item',
        integration: 'strato_calendar',
        triggerType: meta.triggerType ?? 'manual',
        contactId: termin.contact_id ?? null,
        data: { action: 'push', terminId },
      },
      async () => {
        const gepusht = await pushStratoEvent(stratoConfig, {
          uid: termin.external_uid,
          href: termin.external_href,
          titel: termin.titel,
          beschreibung: termin.beschreibung,
          ort: termin.ort,
          start: new Date(termin.start_zeit),
          end: new Date(termin.end_zeit),
          ganztaegig: termin.ganztaegig,
          teilnehmer: termin.teilnehmer,
          sequence: termin.sequence,
        })
        await supabase
          .from('termine')
          .update({
            external_uid: gepusht.uid,
            external_href: gepusht.href,
            external_etag: gepusht.etag,
            external_source: 'strato_caldav',
            last_synced_at: new Date().toISOString(),
          })
          .eq('id', terminId)
        return gepusht
      },
      meta.resumeFrom
    )
    return { status: 'synced' }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (termin.contact_id) {
      await logActivity(
        null,
        termin.contact_id,
        'strato_calendar_sync_failed',
        `STRATO-Kalender-Sync fehlgeschlagen für Termin "${termin.titel}": ${message}`,
        { termin_id: terminId }
      )
    }
    throw err
  }
}

/**
 * Löscht einen verknüpften STRATO-Termin. Der href muss vom Aufrufer VOR
 * dem lokalen DB-Delete ermittelt worden sein -- danach existiert die
 * termine-Zeile nicht mehr.
 */
export async function deleteTerminFromStrato(
  supabase: SupabaseClient,
  params: { href: string; terminId: string; terminTitel: string; contactId: string | null },
  meta: StratoSyncMeta = {}
): Promise<void> {
  const stratoConfig = getStratoConfig()
  if (!stratoConfig) return

  try {
    await runWithTracking(
      supabase,
      {
        runKind: 'item',
        integration: 'strato_calendar',
        triggerType: meta.triggerType ?? 'manual',
        contactId: params.contactId,
        data: { action: 'delete', href: params.href, terminId: params.terminId, terminTitel: params.terminTitel },
      },
      () => deleteStratoEvent(stratoConfig, params.href),
      meta.resumeFrom
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (params.contactId) {
      await logActivity(
        null,
        params.contactId,
        'strato_calendar_sync_failed',
        `STRATO-Kalender-Löschung fehlgeschlagen für Termin "${params.terminTitel}": ${message}`,
        { termin_id: params.terminId }
      )
    }
    throw err
  }
}
