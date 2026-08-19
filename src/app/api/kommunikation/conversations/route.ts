import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { mapConversation } from '@/lib/communication-inbox'
import { createServerClient } from '@/lib/supabase/server'
import type { ConversationListItem, ConversationView, InboxCounts } from '@/types/communication'

export const dynamic = 'force-dynamic'

const VALID_VIEWS: ConversationView[] = ['open', 'mine', 'unassigned', 'unread', 'snoozed', 'done']

function matchesSearch(conversation: ConversationListItem, search: string): boolean {
  if (!search) return true
  const contact = conversation.contact
  const searchable = [
    contact?.firstName,
    contact?.lastName,
    contact?.companyName,
    contact?.email,
    contact?.phone,
    conversation.lastMessagePreview,
  ].filter(Boolean).join(' ').toLocaleLowerCase('de-DE')
  return searchable.includes(search.toLocaleLowerCase('de-DE'))
}

function matchesView(conversation: ConversationListItem, view: ConversationView, userId: string): boolean {
  if (view === 'mine') return conversation.status === 'open' && conversation.assignedUser?.id === userId
  if (view === 'unassigned') return conversation.status === 'open' && !conversation.assignedUser
  if (view === 'unread') return conversation.status !== 'done' && conversation.unreadCount > 0
  return conversation.status === view
}

function countViews(conversations: ConversationListItem[], userId: string): InboxCounts {
  return {
    open: conversations.filter((item) => item.status === 'open').length,
    mine: conversations.filter((item) => item.status === 'open' && item.assignedUser?.id === userId).length,
    unassigned: conversations.filter((item) => item.status === 'open' && !item.assignedUser).length,
    unread: conversations.filter((item) => item.status !== 'done' && item.unreadCount > 0).length,
    snoozed: conversations.filter((item) => item.status === 'snoozed').length,
    done: conversations.filter((item) => item.status === 'done').length,
  }
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return Response.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 })
    }

    const url = new URL(request.url)
    const requestedView = url.searchParams.get('view') as ConversationView | null
    const view = requestedView && VALID_VIEWS.includes(requestedView) ? requestedView : 'open'
    const search = url.searchParams.get('search')?.trim() ?? ''

    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('communication_conversations')
      .select(`
        id, provider, provider_conversation_id, channel, status, unread_count,
        last_message_preview, last_message_at, snoozed_until,
        contact:contact_id(id, first_name, last_name, company_name, email, phone_mobile, is_test_data),
        assigned_user:assigned_user_id(id, name)
      `)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(500)

    if (error) {
      console.error('[GET /api/kommunikation/conversations] Datenbankfehler:', error.code)
      return Response.json({ success: false, error: 'Gespräche konnten nicht geladen werden' }, { status: 500 })
    }

    const visibleRows = currentUser.showTestData
      ? data ?? []
      : (data ?? []).filter((row: any) => {
          const contact = Array.isArray(row.contact) ? row.contact[0] : row.contact
          return contact?.is_test_data !== true
        })
    const conversations = visibleRows.map((row: any) => mapConversation(row))
    const filtered = conversations
      .filter((conversation) => matchesView(conversation, view, currentUser.id))
      .filter((conversation) => matchesSearch(conversation, search))

    return Response.json({
      success: true,
      data: filtered,
      counts: countViews(conversations, currentUser.id),
      currentUser: { id: currentUser.id, name: currentUser.name },
    })
  } catch (error) {
    console.error('[GET /api/kommunikation/conversations] Unerwarteter Fehler:', error)
    return Response.json({ success: false, error: 'Gespräche konnten nicht geladen werden' }, { status: 500 })
  }
}

