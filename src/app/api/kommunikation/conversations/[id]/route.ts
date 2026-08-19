import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { mapConversation, mapMessage } from '@/lib/communication-inbox'
import { createServerClient } from '@/lib/supabase/server'
import type { ConversationStatus } from '@/types/communication'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const VALID_STATUSES: ConversationStatus[] = ['open', 'snoozed', 'done']

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) return Response.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 })
    if (!UUID_PATTERN.test(params.id)) return Response.json({ success: false, error: 'Ungültige Gesprächs-ID' }, { status: 400 })

    const supabase = createServerClient()
    const { data: conversation, error: conversationError } = await supabase
      .from('communication_conversations')
      .select(`
        id, provider, provider_conversation_id, channel, status, unread_count,
        last_message_preview, last_message_at, snoozed_until,
        contact:contact_id(id, first_name, last_name, company_name, email, phone_mobile, is_test_data),
        assigned_user:assigned_user_id(id, name)
      `)
      .eq('id', params.id)
      .single()

    if (conversationError || !conversation) {
      return Response.json({ success: false, error: 'Gespräch nicht gefunden' }, { status: 404 })
    }
    const linkedContact = Array.isArray(conversation.contact) ? conversation.contact[0] : conversation.contact
    if (!currentUser.showTestData && linkedContact?.is_test_data === true) {
      return Response.json({ success: false, error: 'Gespräch nicht gefunden' }, { status: 404 })
    }

    const { data: messages, error: messagesError } = await supabase
      .from('communication_messages')
      .select('id, direction, message_type, text_content, sender_name, sent_at, delivery_status, attachment_metadata')
      .eq('conversation_id', params.id)
      .order('sent_at', { ascending: true })

    if (messagesError) {
      console.error('[GET /api/kommunikation/conversations/:id] Nachrichtenfehler:', messagesError.code)
      return Response.json({ success: false, error: 'Nachrichten konnten nicht geladen werden' }, { status: 500 })
    }

    return Response.json({
      success: true,
      data: { ...mapConversation(conversation as any), messages: (messages ?? []).map((row: any) => mapMessage(row)) },
    })
  } catch (error) {
    console.error('[GET /api/kommunikation/conversations/:id] Unerwarteter Fehler:', error)
    return Response.json({ success: false, error: 'Gespräch konnte nicht geladen werden' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) return Response.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 })
    if (!UUID_PATTERN.test(params.id)) return Response.json({ success: false, error: 'Ungültige Gesprächs-ID' }, { status: 400 })

    const body = await request.json()
    const updates: Record<string, unknown> = {}
    if (body.status !== undefined) {
      if (!VALID_STATUSES.includes(body.status)) return Response.json({ success: false, error: 'Ungültiger Status' }, { status: 400 })
      updates.status = body.status
      updates.snoozed_until = body.status === 'snoozed' ? body.snoozedUntil ?? null : null
    }
    if (body.assignedUserId !== undefined) {
      if (body.assignedUserId !== null && !UUID_PATTERN.test(body.assignedUserId)) {
        return Response.json({ success: false, error: 'Ungültiger Verantwortlicher' }, { status: 400 })
      }
      updates.assigned_user_id = body.assignedUserId
    }
    if (body.markRead === true) updates.unread_count = 0
    if (Object.keys(updates).length === 0) {
      return Response.json({ success: false, error: 'Keine gültige Änderung angegeben' }, { status: 400 })
    }

    const supabase = createServerClient()
    const { error } = await supabase.from('communication_conversations').update(updates).eq('id', params.id)
    if (error) {
      console.error('[PATCH /api/kommunikation/conversations/:id] Datenbankfehler:', error.code)
      return Response.json({ success: false, error: 'Gespräch konnte nicht aktualisiert werden' }, { status: 500 })
    }
    return Response.json({ success: true })
  } catch (error) {
    console.error('[PATCH /api/kommunikation/conversations/:id] Unerwarteter Fehler:', error)
    return Response.json({ success: false, error: 'Gespräch konnte nicht aktualisiert werden' }, { status: 500 })
  }
}

