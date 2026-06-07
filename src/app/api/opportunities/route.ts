// API Route: Opportunities-Verwaltung (opportunities-Tabelle)
// GET  /api/opportunities — alle Opportunities abrufen
// POST /api/opportunities — neue Opportunity anlegen
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

const VALID_STATUSES = ['neu', 'kontaktiert', 'analyse', 'angebot', 'nachfassen', 'kunde']

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') ?? '100', 10)
    const status = url.searchParams.get('status')
    const contactId = url.searchParams.get('contact_id')
    const search = url.searchParams.get('search')

    let query = supabase
      .from('opportunities')
      .select(`
        *,
        contact:contact_id(first_name, last_name)
      `)
      .order('created_at', { ascending: false })

    if (status && VALID_STATUSES.includes(status)) {
      query = query.eq('status', status)
    }

    if (contactId) {
      query = query.eq('contact_id', contactId)
    }

    if (search) {
      query = query.ilike('thema', `%${search}%`)
    }

    const { data, error } = await query.limit(limit)

    if (error) {
      console.error('[GET /api/opportunities] Fehler:', error)
      return Response.json({ success: false, error: error.message }, { status: 500 })
    }

    return Response.json({ success: true, data: data ?? [] })
  } catch (err) {
    console.error('[GET /api/opportunities] Fehler:', err)
    return Response.json({ success: false, error: 'Opportunities konnten nicht geladen werden' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const body = await request.json()

    // Pflichtfelder
    if (!body.contact_id || !body.thema) {
      return Response.json(
        { success: false, error: 'Felder erforderlich: contact_id, thema' },
        { status: 400 }
      )
    }

    // Neue Opportunity anlegen
    const opportunityData = {
      contact_id: body.contact_id,
      thema: String(body.thema).trim(),
      status: VALID_STATUSES.includes(String(body.status ?? 'neu')) ? body.status : 'neu',
      wert: body.wert ? parseFloat(body.wert) : null,
      nächster_schritt: body.nächster_schritt ? String(body.nächster_schritt).trim() : null,
      fällig: body.fällig ?? null,
      notizen: body.notizen ? String(body.notizen).trim() : null,
    }

    const { data, error } = await supabase
      .from('opportunities')
      .insert([opportunityData])
      .select()
      .single()

    if (error) {
      console.error('[POST /api/opportunities] Fehler:', error)
      return Response.json({ success: false, error: error.message }, { status: 500 })
    }

    // Aktivität loggen (optional)
    try {
      await supabase
        .from('activities')
        .insert({
          lead_id: body.contact_id,
          type: 'opportunity_created',
          description: `Opportunity erstellt: ${opportunityData.thema}`,
        })
    } catch (e) {
      // Fehler beim Aktivitätsloggen ignorieren
    }

    return Response.json({ success: true, data }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/opportunities] Fehler:', err)
    return Response.json({ success: false, error: 'Opportunity konnte nicht erstellt werden' }, { status: 500 })
  }
}
