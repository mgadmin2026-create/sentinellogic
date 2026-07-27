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

/** Wiedervorlage-Frist für nicht erreichte Kunden (festgelegt am 27.07.2026). */
const NICHT_ERREICHT_FRIST_TAGE = 2

function faelligkeitInTagen(tage: number): string {
  const datum = new Date()
  datum.setDate(datum.getDate() + tage)
  return datum.toISOString().slice(0, 10)
}

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
        description: 'Gesprächsergebnis erfasst',
        data: { call_log_id: data.id, result },
        user_id: currentUser.id,
      })
    }

    // „Nicht erreicht" erzeugt automatisch eine Wiedervorlage in 2 Tagen —
    // sonst geht der Kontaktversuch im Alltag verloren. Ein Scheitern hier darf
    // das Speichern des Ergebnisses nicht rückgängig machen.
    let folgeaufgabe: { id: string; fällig: string } | null = null
    if (result === 'nicht_erreicht' && data.contact_id) {
      const { data: kontakt } = await supabase
        .from('contacts')
        .select('first_name, last_name, assigned_user_id')
        .eq('id', data.contact_id)
        .maybeSingle()

      // Wiedervorlage übernimmt der Betreuer des Kontakts, sonst der Anrufende.
      const zustaendig = kontakt?.assigned_user_id || currentUser.id
      const name = [kontakt?.first_name, kontakt?.last_name].filter(Boolean).join(' ').trim()
      const faellig = faelligkeitInTagen(NICHT_ERREICHT_FRIST_TAGE)

      const { data: aufgabe, error: aufgabeError } = await supabase
        .from('tasks')
        .insert({
          contact_id: data.contact_id,
          assigned_user_id: zustaendig,
          created_by_user_id: currentUser.id,
          titel: name ? `Erneut anrufen: ${name}` : 'Erneut anrufen',
          beschreibung: notes
            ? `Nicht erreicht. Notiz aus dem Anruf: ${notes}`
            : 'Beim letzten Anruf nicht erreicht.',
          status: 'offen',
          priorität: 'mittel',
          fällig: faellig,
        })
        // Bewusst nur die ID abfragen: Der Supabase-Typparser kommt mit dem
        // Umlaut in „fällig" innerhalb der select-Angabe nicht zurecht.
        .select('id')
        .single()

      if (aufgabeError) {
        console.error('[PATCH /api/calls/[id]/result] Wiedervorlage fehlgeschlagen:', aufgabeError.message)
      } else if (aufgabe) {
        folgeaufgabe = { id: aufgabe.id, fällig: faellig }
        await supabase.from('activities').insert({
          lead_id: data.contact_id,
          type: 'task_created',
          description: `Wiedervorlage in ${NICHT_ERREICHT_FRIST_TAGE} Tagen angelegt (nicht erreicht)`,
          data: { call_log_id: data.id, task_id: aufgabe.id },
          user_id: currentUser.id,
        })
      }
    }

    return Response.json({ success: true, data, folgeaufgabe })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ success: false, error: 'Ungültige Anfrage' }, { status: 400 })
    }
    console.error('[PATCH /api/calls/[id]/result] Unerwarteter Fehler:', error)
    return Response.json({ success: false, error: 'Gesprächsergebnis konnte nicht gespeichert werden' }, { status: 500 })
  }
}
