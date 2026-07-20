import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return Response.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 })
  }

  try {
    const contactId = request.nextUrl.searchParams.get('contactId') || ''
    const requestedLimit = Number.parseInt(request.nextUrl.searchParams.get('limit') || '50', 10)
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 50

    if (!UUID_PATTERN.test(contactId)) {
      return Response.json({ success: false, error: 'Ungültiger Kontakt' }, { status: 400 })
    }

    const supabase = createServerClient()
    const { data: contact } = await supabase
      .from('contacts')
      .select('id')
      .eq('id', contactId)
      .single()

    if (!contact) {
      return Response.json({ success: false, error: 'Kontakt nicht gefunden' }, { status: 404 })
    }

    const { data, error } = await supabase
      .from('call_logs')
      .select(`
        id,
        contact_id,
        placetel_call_id,
        direction,
        status,
        from_number,
        to_number,
        started_at,
        accepted_at,
        ended_at,
        duration_seconds,
        result,
        notes,
        created_at
      `)
      .eq('contact_id', contactId)
      .order('started_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[GET /api/calls] Anrufhistorie konnte nicht geladen werden:', error.message)
      return Response.json({ success: false, error: 'Anrufhistorie konnte nicht geladen werden' }, { status: 500 })
    }

    return Response.json({ success: true, data: data ?? [] })
  } catch (error) {
    console.error('[GET /api/calls] Unerwarteter Fehler:', error)
    return Response.json({ success: false, error: 'Anrufhistorie konnte nicht geladen werden' }, { status: 500 })
  }
}
