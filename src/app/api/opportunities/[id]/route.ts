// API Route: Einzelne Opportunity
// GET    /api/opportunities/[id] — Opportunity laden
// PATCH  /api/opportunities/[id] — Opportunity aktualisieren
// DELETE /api/opportunities/[id] — Opportunity löschen
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

const ALLOWED_UPDATE_FIELDS = new Set([
  'thema', 'status', 'wert', 'nächster_schritt', 'fällig', 'notizen',
])

const VALID_STATUSES = ['neu', 'kontaktiert', 'analyse', 'angebot', 'nachfassen', 'kunde']

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient()
    const { id } = params

    const { data, error } = await supabase
      .from('opportunities')
      .select(`
        *,
        contact:contact_id(id, first_name, last_name),
        tasks:tasks(id, titel, status)
      `)
      .eq('id', id)
      .single()

    if (error || !data) {
      return Response.json({ success: false, error: 'Opportunity nicht gefunden' }, { status: 404 })
    }

    return Response.json({ success: true, data })
  } catch (err) {
    console.error('[GET /api/opportunities/[id]] Fehler:', err)
    return Response.json({ success: false, error: 'Opportunity konnte nicht geladen werden' }, { status: 500 })
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

    // Wert parsen (falls String)
    if (raw.wert && typeof raw.wert === 'string') {
      raw.wert = parseFloat(raw.wert) || null
    }

    // Enum-Validierung
    if (raw.status != null && !VALID_STATUSES.includes(String(raw.status))) {
      delete raw.status
    }

    // notizen_updated_at aktualisieren wenn Notizen geändert werden
    if (raw.notizen !== undefined) {
      raw.notizen_updated_at = new Date().toISOString()
    }

    if (Object.keys(raw).length === 0) {
      return Response.json(
        { success: false, error: 'Keine gültigen Felder zum Aktualisieren' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('opportunities')
      .update(raw)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[PATCH /api/opportunities/[id]] Fehler:', error)
      return Response.json({ success: false, error: error.message }, { status: 500 })
    }

    return Response.json({ success: true, data })
  } catch (err) {
    console.error('[PATCH /api/opportunities/[id]] Fehler:', err)
    return Response.json({ success: false, error: 'Opportunity konnte nicht aktualisiert werden' }, { status: 500 })
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
      .from('opportunities')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[DELETE /api/opportunities/[id]] Fehler:', error)
      return Response.json({ success: false, error: error.message }, { status: 500 })
    }

    return Response.json({ success: true, data: { deleted: true } })
  } catch (err) {
    console.error('[DELETE /api/opportunities/[id]] Fehler:', err)
    return Response.json({ success: false, error: 'Opportunity konnte nicht gelöscht werden' }, { status: 500 })
  }
}
