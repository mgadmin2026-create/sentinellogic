// API Route: Einzelne Aufgabe
// GET    /api/aufgaben/[id] — Aufgabe laden
// PATCH  /api/aufgaben/[id] — Aufgabe aktualisieren
// DELETE /api/aufgaben/[id] — Aufgabe löschen
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

const ALLOWED_UPDATE_FIELDS = new Set([
  'titel', 'beschreibung', 'status', 'priorität', 'fällig',
  'assigned_user_id', 'opportunity_id', 'erledigt_am',
])

const VALID_STATUSES = ['offen', 'in_bearbeitung', 'erledigt']
const VALID_PRIORITIES = ['niedrig', 'mittel', 'hoch']

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient()
    const { id } = params

    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        contact:contact_id(id, first_name, last_name),
        assigned_user:assigned_user_id(name)
      `)
      .eq('id', id)
      .single()

    if (error || !data) {
      return Response.json({ success: false, error: 'Aufgabe nicht gefunden' }, { status: 404 })
    }

    return Response.json({ success: true, data })
  } catch (err) {
    console.error('[GET /api/aufgaben/[id]] Fehler:', err)
    return Response.json({ success: false, error: 'Aufgabe konnte nicht geladen werden' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient()
    const body = await request.json()
    const { id } = params

    // Nur erlaubte Felder
    const raw: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(body)) {
      if (ALLOWED_UPDATE_FIELDS.has(key)) raw[key] = value
    }

    // Leere Strings → null
    for (const key of Object.keys(raw)) {
      if (raw[key] === '') raw[key] = null
    }

    // Enum-Validierung
    if (raw.status != null && !VALID_STATUSES.includes(String(raw.status))) {
      delete raw.status
    }
    if (raw.priorität != null && !VALID_PRIORITIES.includes(String(raw.priorität))) {
      delete raw.priorität
    }

    // Wenn Status zu 'erledigt', erledigt_am setzen
    if (raw.status === 'erledigt' && !raw.erledigt_am) {
      raw.erledigt_am = new Date().toISOString()
    }

    if (Object.keys(raw).length === 0) {
      return Response.json(
        { success: false, error: 'Keine gültigen Felder zum Aktualisieren' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('tasks')
      .update(raw)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[PATCH /api/aufgaben/[id]] Fehler:', error)
      return Response.json({ success: false, error: error.message }, { status: 500 })
    }

    return Response.json({ success: true, data })
  } catch (err) {
    console.error('[PATCH /api/aufgaben/[id]] Fehler:', err)
    return Response.json({ success: false, error: 'Aufgabe konnte nicht aktualisiert werden' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient()
    const { id } = params

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[DELETE /api/aufgaben/[id]] Fehler:', error)
      return Response.json({ success: false, error: error.message }, { status: 500 })
    }

    return Response.json({ success: true, data: { deleted: true } })
  } catch (err) {
    console.error('[DELETE /api/aufgaben/[id]] Fehler:', err)
    return Response.json({ success: false, error: 'Aufgabe konnte nicht gelöscht werden' }, { status: 500 })
  }
}
