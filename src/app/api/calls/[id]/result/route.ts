import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import type { PlacetelCallResult } from '@/types/placetel'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const VALID_RESULTS = new Set<PlacetelCallResult>([
  'termin',
  'wiedervorlage',
  'kein_interesse',
  'nicht_erreicht',
  'falsche_nummer',
  'sonstiges',
])

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return Response.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 })
  }

  try {
    if (!UUID_PATTERN.test(params.id)) {
      return Response.json({ success: false, error: 'Ungültiger Anruf' }, { status: 400 })
    }

    const body = await request.json() as { result?: unknown; notes?: unknown }
    const result = typeof body.result === 'string' ? body.result as PlacetelCallResult : null
    const notes = typeof body.notes === 'string' ? body.notes.trim() : ''

    if (!result || !VALID_RESULTS.has(result)) {
      return Response.json({ success: false, error: 'Ungültiges Gesprächsergebnis' }, { status: 400 })
    }
    if (notes.length > 2_000) {
      return Response.json({ success: false, error: 'Die Notiz darf höchstens 2.000 Zeichen lang sein' }, { status: 400 })
    }

    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('call_logs')
      .update({
        result,
        notes: notes || null,
        result_recorded_by: currentUser.id,
        result_recorded_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select('id, contact_id, result, notes, result_recorded_at')
      .single()

    if (error || !data) {
      return Response.json({ success: false, error: 'Anruf nicht gefunden' }, { status: 404 })
    }

    if (data.contact_id) {
      await supabase.from('activities').insert({
        lead_id: data.contact_id,
        type: 'placetel_call_result_recorded',
        description: 'Placetel-Gesprächsergebnis erfasst',
        data: { call_log_id: data.id, result },
      })
    }

    return Response.json({ success: true, data })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ success: false, error: 'Ungültige Anfrage' }, { status: 400 })
    }
    console.error('[PATCH /api/calls/[id]/result] Unerwarteter Fehler:', error)
    return Response.json({ success: false, error: 'Gesprächsergebnis konnte nicht gespeichert werden' }, { status: 500 })
  }
}
