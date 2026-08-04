// API Route: Call-Vorbereitungs-Agent
// POST /api/agents/call-prep — aggregiert Kontaktdaten und lässt Claude eine
// kurze, interne Gesprächsvorbereitung generieren. Keine Persistierung hier —
// das übernimmt optional POST /api/kontakte/[id]/notes ("Als Notiz speichern").
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { istTechnisch } from '@/lib/activity-classification'
import { generateCallPrep, type CallPrepContext } from '@/lib/call-prep'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const { contactId } = await request.json()
    if (!contactId) {
      return NextResponse.json({ success: false, error: 'contactId erforderlich' }, { status: 400 })
    }

    const supabase = createServerClient()

    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('*, assigned_user:assigned_user_id(name)')
      .eq('id', contactId)
      .single()

    if (contactError || !contact) {
      return NextResponse.json({ success: false, error: 'Kontakt nicht gefunden' }, { status: 404 })
    }

    const [activitiesRes, tasksRes, notesRes, docsCountRes] = await Promise.all([
      supabase
        .from('activities')
        .select('type,description,created_at')
        .eq('lead_id', contactId)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('tasks')
        .select('*')
        .eq('contact_id', contactId)
        .neq('status', 'erledigt')
        .order('fällig', { ascending: true }),
      supabase
        .from('contact_notes_history')
        .select('*')
        .eq('contact_id', contactId)
        .eq('is_archived', false)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('dokumente_metadata')
        .select('id', { count: 'exact', head: true })
        .eq('kontakt_id', contactId)
        .eq('ordner_archived', false),
    ])

    const fachlicheAktivitäten = (activitiesRes.data ?? [])
      .filter((a: any) => !istTechnisch(a.type))
      .slice(0, 10)
      .map((a: any) => ({ type: a.type, description: a.description, created_at: a.created_at }))

    const openTasks = (tasksRes.data ?? []).map((t: any) => ({
      titel: t.titel,
      status: t.status,
      priorität: t.priorität,
      fällig: t.fällig ?? null,
    }))

    const notesHistory = (notesRes.data ?? []).map((n: any) => ({
      content: n.content,
      created_at: n.created_at,
      type: n.type,
    }))

    const context: CallPrepContext = {
      firstName: contact.first_name,
      lastName: contact.last_name,
      companyName: contact.company_name,
      status: contact.status,
      sparte: contact.sparte,
      pipelineStage: contact.pipeline_stage,
      source: contact.source,
      assignedUserName: contact.assigned_user?.name ?? null,
      bestandskunde: contact.bestandskunde,
      qualität: contact.qualität,
      versicherungsgesellschaft: contact.versicherungsgesellschaft,
      jahresumsatz: contact.jahresumsatz,
      mitarbeitanzahl: contact.mitarbeitanzahl,
      headNotes: contact.notes,
      notesHistory,
      activities: fachlicheAktivitäten,
      openTasks,
      documentCount: docsCountRes.count ?? 0,
    }

    const result = await generateCallPrep(context)

    return NextResponse.json({
      success: true,
      data: { ...result, generated_at: new Date().toISOString() },
    })
  } catch (error) {
    console.error('[POST /api/agents/call-prep] Fehler:', error)
    const message = error instanceof Error ? error.message : 'Gesprächsvorbereitung fehlgeschlagen'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
