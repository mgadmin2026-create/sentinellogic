import { createHash, timingSafeEqual } from 'crypto'
import { normalizePhoneNumber } from '@/lib/phone'
import type { PlacetelCallDirection, PlacetelCallStatus } from '@/types/placetel'

export const MAX_PLACETEL_WEBHOOK_BYTES = 64 * 1024

export interface ParsedPlacetelWebhook {
  eventType: string
  placetelCallId: string | null
  direction: PlacetelCallDirection | null
  status: PlacetelCallStatus | null
  fromNumber: string | null
  toNumber: string | null
  remoteNumber: string | null
  occurredAt: string
  durationSeconds: number | null
  redactedPayload: Record<string, unknown>
}
function stringValue(payload: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = payload[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return null
}

function normalizeEventName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function deriveDirection(eventName: string, rawDirection: string | null): PlacetelCallDirection | null {
  const direction = rawDirection ? normalizeEventName(rawDirection) : ''
  if (direction === 'incoming' || direction === 'inbound' || direction === 'in') return 'incoming'
  if (direction === 'outgoing' || direction === 'outbound' || direction === 'out') return 'outgoing'
  if (eventName.includes('incoming') || eventName.includes('inbound')) return 'incoming'
  if (eventName.includes('outgoing') || eventName.includes('outbound')) return 'outgoing'
  return null
}

function deriveStatus(eventName: string): PlacetelCallStatus | null {
  if (eventName.includes('hungup') || eventName.includes('hangup') || eventName.includes('completed')) return 'completed'
  if (eventName.includes('accepted') || eventName.includes('answered')) return 'accepted'
  if (eventName.includes('voicemail')) return 'voicemail'
  if (eventName.includes('missed')) return 'missed'
  if (eventName.includes('blocked')) return 'blocked'
  if (eventName.includes('incoming') || eventName.includes('outgoing') || eventName.includes('newcall')) return 'ringing'
  return null
}

function parseOccurredAt(value: string | null): string {
  if (!value) return new Date().toISOString()
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}

function parseDuration(value: string | null): number | null {
  if (!value) return null
  const duration = Number.parseInt(value, 10)
  return Number.isFinite(duration) && duration >= 0 ? duration : null
}

export function verifyPlacetelWebhookToken(providedToken: string | null): boolean {
  const expectedToken = process.env.PLACETEL_WEBHOOK_TOKEN?.trim()
  if (!expectedToken || expectedToken.length < 32 || !providedToken) return false

  const expectedHash = createHash('sha256').update(expectedToken).digest()
  const providedHash = createHash('sha256').update(providedToken).digest()
  return timingSafeEqual(expectedHash, providedHash)
}

export function parsePlacetelWebhook(rawBody: string, contentType: string): ParsedPlacetelWebhook {
  let payload: Record<string, unknown>

  if (contentType.toLowerCase().includes('application/json')) {
    const parsed = JSON.parse(rawBody) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Callback-Payload muss ein JSON-Objekt sein')
    }
    payload = parsed as Record<string, unknown>
  } else if (contentType.toLowerCase().includes('application/x-www-form-urlencoded')) {
    payload = Object.fromEntries(new URLSearchParams(rawBody).entries())
  } else {
    throw new Error('Nicht unterstützter Callback-Content-Type')
  }

  const rawEvent = stringValue(payload, ['event', 'event_type', 'eventType', 'type', 'status'])
  if (!rawEvent) throw new Error('Callback enthält keinen Eventtyp')

  const eventType = normalizeEventName(rawEvent)
  const direction = deriveDirection(eventType, stringValue(payload, ['direction', 'call_direction']))
  const status = deriveStatus(eventType)
  const fromNumber = normalizePhoneNumber(stringValue(payload, ['from', 'from_number', 'fromNumber', 'caller']))
  const toNumber = normalizePhoneNumber(stringValue(payload, ['to', 'to_number', 'toNumber', 'callee', 'target']))
  const remoteNumber = direction === 'incoming' ? fromNumber : direction === 'outgoing' ? toNumber : fromNumber || toNumber
  const placetelCallId = stringValue(payload, ['call_id', 'callId', 'id'])
  const occurredAt = parseOccurredAt(stringValue(payload, ['occurred_at', 'timestamp', 'received_at', 'created_at']))
  const durationSeconds = parseDuration(stringValue(payload, ['duration', 'duration_seconds', 'length']))

  return {
    eventType,
    placetelCallId,
    direction,
    status,
    fromNumber,
    toNumber,
    remoteNumber,
    occurredAt,
    durationSeconds,
    redactedPayload: {
      event_type: eventType,
      placetel_call_id: placetelCallId,
      direction,
      status,
      payload_fields: Object.keys(payload).sort(),
    },
  }
}

export function fingerprintPlacetelWebhook(rawBody: string): string {
  return createHash('sha256').update(rawBody).digest('hex')
}
