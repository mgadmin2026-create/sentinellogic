// API Route: Aufgaben-Verwaltung (tasks-Tabelle)
// GET  /api/aufgaben — alle Aufgaben abrufen (optional gefiltert)
// POST /api/aufgaben — neue Aufgabe anlegen
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

const VALID_STATUSES = ['offen', 'in_bearbeitung', 'erledigt']
const VALID_PRIORITIES = ['niedrig', 'mittel', 'hoch']

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') ?? '100', 10)
    const status = url.searchParams.get('status')
    const priorität = url.searchParams.get('priorität')
    const contactId = url.searchParams.get('contact_id')
    const assignedUserId = url.searchParams.get('assigned_user_id')
    const search = url.searchParams.get('search')

    let query = supabase
      .from('tasks')
      .select(`
        *,
        contact:contact_id(first_name, last_name),
        assigned_user:assigned_user_id(name)
      `)
      .order('fällig', { ascending: true })

    if (status && VALID_STATUSES.includes(status)) {
      query = query.eq('status', status)
    }

    if (priorität && VALID_PRIORITIES.includes(priorität)) {
      query = query.eq('priorität', priorität)
    }

    if (contactId) {
      query = query.eq('contact_id', contactId)
    }

    if (assignedUserId) {
      query = query.eq('assigned_user_id', assignedUserId)
    }

    if (search) {
      query = query.ilike('titel', `%${search}%`)
    }

    const { data, error } = await query.limit(limit)

    if (error) {
      console.error('[GET /api/aufgaben] Fehler:', error)
      return Response.json({ success: false, error: error.message }, { status: 500 })
    }

    return Response.json({ success: true, data: data ?? [] })
  } catch (err) {
    console.error('[GET /api/aufgaben] Fehler:', err)
    return Response.json({ success: false, error: 'Aufgaben konnten nicht geladen werden' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const body = await request.json()

    // Pflichtfelder
    if (!body.contact_id || !body.titel || !body.fällig) {
      return Response.json(
        { success: false, error: 'Felder erforderlich: contact_id, titel, fällig' },
        { status: 400 }
      )
    }

    // Neue Aufgabe anlegen
    const aufgabenData = {
      contact_id: body.contact_id,
      opportunity_id: body.opportunity_id ?? null,
      assigned_user_id: body.assigned_user_id ?? null,
      created_by_user_id: body.created_by_user_id ?? null,
      titel: String(body.titel).trim(),
      beschreibung: body.beschreibung ? String(body.beschreibung).trim() : null,
      status: VALID_STATUSES.includes(String(body.status ?? 'offen')) ? body.status : 'offen',
      priorität: VALID_PRIORITIES.includes(String(body.priorität ?? 'mittel')) ? body.priorität : 'mittel',
      fällig: body.fällig, // Date string
      triggered_by_rule: body.triggered_by_rule ?? null,
      triggered_by_process_step: body.triggered_by_process_step ?? null,
    }

    const { data, error } = await supabase
      .from('tasks')
      .insert([aufgabenData])
      .select()
      .single()

    if (error) {
      console.error('[POST /api/aufgaben] Fehler:', error)
      return Response.json({ success: false, error: error.message }, { status: 500 })
    }

    // Aktivität loggen (optional)
    try {
      await supabase
        .from('activities')
        .insert({
          lead_id: body.contact_id,
          type: 'task_created',
          description: `Aufgabe erstellt: ${aufgabenData.titel}`,
        })
    } catch (e) {
      // Fehler beim Aktivitätsloggen ignorieren
    }

    return Response.json({ success: true, data }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/aufgaben] Fehler:', err)
    return Response.json({ success: false, error: 'Aufgabe konnte nicht erstellt werden' }, { status: 500 })
  }
}
