// API Route: manueller Pull-Sync von STRATO nach CRM
// POST /api/termine/sync-strato
//
// Holt alle Termine aus dem STRATO-CalDAV-Kalender und gleicht sie mit der
// termine-Tabelle ab, dedupliziert per external_uid. Absichtlich KEINE
// Löschpropagierung: verschwindet ein Termin auf STRATO-Seite, bleibt die
// lokale Kopie unangetastet — eine versehentliche STRATO-Löschung soll nicht
// automatisch echte CRM-Daten löschen. Der Push von CRM → STRATO passiert
// bereits sofort beim Anlegen/Bearbeiten/Löschen (siehe /api/termine),
// dieser Endpunkt deckt nur die Gegenrichtung ab.
import { createServerClient } from '@/lib/supabase/server'
import { getStratoConfig, fetchStratoEvents } from '@/lib/strato-caldav'

export async function POST() {
  try {
    const stratoConfig = getStratoConfig()
    if (!stratoConfig) {
      return Response.json(
        { success: false, error: 'STRATO-Zugangsdaten nicht konfiguriert (STRATO_CALDAV_URL/_USER/_PASSWORD)' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()
    const stratoEvents = await fetchStratoEvents(stratoConfig)

    let neu = 0
    let aktualisiert = 0
    let unveraendert = 0
    let fehler = 0

    for (const ev of stratoEvents) {
      try {
        const { data: bestehend } = await supabase
          .from('termine')
          .select('id, external_etag')
          .eq('external_uid', ev.uid)
          .maybeSingle()

        const feldwerte = {
          titel: ev.titel,
          beschreibung: ev.beschreibung ?? null,
          ort: ev.ort ?? null,
          start_zeit: ev.start.toISOString(),
          end_zeit: ev.end.toISOString(),
          ganztaegig: ev.ganztaegig,
          external_href: ev.href,
          external_etag: ev.etag,
          last_synced_at: new Date().toISOString(),
        }

        if (!bestehend) {
          await supabase.from('termine').insert({
            ...feldwerte,
            kalender_quelle: 'strato',
            external_uid: ev.uid,
            external_source: 'strato_caldav',
          })
          neu++
        } else if (bestehend.external_etag !== ev.etag) {
          await supabase.from('termine').update(feldwerte).eq('id', bestehend.id)
          aktualisiert++
        } else {
          unveraendert++
        }
      } catch (err) {
        console.error('[POST /api/termine/sync-strato] Fehler bei Event', ev.uid, err)
        fehler++
      }
    }

    return Response.json({
      success: true,
      data: { neu, aktualisiert, unveraendert, fehler, gesamt: stratoEvents.length },
    })
  } catch (err) {
    console.error('[POST /api/termine/sync-strato] Fehler:', err)
    return Response.json(
      { success: false, error: err instanceof Error ? err.message : 'Synchronisation fehlgeschlagen' },
      { status: 500 }
    )
  }
}
