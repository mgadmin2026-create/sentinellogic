// API Route: Kontakte-Verwaltung (neue contacts-Tabelle)
// GET  /api/kontakte — alle Kontakte abrufen
// POST /api/kontakte — neuen Kontakt anlegen
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

const VALID_STATUSES = ['new', 'contacted', 'qualified', 'customer']
const VALID_SOURCES = ['facebook', 'tiktok', 'calendly', 'csv', 'email', 'manuell']

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') ?? '100', 10)
    const status = url.searchParams.get('status')
    const search = url.searchParams.get('search')

    let query = supabase.from('contacts').select('*').order('created_at', { ascending: false })

    if (status && VALID_STATUSES.includes(status)) {
      query = query.eq('status', status)
    }

    if (search) {
      const q = `%${search}%`
      query = query.or(`first_name.ilike.${q},last_name.ilike.${q},email.ilike.${q},company_name.ilike.${q}`)
    }

    const { data, error } = await query.limit(limit)

    if (error) {
      console.error('[GET /api/kontakte] Fehler:', error)
      return Response.json({ success: false, error: error.message }, { status: 500 })
    }

    return Response.json({ success: true, data: data ?? [] })
  } catch (err) {
    console.error('[GET /api/kontakte] Fehler:', err)
    return Response.json({ success: false, error: 'Kontakte konnten nicht geladen werden' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const body = await request.json()

    // Pflichtfelder
    if (!body.first_name || !body.last_name || !body.email) {
      return Response.json(
        { success: false, error: 'Felder erforderlich: first_name, last_name, email' },
        { status: 400 }
      )
    }

    // E-Mail normalisieren
    const email = String(body.email).trim().toLowerCase()

    // Duplikatprüfung (E-Mail + Name)
    const { data: existing } = await supabase
      .from('contacts')
      .select('id')
      .eq('email', email)
      .eq('first_name', String(body.first_name).trim())
      .eq('last_name', String(body.last_name).trim())
      .single()

    if (existing) {
      return Response.json(
        { success: false, error: 'Duplikat', duplicate: true },
        { status: 409 }
      )
    }

    // Neue Kontakt anlegen
    const kontaktData = {
      first_name: String(body.first_name).trim(),
      last_name: String(body.last_name).trim(),
      email,
      phone_mobile: body.phone_mobile ? String(body.phone_mobile).trim() : null,
      phone_office: body.phone_office ? String(body.phone_office).trim() : null,
      company_name: body.company_name ? String(body.company_name).trim() : null,
      industry: body.industry ? String(body.industry).trim() : null,
      position: body.position ? String(body.position).trim() : null,
      street: body.street ? String(body.street).trim() : null,
      postal_code: body.postal_code ? String(body.postal_code).trim() : null,
      city: body.city ? String(body.city).trim() : null,
      country: body.country ? String(body.country).trim() : null,
      website: body.website ? String(body.website).trim() : null,
      source: VALID_SOURCES.includes(String(body.source ?? 'manuell')) ? body.source : 'manuell',
      status: VALID_STATUSES.includes(String(body.status ?? 'new')) ? body.status : 'new',
      assigned_user_id: body.assigned_user_id ?? null,
      notes: body.notes ? String(body.notes).trim() : null,
    }

    const { data, error } = await supabase
      .from('contacts')
      .insert([kontaktData])
      .select()
      .single()

    if (error) {
      console.error('[POST /api/kontakte] Fehler:', error)
      return Response.json({ success: false, error: error.message }, { status: 500 })
    }

    return Response.json({ success: true, data }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/kontakte] Fehler:', err)
    return Response.json({ success: false, error: 'Kontakt konnte nicht erstellt werden' }, { status: 500 })
  }
}
