// Server-seitige STRATO-Postfach-Anbindung über verschlüsseltes IMAP und SMTP.
// Zugangsdaten dürfen ausschließlich aus Umgebungsvariablen kommen.
import 'server-only'

import { ImapFlow, type FetchMessageObject } from 'imapflow'
import { simpleParser, type AddressObject } from 'mailparser'
import nodemailer from 'nodemailer'
import type { MailAddress, MailDetail, MailListItem, MailboxPage } from '@/types/postfach'

const DEFAULT_IMAP_HOST = 'imap.strato.de'
const DEFAULT_SMTP_HOST = 'smtp.strato.de'
const DEFAULT_PAGE_SIZE = 30

export class StratoMailConfigurationError extends Error {
  constructor() {
    super('Das STRATO-Postfach ist noch nicht vollständig konfiguriert.')
    this.name = 'StratoMailConfigurationError'
  }
}

interface StratoMailConfig {
  user: string
  password: string
  imapHost: string
  imapPort: number
  smtpHost: string
  smtpPort: number
  senderName: string
}

function getConfig(): StratoMailConfig {
  const user = process.env.STRATO_MAIL_USER?.trim()
  const password = process.env.STRATO_MAIL_PASSWORD

  if (!user || !password) throw new StratoMailConfigurationError()

  return {
    user,
    password,
    imapHost: process.env.STRATO_IMAP_HOST?.trim() || DEFAULT_IMAP_HOST,
    imapPort: Number(process.env.STRATO_IMAP_PORT || 993),
    smtpHost: process.env.STRATO_SMTP_HOST?.trim() || DEFAULT_SMTP_HOST,
    smtpPort: Number(process.env.STRATO_SMTP_PORT || 465),
    senderName: process.env.STRATO_MAIL_SENDER_NAME?.trim() || 'Allianz Generalvertretung Gün',
  }
}

export function isStratoMailboxConfigured(): boolean {
  return Boolean(process.env.STRATO_MAIL_USER?.trim() && process.env.STRATO_MAIL_PASSWORD)
}

function createImapClient(config: StratoMailConfig): ImapFlow {
  return new ImapFlow({
    host: config.imapHost,
    port: config.imapPort,
    secure: true,
    auth: { user: config.user, pass: config.password },
    logger: false,
    tls: { minVersion: 'TLSv1.2' },
  })
}

function addresses(value: AddressObject | AddressObject[] | undefined): MailAddress[] {
  const objects = Array.isArray(value) ? value : value ? [value] : []
  return objects.flatMap((object) => object.value.map((entry) => ({
    name: entry.name || '',
    address: entry.address || '',
  }))).filter((entry) => entry.address)
}

function envelopeAddresses(value: Array<{ name?: string; address?: string }> | undefined): MailAddress[] {
  return (value || []).map((entry) => ({
    name: entry.name || '',
    address: entry.address || '',
  })).filter((entry) => entry.address)
}

function listItem(message: FetchMessageObject): MailListItem {
  const flags = message.flags || new Set<string>()
  const rawDate = message.envelope?.date || message.internalDate
  return {
    uid: message.uid,
    subject: message.envelope?.subject || '(Kein Betreff)',
    from: envelopeAddresses(message.envelope?.from),
    to: envelopeAddresses(message.envelope?.to),
    date: rawDate ? new Date(rawDate).toISOString() : null,
    seen: flags.has('\\Seen'),
    answered: flags.has('\\Answered'),
    hasAttachments: Boolean(message.bodyStructure?.childNodes?.some((part) =>
      part.disposition === 'attachment' || Boolean(part.dispositionParameters?.filename)
    )),
  }
}

export async function listInbox(page = 1, pageSize = DEFAULT_PAGE_SIZE): Promise<MailboxPage> {
  const config = getConfig()
  const client = createImapClient(config)
  const safePage = Math.max(1, Math.floor(page))
  const safePageSize = Math.min(50, Math.max(1, Math.floor(pageSize)))

  try {
    await client.connect()
    const mailbox = await client.mailboxOpen('INBOX')
    if (mailbox.exists === 0) {
      return { account: config.user, messages: [], total: 0, page: safePage, pageSize: safePageSize }
    }

    const end = Math.max(0, mailbox.exists - (safePage - 1) * safePageSize)
    if (end === 0) {
      return { account: config.user, messages: [], total: mailbox.exists, page: safePage, pageSize: safePageSize }
    }
    const start = Math.max(1, end - safePageSize + 1)
    const messages: MailListItem[] = []

    for await (const message of client.fetch(`${start}:${end}`, {
      uid: true,
      envelope: true,
      flags: true,
      internalDate: true,
      bodyStructure: true,
    })) {
      messages.push(listItem(message))
    }

    messages.sort((a, b) => b.uid - a.uid)
    return { account: config.user, messages, total: mailbox.exists, page: safePage, pageSize: safePageSize }
  } finally {
    if (client.usable) await client.logout().catch(() => undefined)
    else client.close()
  }
}

export async function getInboxMessage(uid: number): Promise<MailDetail | null> {
  const config = getConfig()
  const client = createImapClient(config)

  try {
    await client.connect()
    await client.mailboxOpen('INBOX')
    const message = await client.fetchOne(uid, {
      uid: true,
      envelope: true,
      flags: true,
      internalDate: true,
      bodyStructure: true,
      source: true,
    }, { uid: true })

    if (!message || !message.source) return null
    const parsed = await simpleParser(message.source)
    await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true })

    const base = listItem(message)
    return {
      ...base,
      from: addresses(parsed.from),
      to: addresses(parsed.to),
      cc: addresses(parsed.cc),
      text: parsed.text?.trim() || 'Diese Nachricht enthält keinen darstellbaren Textinhalt.',
      messageId: parsed.messageId || null,
      inReplyTo: parsed.inReplyTo || null,
      attachments: parsed.attachments.map((attachment) => ({
        filename: attachment.filename || 'Anhang',
        contentType: attachment.contentType,
        size: attachment.size,
      })),
      contact: null,
    }
  } finally {
    if (client.usable) await client.logout().catch(() => undefined)
    else client.close()
  }
}

export interface StratoMailAttachment {
  filename: string
  content: Buffer
  contentType?: string
}

export async function sendStratoMail(params: {
  to: string | string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  text: string
  html?: string
  inReplyTo?: string
  references?: string[]
  attachments?: StratoMailAttachment[]
}): Promise<{ messageId: string }> {
  const config = getConfig()
  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: true,
    requireTLS: true,
    auth: { user: config.user, pass: config.password },
    tls: { minVersion: 'TLSv1.2' },
  })

  const result = await transporter.sendMail({
    from: { name: config.senderName, address: config.user },
    to: params.to,
    cc: params.cc?.length ? params.cc : undefined,
    bcc: params.bcc?.length ? params.bcc : undefined,
    subject: params.subject,
    text: params.text,
    html: params.html,
    inReplyTo: params.inReplyTo,
    references: params.references,
    attachments: params.attachments,
  })

  return { messageId: result.messageId }
}
