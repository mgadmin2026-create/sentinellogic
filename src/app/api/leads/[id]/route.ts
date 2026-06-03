// API Route: Einzelner Lead
// GET   /api/leads/[id] — Lead mit Aktivitäten laden
// PATCH /api/leads/[id] — Lead-Felder aktualisieren
// DELETE /api/leads/[id] — Lead löschen
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient()
    const { id } = params

    // Lead laden
    const { data: lead, error } = await supabase
      .from('leads')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !lead) {
      return Response.json({ success: false, error: 'Lead nicht gefunden' }, { status: 404 })
    }

    // Aktivitäten laden
    const { data: activities } = await supabase
      .from('activities')
      .select('*')
      .eq('lead_id', id)
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

    // Schreibgeschützte Felder entfernen
    const { id: _id, created_at, ...updates } = body

    const { data, error } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(`Supabase Fehler: ${error.message}`)

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
    const { id } = params

    const { error } = await supabase.from('leads').delete().eq('id', id)
    if (error) throw new Error(`Supabase Fehler: ${error.message}`)

    return Response.json({ success: true, data: { deleted: id } })
  } catch (error) {
    console.error('[DELETE /api/leads/[id]] Fehler:', error)
    return Response.json({ success: false, error: 'Lead konnte nicht gelöscht werden' }, { status: 500 })
  }
}
