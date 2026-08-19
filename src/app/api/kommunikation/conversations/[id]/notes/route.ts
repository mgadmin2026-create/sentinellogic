import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) return Response.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 })
    if (!UUID_PATTERN.test(params.id)) return Response.json({ success: false, error: 'Ungültige Gesprächs-ID' }, { status: 400 })

    const body = await request.json()
    const textContent = typeof body.text === 'string' ? body.text.trim() : ''
    if (!textContent || textContent.length > 4000) {
      return Response.json({ success: false, error: 'Die Notiz muss zwischen 1 und 4.000 Zeichen lang sein' }, { status: 400 })
    }

    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('communication_messages')
      .insert({
        conversation_id: params.id,
        direction: 'internal',
        message_type: 'note',
        text_content: textContent,
        sender_name: currentUser.name,
        delivery_status: 'received',
        created_by_user_id: currentUser.id,
      })
      .select('id, direction, message_type, text_content, sender_name, sent_at, delivery_status, attachment_metadata')
      .single()

    if (error) {
      console.error('[POST /api/kommunikation/conversations/:id/notes] Datenbankfehler:', error.code)
      return Response.json({ success: false, error: 'Notiz konnte nicht gespeichert werden' }, { status: 500 })
    }
    return Response.json({ success: true, data }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/kommunikation/conversations/:id/notes] Unerwarteter Fehler:', error)
    return Response.json({ success: false, error: 'Notiz konnte nicht gespeichert werden' }, { status: 500 })
  }
}

