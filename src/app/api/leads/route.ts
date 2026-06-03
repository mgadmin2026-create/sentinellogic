// API Route: Lead-Verwaltung
// GET  /api/leads — alle Leads abrufen (mit Filter + Limit)
// POST /api/leads — neuen Lead anlegen
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// Gültige Enum-Werte aus der DB
const VALID_SOURCES = ['facebook', 'tiktok', 'calendly', 'csv', 'email']
const VALID_STATUSES = ['new', 'contacted', 'qualified', 'customer']

// Quelle normalisieren (z.B. "Facebook" → "facebook")
function normalizeSource(raw?: string): string {
  if (!raw) return 'csv'
  const map: Record<string, string> = {
    facebook: 'facebook', Facebook: 'facebook',
    tiktok: 'tiktok', TikTok: 'tiktok',
    calendly: 'calendly', Calendly: 'calendly',
    csv: 'csv', CSV: 'csv',
    email: 'email', 'E-Mail': 'email', EMail: 'email',
  }
  return map[raw] ?? (VALID_SOURCES.includes(raw.toLowerCase()) ? raw.toLowerCase() : 'csv')
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const source = searchParams.get('source')
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '100', 10), 500)

    let query = supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status && VALID_STATUSES.includes(status)) query = query.eq('status', status)
    if (source && VALID_SOURCES.includes(source)) query = query.eq('source', source)

    const { data, error } = await query
    if (error) throw new Error(`Supabase Fehler: ${error.message}`)

    return Response.json({ success: true, data: data ?? [] })
  } catch (error) {
    console.error('[GET /api/leads] Fehler:', error)
    return Response.json({ success: false, error: 'Leads konnten nicht geladen werden' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const supabase = createServerClient()

    // Nur Vorname + Nachname sind wirklich Pflicht
    const { first_name, last_name } = body
    if (!first_name?.trim() || !last_name?.trim()) {
      return Response.json(
        { success: false, error: 'Vorname und Nachname sind Pflichtfelder' },
        { status: 400 }
      )
    }

    const source = normalizeSource(body.source)
    const status = VALID_STATUSES.includes(body.status) ? body.status : 'new'

    // Alle erlaubten Felder explizit mappen
    const insertData = {
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      email: body.email?.trim() || null,
      phone_mobile: (body.phone_mobile || body.phone)?.trim() || null,
      phone_office: body.phone_office?.trim() || null,
      address: body.address?.trim() || null,
      company_name: body.company_name?.trim() || null,
      industry: body.industry?.trim() || null,
      position: body.position?.trim() || null,
      profession: body.profession?.trim() || null,
      website: body.website?.trim() || null,
      notes: body.notes?.trim() || null,
      source,
      status,
    }

    const { data: lead, error: insertError } = await supabase
      .from('leads')
      .insert(insertData)
      .select()
      .single()

    if (insertError) throw new Error(`Supabase Fehler: ${insertError.message}`)

    // Aktivität protokollieren
    // Aktivität protokollieren — Fehler werden ignoriert (nicht kritisch)
    void supabase.from('activities').insert({
      lead_id: lead.id,
      type: 'sync',
      description: `Lead angelegt via ${source}`,
    })

    return Response.json({ success: true, data: lead }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/leads] Fehler:', error)
    return Response.json({ success: false, error: 'Lead konnte nicht angelegt werden' }, { status: 500 })
  }
}
