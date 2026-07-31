// API Route: Einzelner Termin
// GET    /api/termine/[id] — Termin laden
// PATCH  /api/termine/[id] — Termin aktualisieren
// DELETE /api/termine/[id] — Termin löschen
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getStratoConfig, pushStratoEvent, deleteStratoEvent } from '@/lib/strato-caldav'

const ALLOWED_UPDATE_FIELDS = new Set([
  'titel', 'beschreibung', 'start_zeit', 'end_zeit', 'ganztaegig',
  'ort', 'contact_id', 'assigned_user_id', 'farbe',
])

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('termine')
      .select(`
        *,
        contact:contact_id(id, first_name, last_name),
        assigned_user:assigned_user_id(name)
      `)
      .eq('id', params.id)
      .single()

    if (error || !data) {
      return Response.json({ success: false, error: 'Termin nicht gefunden' }, { status: 404 })
    }

    return Response.json({ success: true, data })
  } catch (err) {
    console.error('[GET /api/termine/[id]] Fehler:', err)
    return Response.json({ success: false, error: 'Termin konnte nicht geladen werden' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient()
    const body = await request.json()

    const raw: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(body)) {
      if (ALLOWED_UPDATE_FIELDS.has(key)) raw[key] = value
    }
    for (const key of Object.keys(raw)) {
      if (raw[key] === '') raw[key] = null
    }
    raw.updated_at = new Date().toISOString()

    if (Object.keys(raw).length === 0) {
      return Response.json({ success: false, error: 'Keine gültigen Felder zum Aktualisieren' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('termine')
      .update(raw)
      .eq('id', params.id)
      .select(`
        *,
        contact:contact_id(id, first_name, last_name),
        assigned_user:assigned_user_id(name)
      `)
      .single()

    if (error) {
      console.error('[PATCH /api/termine/[id]] Fehler:', error)
      return Response.json({ success: false, error: error.message }, { status: 500 })
    }

    // Änderung zu STRATO pushen (beidseitige Sync) — best effort, wie beim
    // Anlegen. Bereits verknüpfte Termine (external_href gesetzt) werden
    // aktualisiert statt dupliziert.
    const stratoConfig = getStratoConfig()
    if (stratoConfig) {
      try {
        const gepusht = await pushStratoEvent(stratoConfig, {
          uid: data.external_uid,
          href: data.external_href,
          titel: data.titel,
          beschreibung: data.beschreibung,
          ort: data.ort,
          start: new Date(data.start_zeit),
          end: new Date(data.end_zeit),
          ganztaegig: data.ganztaegig,
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
          .eq('id', params.id)
      } catch (err) {
        console.error('[PATCH /api/termine/[id]] STRATO-Push fehlgeschlagen (Änderung bleibt lokal gespeichert):', err)
      }
    }

    return Response.json({ success: true, data })
  } catch (err) {
    console.error('[PATCH /api/termine/[id]] Fehler:', err)
    return Response.json({ success: false, error: 'Termin konnte nicht aktualisiert werden' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient()

    // Verknüpften STRATO-Termin zuerst löschen (beidseitige Sync) — best
    // effort: schlägt es fehl (z.B. STRATO nicht erreichbar), wird trotzdem
    // lokal gelöscht, damit ein STRATO-Ausfall die CRM-Nutzung nicht blockiert.
    const stratoConfig = getStratoConfig()
    if (stratoConfig) {
      const { data: bestehend } = await supabase
        .from('termine')
        .select('external_href')
        .eq('id', params.id)
        .maybeSingle()
      if (bestehend?.external_href) {
        try {
          await deleteStratoEvent(stratoConfig, bestehend.external_href)
        } catch (err) {
          console.error('[DELETE /api/termine/[id]] STRATO-Löschung fehlgeschlagen (lokal wird trotzdem gelöscht):', err)
        }
      }
    }

    const { error } = await supabase.from('termine').delete().eq('id', params.id)

    if (error) {
      console.error('[DELETE /api/termine/[id]] Fehler:', error)
      return Response.json({ success: false, error: error.message }, { status: 500 })
    }

    return Response.json({ success: true, data: { deleted: true } })
  } catch (err) {
    console.error('[DELETE /api/termine/[id]] Fehler:', err)
    return Response.json({ success: false, error: 'Termin konnte nicht gelöscht werden' }, { status: 500 })
  }
}
