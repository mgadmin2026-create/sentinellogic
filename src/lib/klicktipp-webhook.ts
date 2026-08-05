import { createHash, timingSafeEqual } from 'node:crypto'

export const MAX_KLICKTIPP_WEBHOOK_BYTES = 64 * 1024

export type KlickTippEmailStatus =
  | 'subscribed'
  | 'opt_in_pending'
  | 'unsubscribed'
  | 'soft_bounce'
  | 'hard_bounce'
  | 'unknown'

export interface ParsedKlickTippWebhook {
  eventType: string
  eventId: string | null
  email: string | null
  klicktippId: string | null
  occurredAt: string
  emailStatus: KlickTippEmailStatus | null
  campaignName: string | null
  messageName: string | null
  tagName: string | null
  linkLabel: string | null
  suppliedToken: string | null
  redactedPayload: Record<string, unknown>
}

type Payload = Record<string, unknown>

function stringValue(payload: Payload, keys: string[]): string | null {
  for (const key of keys) {
    const value = payload[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return null
}

function normalizeEventType(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 100)
}

export function normalizeKlickTippEmailStatus(value: unknown): KlickTippEmailStatus | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const normalized = normalizeEventType(value)
  if (['subscribed', 'confirmed', 'bestaetigt', 'bestatigt', 'active'].includes(normalized)) return 'subscribed'
  if (['opt_in_pending', 'optin_pending', 'pending', 'schwebend'].includes(normalized)) return 'opt_in_pending'
  if (['unsubscribed', 'signed_off', 'signoff', 'ausgetragen', 'abgemeldet'].includes(normalized)) return 'unsubscribed'
  if (['soft_bounce', 'softbounce'].includes(normalized)) return 'soft_bounce'
  if (['hard_bounce', 'hardbounce'].includes(normalized)) return 'hard_bounce'
  if (normalized === 'unknown') return 'unknown'
  return null
}

function parseOccurredAt(value: string | null): string {
  if (!value) return new Date().toISOString()
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}

export function parseKlickTippWebhook(rawBody: string, contentType: string): ParsedKlickTippWebhook {
  let payload: Payload
  if (contentType.toLowerCase().includes('application/json')) {
    const parsed = JSON.parse(rawBody) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Payload muss ein JSON-Objekt sein')
    payload = parsed as Payload
  } else if (contentType.toLowerCase().includes('application/x-www-form-urlencoded')) {
    payload = Object.fromEntries(new URLSearchParams(rawBody).entries())
  } else {
    throw new Error('Nicht unterstützter Content-Type')
  }

  const rawEvent = stringValue(payload, ['event_type', 'eventType', 'event', 'type'])
  if (!rawEvent) throw new Error('Eventtyp fehlt')
  const email = stringValue(payload, ['email', 'fieldEmail'])?.toLowerCase() ?? null
  const statusValue = stringValue(payload, ['email_status', 'emailStatus', 'subscription_status', 'status'])

  return {
    eventType: normalizeEventType(rawEvent),
    eventId: stringValue(payload, ['event_id', 'eventId']),
    email,
    klicktippId: stringValue(payload, ['klicktipp_id', 'subscriber_id', 'subscriberId', 'id']),
    occurredAt: parseOccurredAt(stringValue(payload, ['occurred_at', 'occurredAt', 'timestamp', 'created_at'])),
    emailStatus: normalizeKlickTippEmailStatus(statusValue) ?? normalizeKlickTippEmailStatus(rawEvent),
    campaignName: stringValue(payload, ['campaign_name', 'campaignName', 'campaign'])?.slice(0, 300) ?? null,
    messageName: stringValue(payload, ['message_name', 'messageName', 'email_name', 'emailName'])?.slice(0, 300) ?? null,
    tagName: stringValue(payload, ['tag_name', 'tagName', 'tag'])?.slice(0, 200) ?? null,
    linkLabel: stringValue(payload, ['link_label', 'linkLabel', 'link_name', 'linkName'])?.slice(0, 300) ?? null,
    suppliedToken: stringValue(payload, ['webhook_token', 'webhookToken', 'apiKey']),
    redactedPayload: { payload_fields: Object.keys(payload).filter((key) => !['webhook_token', 'webhookToken', 'apiKey'].includes(key)).sort() },
  }
}

export function verifyKlickTippWebhookToken(providedToken: string | null): boolean {
  const expected = process.env.KLICKTIPP_WEBHOOK_SECRET?.trim()
  if (!expected || expected.length < 32 || !providedToken) return false
  const expectedBuffer = Buffer.from(expected)
  const providedBuffer = Buffer.from(providedToken)
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer)
}

export function fingerprintKlickTippWebhook(rawBody: string, eventId: string | null): string {
  return createHash('sha256').update(eventId ? `id:${eventId}` : rawBody).digest('hex')
}
