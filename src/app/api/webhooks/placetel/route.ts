import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { normalizePhoneNumber } from '@/lib/phone'
import {
  fingerprintPlacetelWebhook,
  MAX_PLACETEL_WEBHOOK_BYTES,
  parsePlacetelWebhook,
  type ParsedPlacetelWebhook,
  verifyPlacetelWebhookSignature,
} from '@/lib/placetel-webhook'

const TERMINAL_STATUSES = new Set([
  'completed', 'missed', 'blocked', 'voicemail',
  'busy', 'canceled', 'unavailable', 'congestion',
])

interface ContactPhoneRow {
  id: string
  phone_mobile: string | null
  phone_office: string | null
}

async function findContactIdByPhone(phone: string | null): Promise<{ contactId: string | null; ambiguous: boolean }> {
  if (!phone) return { contactId: null, ambiguous: false }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('contacts')
    .select('id, phone_mobile, phone_office')
    .is('archived_at', null)
    .limit(5_000)

  if (error) throw new Error(`Kontaktabgleich fehlgeschlagen: ${error.message}`)

  const matches = ((data ?? []) as ContactPhoneRow[]).filter((contact) =>
    normalizePhoneNumber(contact.phone_mobile) === phone || normalizePhoneNumber(contact.phone_office) === phone
  )

  return {
    contactId: matches.length === 1 ? matches[0].id : null,
    ambiguous: matches.length > 1,
  }
}

async function findExistingCall(event: ParsedPlacetelWebhook) {
  const supabase = createServerClient()

  if (event.placetelCallId) {
    const { data } = await supabase
      .from('call_logs')
      .select('id, contact_id, direction, started_at')
      .eq('placetel_call_id', event.placetelCallId)
      .maybeSingle()
    if (data) return data
  }

  if (!event.remoteNumber) return null

  const tenMinutesAgo = new Date(Date.now() - 10 * 60_000).toISOString()
  let query = supabase
    .from('call_logs')
    .select('id, contact_id, direction, started_at')
    .eq('remote_number_normalized', event.remoteNumber)
    .gte('started_at', tenMinutesAgo)
    .order('started_at', { ascending: false })
    .limit(2)

  if (event.direction) query = query.eq('direction', event.direction)

  const { data } = await query
  return data?.length === 1 ? data[0] : null
}

async function processWebhook(event: ParsedPlacetelWebhook): Promise<'processed' | 'ignored'> {
  if (!event.status) return 'ignored'

  const supabase = createServerClient()
  const existingCall = await findExistingCall(event)
  const effectiveDirection = event.direction || existingCall?.direction || null

  if (existingCall) {
    const updates: Record<string, unknown> = {
      status: event.status,
      provider_payload: { event_type: event.eventType },
    }
    if (event.placetelCallId) updates.placetel_call_id = event.placetelCallId
    if (event.sipuid) updates.sipuid = event.sipuid
    if (event.status === 'accepted') updates.accepted_at = event.occurredAt
    if (TERMINAL_STATUSES.has(event.status)) {
      updates.ended_at = event.occurredAt
    }
    if (event.durationSeconds !== null) updates.duration_seconds = event.durationSeconds

    const { error } = await supabase.from('call_logs').update(updates).eq('id', existingCall.id)
    if (error) throw new Error(`Anrufaktualisierung fehlgeschlagen: ${error.message}`)

    if (TERMINAL_STATUSES.has(event.status) && existingCall.contact_id) {
      await supabase.from('activities').insert({
        lead_id: existingCall.contact_id,
        type: 'placetel_call_completed',
        description: 'Placetel-Anruf beendet',
        data: { call_log_id: existingCall.id },
      })
    }
    return 'processed'
  }

  if (!effectiveDirection || !event.remoteNumber) return 'ignored'

  const contactMatch = await findContactIdByPhone(event.remoteNumber)
  const terminalStatus = TERMINAL_STATUSES.has(event.status)
  const { error } = await supabase.from('call_logs').insert({
    contact_id: contactMatch.contactId,
    placetel_call_id: event.placetelCallId,
    direction: effectiveDirection,
    status: event.status,
    from_number: event.fromNumber,
    to_number: event.toNumber,
    remote_number_normalized: event.remoteNumber,
    started_at: event.occurredAt,
    accepted_at: event.status === 'accepted' ? event.occurredAt : null,
    ended_at: terminalStatus ? event.occurredAt : null,
    duration_seconds: event.durationSeconds,
    sipuid: event.sipuid,
    provider_payload: { event_type: event.eventType },
    reconciliation_state: contactMatch.ambiguous ? 'ambiguous' : contactMatch.contactId ? 'matched' : 'pending',
  })

  if (error) throw new Error(`Anrufanlage fehlgeschlagen: ${error.message}`)
  return 'processed'
}

export async function POST(request: NextRequest) {
  const declaredLength = Number.parseInt(request.headers.get('content-length') || '0', 10)
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PLACETEL_WEBHOOK_BYTES) {
    return new Response('Payload too large', { status: 413 })
  }

  let rawBody = ''
  try {
    rawBody = await request.text()
    if (new TextEncoder().encode(rawBody).byteLength > MAX_PLACETEL_WEBHOOK_BYTES) {
      return new Response('Payload too large', { status: 413 })
    }

    if (!verifyPlacetelWebhookSignature(rawBody, request.headers.get('x-placetel-signature'))) {
      return new Response('Unauthorized', { status: 401 })
    }

    const event = parsePlacetelWebhook(rawBody, request.headers.get('content-type') || '')
    const fingerprint = fingerprintPlacetelWebhook(rawBody)
    const supabase = createServerClient()

    const { data: storedEvent, error: insertError } = await supabase
      .from('placetel_webhook_events')
      .insert({
        event_fingerprint: fingerprint,
        event_type: event.eventType,
        placetel_call_id: event.placetelCallId,
        redacted_payload: event.redactedPayload,
      })
      .select('id')
      .single()

    if (insertError?.code === '23505') {
      return Response.json({ success: true, duplicate: true })
    }
    if (insertError || !storedEvent) {
      console.error('[POST /api/webhooks/placetel] Event konnte nicht gespeichert werden:', insertError?.message)
      return new Response('Temporary failure', { status: 503 })
    }

    try {
      const processingStatus = await processWebhook(event)
      await supabase
        .from('placetel_webhook_events')
        .update({ processing_status: processingStatus, processed_at: new Date().toISOString() })
        .eq('id', storedEvent.id)

      return Response.json({ success: true, processed: processingStatus === 'processed' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unbekannter Verarbeitungsfehler'
      await supabase
        .from('placetel_webhook_events')
        .update({
          processing_status: 'failed',
          processed_at: new Date().toISOString(),
          processing_error: message.slice(0, 500),
        })
        .eq('id', storedEvent.id)

      console.error('[POST /api/webhooks/placetel] Verarbeitung fehlgeschlagen:', message)
      return new Response('Temporary failure', { status: 503 })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ungültiger Callback'
    console.error('[POST /api/webhooks/placetel] Callback abgelehnt:', message)
    return new Response('Invalid payload', { status: 400 })
  }
}

export async function GET() {
  return Response.json({ service: 'Placetel Webhook', status: 'ready' })
}
