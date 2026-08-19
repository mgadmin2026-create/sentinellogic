import type { ConversationListItem, InboxMessage } from '@/types/communication'

type Relation<T> = T | T[] | null

interface ConversationRow {
  id: string
  provider: string
  provider_conversation_id: string
  channel: ConversationListItem['channel']
  status: ConversationListItem['status']
  unread_count: number
  last_message_preview: string | null
  last_message_at: string | null
  snoozed_until: string | null
  contact: Relation<{
    id: string
    first_name: string | null
    last_name: string | null
    company_name: string | null
    email: string | null
    phone_mobile: string | null
  }>
  assigned_user: Relation<{ id: string; name: string }>
}

interface MessageRow {
  id: string
  direction: InboxMessage['direction']
  message_type: InboxMessage['messageType']
  text_content: string | null
  sender_name: string | null
  sent_at: string
  delivery_status: InboxMessage['deliveryStatus']
  attachment_metadata: InboxMessage['attachmentMetadata'] | null
}

function firstRelation<T>(relation: Relation<T>): T | null {
  if (Array.isArray(relation)) return relation[0] ?? null
  return relation
}

export function mapConversation(row: ConversationRow): ConversationListItem {
  const contact = firstRelation(row.contact)
  const assignedUser = firstRelation(row.assigned_user)

  return {
    id: row.id,
    provider: row.provider,
    providerConversationId: row.provider_conversation_id,
    channel: row.channel,
    status: row.status,
    unreadCount: row.unread_count,
    lastMessagePreview: row.last_message_preview,
    lastMessageAt: row.last_message_at,
    snoozedUntil: row.snoozed_until,
    contact: contact ? {
      id: contact.id,
      firstName: contact.first_name ?? '',
      lastName: contact.last_name ?? '',
      companyName: contact.company_name,
      email: contact.email,
      phone: contact.phone_mobile,
    } : null,
    assignedUser: assignedUser ? { id: assignedUser.id, name: assignedUser.name } : null,
  }
}

export function mapMessage(row: MessageRow): InboxMessage {
  return {
    id: row.id,
    direction: row.direction,
    messageType: row.message_type,
    textContent: row.text_content,
    senderName: row.sender_name,
    sentAt: row.sent_at,
    deliveryStatus: row.delivery_status,
    attachmentMetadata: Array.isArray(row.attachment_metadata) ? row.attachment_metadata : [],
  }
}

