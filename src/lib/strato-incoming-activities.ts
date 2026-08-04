// Übernimmt neue eingehende STRATO-Nachrichten idempotent in die
// Kontaktaktivitäten. Nachrichtentexte und Absenderadressen werden nicht
// dauerhaft gespeichert.
import 'server-only'

import { createHash } from 'crypto'
import { createServerClient } from '@/lib/supabase/server'
import type { MailListItem, MailboxPage } from '@/types/postfach'

function buildEventKey(account: string, uidValidity: string, message: MailListItem): string {
  const technicalMessageKey = message.messageId?.trim() || `${uidValidity}:${message.uid}`
  return createHash('sha256')
    .update(`${account.trim().toLowerCase()}:${technicalMessageKey}`)
    .digest('hex')
}

/**
 * Protokolliert eindeutig zuordenbare E-Mails. Einzelne Fehler blockieren den
 * Posteingang nicht; sie werden beim nächsten Aktualisieren erneut versucht.
 */
export async function syncIncomingMailActivities(mailbox: MailboxPage): Promise<number> {
  const candidates = mailbox.messages.flatMap((message) => {
    const senderEmail = message.from[0]?.address.trim()
    if (!senderEmail) return []
    return [{ message, senderEmail }]
  })

  if (candidates.length === 0) return 0

  const supabase = createServerClient()
  const messages = candidates.map(({ message, senderEmail }) => ({
    event_key: buildEventKey(mailbox.account, mailbox.uidValidity, message),
    sender_email: senderEmail,
    mailbox_uid: message.uid,
    uid_validity: mailbox.uidValidity,
    message_id: message.messageId,
    subject: message.subject,
    received_at: message.date,
  }))

  const { data, error } = await supabase.rpc('log_incoming_strato_emails', {
    p_messages: messages,
  })

  if (error) {
    // Keine E-Mail-Adresse, Betreffzeile oder sonstige Kundendaten loggen.
    console.error('[STRATO-E-Mail-Aktivitäten] Nachrichten konnten nicht protokolliert werden:', error.code || 'DB_FEHLER')
    return 0
  }

  return typeof data === 'number' ? data : 0
}
