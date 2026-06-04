// API Route: Lead-Verwaltung
// GET  /api/leads — alle Leads abrufen
// POST /api/leads — neuen Lead anlegen (mit Duplikatprüfung)
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

const VALID_SOURCES = ['facebook', 'tiktok', 'calendly', 'csv', 'email', 'manuell']
const VALID_STATUSES = ['new', 'contacted', 'qualified', 'customer']

function normalizeSource(raw?: string): string {
  if (!raw) return 'manuell'
  const map: Record<string, string> = {
    facebook: 'facebook', Facebook: 'facebook',
    tiktok: 'tiktok', TikTok: 'tiktok',
    calendly: 'calendly', Calendly: 'calendly',
    csv: 'csv', CSV: 'csv',
    email: 'email', 'E-Mail': 'email',
    manuell: 'manuell', Manuell: 'manuell', manual: 'manuell',
  }
  return map[raw] ?? (VALID_SOURCES.includes(raw.toLowerCase()) ? raw.toLowerCase() : 'manuell')
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const source = searchParams.get('source')
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '200', 10), 500)

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

    const { first_name, last_name } = body
    if (!first_name?.trim() || !last_name?.trim()) {
      return Response.json(
        { success: false, error: 'Vorname und Nachname sind Pflichtfelder' },
        { status: 400 }
      )
    }

    // ── Duplikatprüfung ─────────────────────────────────────
    if (body.email?.trim() && !body.force) {
      const { data: emailDupe } = await supabase
        .from('leads')
        .select('id, first_name, last_name, email')
        .eq('email', body.email.trim().toLowerCase())
        .limit(1)
        .maybeSingle()

      if (emailDupe) {
        return Response.json({
          success: false,
          duplicate: true,
          error: `Duplikat: Lead mit dieser E-Mail existiert bereits (${emailDupe.first_name} ${emailDupe.last_name}).`,
          existing: emailDupe,
        }, { status: 409 })
      }
    }

    if (!body.force) {
      const { data: nameDupe } = await supabase
        .from('leads')
        .select('id, first_name, last_name, email')
        .eq('first_name', first_name.trim())
        .eq('last_name', last_name.trim())
        .limit(1)
        .maybeSingle()

      if (nameDupe) {
        return Response.json({
          success: false,
          duplicate: true,
          error: `Duplikat: Lead mit diesem Namen existiert bereits (${nameDupe.email || 'keine E-Mail'}).`,
          existing: nameDupe,
        }, { status: 409 })
      }
    }

    const source = normalizeSource(body.source)
    const status = VALID_STATUSES.includes(body.status) ? body.status : 'new'

    const insertData = {
      // Kontakt
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      email: body.email?.trim()?.toLowerCase() || null,
      phone_mobile: body.phone_mobile?.trim() || null,
      phone_office: body.phone_office?.trim() || null,
      // Persönlich
      birth_date: body.birth_date || null,
      marital_status: body.marital_status?.trim() || null,
      children: body.children ? parseInt(body.children) : null,
      profession: body.profession?.trim() || null,
      profession_group: body.profession_group?.trim() || null,
      position: body.position?.trim() || null,
      // Adresse
      address: body.address?.trim() || null,
      street: body.street?.trim() || null,
      postal_code: body.postal_code?.trim() || null,
      city: body.city?.trim() || null,
      country: body.country?.trim() || 'Deutschland',
      // Firma
      company_name: body.company_name?.trim() || null,
      legal_form: body.legal_form?.trim() || null,
      founded_year: body.founded_year ? parseInt(body.founded_year) : null,
      employees: body.employees ? parseInt(body.employees) : null,
      annual_revenue: body.annual_revenue?.trim() || null,
      trade_register: body.trade_register?.trim() || null,
      vat_id: body.vat_id?.trim() || null,
      industry: body.industry?.trim() || null,
      business_description: body.business_description?.trim() || null,
      website: body.website?.trim() || null,
      headquarters: body.headquarters?.trim() || null,
      // Versicherung
      existing_insurances: Array.isArray(body.existing_insurances) ? body.existing_insurances : [],
      current_providers: body.current_providers?.trim() || null,
      monthly_premium: body.monthly_premium?.trim() || null,
      coverage_gaps: body.coverage_gaps?.trim() || null,
      // Intern
      source,
      status,
      notes: body.notes?.trim() || null,
    }

    const { data: lead, error: insertError } = await supabase
      .from('leads')
      .insert(insertData)
      .select()
      .single()

    if (insertError) throw new Error(`Supabase Fehler: ${insertError.message}`)

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
