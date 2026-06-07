// API Route: Einzelner Kontakt
// GET    /api/kontakte/[id] — Kontakt mit Aktivitäten laden
// PATCH  /api/kontakte/[id] — Kontakt-Felder aktualisieren
// DELETE /api/kontakte/[id] — Kontakt löschen
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

const ALLOWED_UPDATE_FIELDS = new Set([
  'first_name', 'last_name', 'email', 'phone_mobile', 'phone_office',
  'company_name', 'industry', 'position',
  'street', 'postal_code', 'city', 'country', 'website',
  'source', 'status', 'notes',
  'assigned_user_id', 'qualität', 'bestandskunde',
])

const VALID_STATUSES = ['new', 'contacted', 'qualified', 'customer']
const VALID_SOURCES = ['facebook', 'tiktok', 'calendly', 'csv', 'email', 'manuell']

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient()
    const { id } = params

    // Kontakt laden
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', id)
      .single()

    if (contactError || !contact) {
      return Response.json({ success: false, error: 'Kontakt nicht gefunden' }, { status: 404 })
    }

    // Aktivitäten laden
    const { data: activities } = await supabase
      .from('activities')
      .select('*')
      .eq('lead_id', id)
      .order('created_at', { ascending: false })

    // Aufgaben laden
    const { data: tasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('contact_id', id)
      .order('created_at', { ascending: false })

    // Opportunities laden
    const { data: opportunities } = await supabase
      .from('opportunities')
      .select('*')
      .eq('contact_id', id)
      .order('created_at', { ascending: false })

    return Response.json({
      success: true,
      data: {
        ...contact,
        activities: activities ?? [],
        tasks: tasks ?? [],
        opportunities: opportunities ?? [],
      },
    })
  } catch (error) {
    console.error('[GET /api/kontakte/[id]] Fehler:', error)
    return Response.json({ success: false, error: 'Kontakt konnte nicht geladen werden' }, { status: 500 })
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

    // Nur erlaubte Felder durchlassen
    const raw: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(body)) {
      if (ALLOWED_UPDATE_FIELDS.has(key)) raw[key] = value
    }

    // Leere Strings → null
    for (const key of Object.keys(raw)) {
      if (raw[key] === '') raw[key] = null
    }

    // E-Mail normalisieren
    if (raw.email && typeof raw.email === 'string') {
      raw.email = raw.email.trim().toLowerCase()
    }

    // Enum-Validierung
    if (raw.source != null && !VALID_SOURCES.includes(String(raw.source))) {
      raw.source = 'manuell'
    }
    if (raw.status != null && !VALID_STATUSES.includes(String(raw.status))) {
      delete raw.status
    }

    // Boolean-Konversion für bestandskunde
    if (raw.bestandskunde !== undefined) {
      raw.bestandskunde = raw.bestandskunde === true || raw.bestandskunde === 'true'
    }

    if (Object.keys(raw).length === 0) {
      return Response.json(
        { success: false, error: 'Keine gültigen Felder zum Aktualisieren' },
        { status: 400 }
      )
    }

    // Kontakt aktualisieren
    const { data, error } = await supabase
      .from('contacts')
      .update(raw)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[PATCH /api/kontakte/[id]] Fehler:', error)
      return Response.json({ success: false, error: error.message }, { status: 500 })
    }

    // Aktivität loggen (optional)
    if (raw.status) {
      try {
        await supabase.from('activities').insert({
          lead_id: id,
          type: 'status_change',
          description: `Status geändert zu: ${raw.status}`,
        })
      } catch (e) {
        // Fehler beim Aktivitätsloggen ignorieren
      }
    }

    return Response.json({ success: true, data })
  } catch (err) {
    console.error('[PATCH /api/kontakte/[id]] Fehler:', err)
    return Response.json({ success: false, error: 'Kontakt konnte nicht aktualisiert werden' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient()
    const { id } = params

    // Kontakt löschen (Cascade-Delete auf tasks, opportunities, activities)
    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[DELETE /api/kontakte/[id]] Fehler:', error)
      return Response.json({ success: false, error: error.message }, { status: 500 })
    }

    return Response.json({ success: true, data: { deleted: true } })
  } catch (err) {
    console.error('[DELETE /api/kontakte/[id]] Fehler:', err)
    return Response.json({ success: false, error: 'Kontakt konnte nicht gelöscht werden' }, { status: 500 })
  }
}
