export type CommunicationChannel = 'whatsapp' | 'email' | 'webchat' | 'sms'
export type ConversationStatus = 'open' | 'snoozed' | 'done'
export type ConversationView = 'open' | 'mine' | 'unassigned' | 'unread' | 'snoozed' | 'done'
export type MessageDirection = 'inbound' | 'outbound' | 'internal'
export type MessageType = 'text' | 'image' | 'document' | 'audio' | 'template' | 'note' | 'system'
export type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'received'

export interface InboxContact {
  id: string
  firstName: string
  lastName: string
  companyName: string | null
  email: string | null
  phone: string | null
}

export interface InboxUser {
  id: string
  name: string
}

export interface ConversationListItem {
  id: string
  provider: string
  providerConversationId: string
  channel: CommunicationChannel
  status: ConversationStatus
  unreadCount: number
  lastMessagePreview: string | null
  lastMessageAt: string | null
  snoozedUntil: string | null
  contact: InboxContact | null
  assignedUser: InboxUser | null
}

export interface InboxMessage {
  id: string
  direction: MessageDirection
  messageType: MessageType
  textContent: string | null
  senderName: string | null
  sentAt: string
  deliveryStatus: DeliveryStatus
  attachmentMetadata: Array<{ name?: string; url?: string; mimeType?: string; size?: number }>
}

export interface ConversationDetail extends ConversationListItem {
  messages: InboxMessage[]
}

export interface InboxCounts {
  open: number
  mine: number
  unassigned: number
  unread: number
  snoozed: number
  done: number
}

