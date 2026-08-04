export interface MailAddress {
  name: string
  address: string
}

export interface MailListItem {
  uid: number
  subject: string
  from: MailAddress[]
  to: MailAddress[]
  date: string | null
  seen: boolean
  answered: boolean
  hasAttachments: boolean
}

export interface MailAttachmentInfo {
  filename: string
  contentType: string
  size: number
}

export interface MailDetail extends MailListItem {
  cc: MailAddress[]
  text: string
  messageId: string | null
  inReplyTo: string | null
  attachments: MailAttachmentInfo[]
  contact: { id: string; name: string } | null
}

export interface MailboxPage {
  account: string
  messages: MailListItem[]
  total: number
  page: number
  pageSize: number
}
