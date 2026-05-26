// API Route: Lead-Verwaltung
// GET  /api/leads — alle Leads abrufen
// POST /api/leads — neuen Lead anlegen und in Klicktipp + Dialfire synchronisieren
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { subscribeContact } from '@/lib/integrations/klicktipp'
import { createDialfireContact } from '@/lib/integrations/dialfire'
import type { Lead, ApiResponse } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const source = searchParams.get('source')
    const limit = parseInt(searchParams.get('limit') ?? '50', 10)

    let query = supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status) query = query.eq('status', status)
    if (source) query = query.eq('source', source)

    const { data, error } = await query

    if (error) throw new Error(`Supabase Fehler: ${error.message}`)

    return Response.json({ success: true, data } satisfies ApiResponse<Lead[]>)
  } catch (error) {
    console.error('[GET /api/leads] Fehler:', error)
    return Response.json(
      { success: false, error: 'Leads konnten nicht geladen werden' } satisfies ApiResponse<never>,
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Pflichtfelder prüfen
    const { first_name, last_name, email, phone, source } = body
    if (!first_name || !last_name || !email || !phone) {
      return Response.json(
        { success: false, error: 'Pflichtfelder fehlen: first_name, last_name, email, phone' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    // Lead in Supabase anlegen
    const { data: lead, error: insertError } = await supabase
      .from('leads')
      .insert({
        first_name,
        last_name,
        email,
        phone,
        company_name: body.company_name ?? null,
        source: source ?? 'manual',
        status: 'new',
        notes: body.notes ?? null,
      })
      .select()
      .single()

    if (insertError) throw new Error(`Supabase Insert Fehler: ${insertError.message}`)

    // Aktivität protokollieren
    await supabase.from('activities').insert({
      lead_id: lead.id,
      type: 'sync',
      description: `Lead angelegt via ${source ?? 'manual'}`,
    })

    // Parallel in externe Systeme synchronisieren
    const syncResults = await Promise.allSettled([
      subscribeContact(
        { email, first_name, last_name, phone },
        process.env.KLICKTIPP_LIST_ID ?? ''
      ),
      createDialfireContact(
        { first_name, last_name, phone, email },
        process.env.DIALFIRE_CAMPAIGN_ID ?? ''
      ),
    ])

    // Externe IDs zurückschreiben falls Sync erfolgreich
    const klicktippResult = syncResults[0]
    const dialfireResult = syncResults[1]

    const updates: Partial<Lead> = {}

    if (klicktippResult.status === 'fulfilled' && klicktippResult.value.id) {
      updates.klicktipp_id = klicktippResult.value.id
    } else if (klicktippResult.status === 'rejected') {
      console.error('[POST /api/leads] Klicktipp Sync fehlgeschlagen:', klicktippResult.reason)
    }

    if (dialfireResult.status === 'fulfilled' && dialfireResult.value.id) {
      updates.dialfire_id = dialfireResult.value.id
    } else if (dialfireResult.status === 'rejected') {
      console.error('[POST /api/leads] Dialfire Sync fehlgeschlagen:', dialfireResult.reason)
    }

    if (Object.keys(updates).length > 0) {
      await supabase.from('leads').update(updates).eq('id', lead.id)
    }

    return Response.json(
      { success: true, data: { ...lead, ...updates } } satisfies ApiResponse<Lead>,
      { status: 201 }
    )
  } catch (error) {
    console.error('[POST /api/leads] Fehler:', error)
    return Response.json(
      { success: false, error: 'Lead konnte nicht angelegt werden' } satisfies ApiResponse<never>,
      { status: 500 }
    )
  }
}
