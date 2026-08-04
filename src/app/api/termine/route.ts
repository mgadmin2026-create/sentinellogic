// API Route: Termine (echte Kalendertermine mit Uhrzeit, siehe termine-Tabelle)
// GET  /api/termine?von=ISO&bis=ISO — Termine im Zeitraum (Range überlappt Start/Ende)
// POST /api/termine — neuen Termin anlegen
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { getStratoConfig, pushStratoEvent } from '@/lib/strato-caldav'
import { sanitizeTeilnehmer, mitStandardTeilnehmer } from '@/lib/kalender-helpers'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const url = new URL(request.url)
    const von = url.searchParams.get('von')
    const bis = url.searchParams.get('bis')
    const contactId = url.searchParams.get('contact_id')

    let query = supabase
      .from('termine')
      .select(`
        *,
        contact:contact_id(id, first_name, last_name),
        assigned_user:assigned_user_id(name)
      `)
      .order('start_zeit', { ascending: true })

    // Überlappung mit dem angefragten Zeitraum, nicht nur "Start liegt drin" —
    // sonst fehlen mehrtägige/ganztägige Termine, die vor "von" beginnen.
    if (von) query = query.lt('start_zeit', bis ?? von).gte('end_zeit', von)
    if (contactId) query = query.eq('contact_id', contactId)

    const { data, error } = await query.limit(1000)

    if (error) {
      console.error('[GET /api/termine] Fehler:', error)
      return Response.json({ success: false, error: error.message }, { status: 500 })
    }

    return Response.json({ success: true, data: data ?? [] })
  } catch (err) {
    console.error('[GET /api/termine] Fehler:', err)
    return Response.json({ success: false, error: 'Termine konnten nicht geladen werden' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const currentUser = await getCurrentUser()
    const body = await request.json()

    if (!body.titel || !body.start_zeit || !body.end_zeit) {
      return Response.json(
        { success: false, error: 'Felder erforderlich: titel, start_zeit, end_zeit' },
        { status: 400 }
      )
    }

    const terminData = {
      titel: String(body.titel).trim(),
      beschreibung: body.beschreibung ? String(body.beschreibung).trim() : null,
      start_zeit: body.start_zeit,
      end_zeit: body.end_zeit,
      ganztaegig: !!body.ganztaegig,
      ort: body.ort ? String(body.ort).trim() : null,
      contact_id: body.contact_id || null,
      assigned_user_id: body.assigned_user_id || currentUser?.id || null,
      created_by_user_id: currentUser?.id || null,
      kalender_quelle: 'crm',
      farbe: body.farbe || null,
      // Melih wird bei jedem neuen Termin automatisch eingeladen, unabhängig
      // davon, was das Formular sendet (siehe mitStandardTeilnehmer).
      teilnehmer: mitStandardTeilnehmer(sanitizeTeilnehmer(body.teilnehmer)),
    }

    const { data, error } = await supabase
      .from('termine')
      .insert([terminData])
      .select(`
        *,
        contact:contact_id(id, first_name, last_name),
        assigned_user:assigned_user_id(name)
      `)
      .single()

    if (error) {
      console.error('[POST /api/termine] Fehler:', error)
      return Response.json({ success: false, error: error.message }, { status: 500 })
    }

    // Sofort zu STRATO pushen (beidseitige Sync) — best effort: schlägt der
    // Push fehl, bleibt der Termin trotzdem im CRM gespeichert, nur eben
    // (noch) nicht synchronisiert. Nächster manueller Sync-Lauf holt ihn nicht
    // erneut rein (kein external_uid gesetzt bei Fehler), Nutzer kann bei
    // Bedarf erneut speichern.
    const stratoConfig = getStratoConfig()
    if (stratoConfig) {
      try {
        const gepusht = await pushStratoEvent(stratoConfig, {
          titel: data.titel,
          beschreibung: data.beschreibung,
          ort: data.ort,
          start: new Date(data.start_zeit),
          end: new Date(data.end_zeit),
          ganztaegig: data.ganztaegig,
          teilnehmer: data.teilnehmer,
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
          .eq('id', data.id)
      } catch (err) {
        console.error('[POST /api/termine] STRATO-Push fehlgeschlagen (Termin bleibt lokal gespeichert):', err)
      }
    }

    return Response.json({ success: true, data }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/termine] Fehler:', err)
    return Response.json({ success: false, error: 'Termin konnte nicht erstellt werden' }, { status: 500 })
  }
}
