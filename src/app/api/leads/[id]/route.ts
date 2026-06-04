// API Route: Einzelner Lead
// GET    /api/leads/[id] — Lead mit Aktivitäten laden
// PATCH  /api/leads/[id] — Lead-Felder aktualisieren (nur erlaubte Felder)
// DELETE /api/leads/[id] — Lead löschen
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// Nur diese Felder dürfen per PATCH aktualisiert werden
const ALLOWED_UPDATE_FIELDS = new Set([
  'first_name', 'last_name', 'email', 'phone_mobile', 'phone_office',
  'birth_date', 'marital_status', 'children', 'profession', 'profession_group', 'position',
  'address', 'street', 'postal_code', 'city', 'country',
  'company_name', 'legal_form', 'founded_year', 'employees', 'annual_revenue',
  'trade_register', 'vat_id', 'industry', 'business_description', 'website', 'headquarters',
  'existing_insurances', 'current_providers', 'monthly_premium', 'coverage_gaps', 'next_renewals',
  'source', 'status', 'notes',
  'first_contact_date', 'first_contact_channel', 'last_contact_date', 'next_contact', 'contact_count',
  'klicktipp_id', 'dialfire_id', 'research_data',
])

const VALID_SOURCES = ['facebook', 'tiktok', 'calendly', 'csv', 'email', 'manuell']
const VALID_STATUSES = ['new', 'contacted', 'qualified', 'customer']

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient()
    const { id } = params

    const { data: lead, error } = await supabase
      .from('leads').select('*').eq('id', id).single()

    if (error || !lead) {
      return Response.json({ success: false, error: 'Lead nicht gefunden' }, { status: 404 })
    }

    const { data: activities } = await supabase
      .from('activities').select('*').eq('lead_id', id)
      .order('created_at', { ascending: true })

    return Response.json({ success: true, data: { ...lead, activities: activities ?? [] } })
  } catch (error) {
    console.error('[GET /api/leads/[id]] Fehler:', error)
    return Response.json({ success: false, error: 'Lead konnte nicht geladen werden' }, { status: 500 })
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

    // Nur erlaubte Felder durchlassen — verhindert DB-Fehler durch unbekannte Spalten
    const raw: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(body)) {
      if (ALLOWED_UPDATE_FIELDS.has(key)) raw[key] = value
    }

    // Typ-Konvertierungen
    if (raw.children !== undefined && raw.children !== null && raw.children !== '')
      raw.children = parseInt(String(raw.children))
    else if (raw.children === '') raw.children = null

    if (raw.founded_year !== undefined && raw.founded_year !== null && raw.founded_year !== '')
      raw.founded_year = parseInt(String(raw.founded_year))
    else if (raw.founded_year === '') raw.founded_year = null

    if (raw.employees !== undefined && raw.employees !== null && raw.employees !== '')
      raw.employees = parseInt(String(raw.employees))
    else if (raw.employees === '') raw.employees = null

    if (raw.email && typeof raw.email === 'string')
      raw.email = raw.email.trim().toLowerCase()

    // Enum-Validierung
    if (raw.source && !VALID_SOURCES.includes(String(raw.source)))
      raw.source = 'manuell'
    if (raw.status && !VALID_STATUSES.includes(String(raw.status)))
      delete raw.status

    if (Object.keys(raw).length === 0) {
      return Response.json({ success: false, error: 'Keine gültigen Felder zum Aktualisieren' }, { status: 400 })
    }

    // Felder aus optionalen Migrationen — werden beim Retry entfernt falls Spalten fehlen
    const MIGRATION_V2_FIELDS = ['street', 'postal_code', 'city', 'country']

    let { data, error } = await supabase
      .from('leads').update(raw).eq('id', id).select().single()

    // Wenn Spalten fehlen (Migration nicht ausgeführt) → Retry ohne optionale Felder
    if (error && (error.code === '42703' || error.message.toLowerCase().includes('column'))) {
      console.warn('[PATCH] Optionale Spalten nicht vorhanden, Retry ohne Migration-Felder')
      for (const f of MIGRATION_V2_FIELDS) delete raw[f]
      const retry = await supabase.from('leads').update(raw).eq('id', id).select().single()
      data = retry.data
      error = retry.error
    }

    if (error) throw new Error(`Supabase Fehler: ${error.message}`)

    // Status-Änderung protokollieren
    if (raw.status) {
      void supabase.from('activities').insert({
        lead_id: id,
        type: 'status_change',
        description: `Status geändert zu: ${VALID_STATUSES.includes(String(raw.status)) ? raw.status : ''}`,
      })
    }

    return Response.json({ success: true, data })
  } catch (error) {
    console.error('[PATCH /api/leads/[id]] Fehler:', error)
    return Response.json({ success: false, error: 'Lead konnte nicht aktualisiert werden' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient()
    const { error } = await supabase.from('leads').delete().eq('id', params.id)
    if (error) throw new Error(`Supabase Fehler: ${error.message}`)
    return Response.json({ success: true, data: { deleted: params.id } })
  } catch (error) {
    console.error('[DELETE /api/leads/[id]] Fehler:', error)
    return Response.json({ success: false, error: 'Lead konnte nicht gelöscht werden' }, { status: 500 })
  }
}
