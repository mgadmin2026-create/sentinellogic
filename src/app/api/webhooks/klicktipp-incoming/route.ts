import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import {
  fingerprintKlickTippWebhook,
  MAX_KLICKTIPP_WEBHOOK_BYTES,
  parseKlickTippWebhook,
  verifyKlickTippWebhookToken,
  type ParsedKlickTippWebhook,
} from '@/lib/klicktipp-webhook'

async function findContact(event: ParsedKlickTippWebhook): Promise<{ id: string } | null> {
  const supabase = createServerClient()
  if (event.klicktippId) {
    const { data } = await supabase.from('contacts').select('id').eq('klicktipp_id', event.klicktippId).limit(2)
    if (data?.length === 1) return data[0]
    if (data && data.length > 1) return null
  }
  if (!event.email) return null
  const { data } = await supabase.from('contacts').select('id').ilike('email', event.email).limit(2)
  return data?.length === 1 ? data[0] : null
}

function activityFor(event: ParsedKlickTippWebhook): { type: string; description: string } {
  const descriptions: Record<string, string> = {
    email_received: 'KlickTipp-E-Mail erhalten',
    email_opened: 'KlickTipp-E-Mail geöffnet',
    email_clicked: 'Link in KlickTipp-E-Mail angeklickt',
    campaign_started: 'KlickTipp-Kampagne gestartet',
    campaign_finished: 'KlickTipp-Kampagne beendet',
    tag_added: 'KlickTipp-Tag vergeben',
    tag_removed: 'KlickTipp-Tag entfernt',
    subscribed: 'KlickTipp-Anmeldung bestätigt',
    opt_in_pending: 'KlickTipp-Anmeldung noch unbestätigt',
    unsubscribed: 'Kontakt bei KlickTipp abgemeldet',
    soft_bounce: 'KlickTipp meldet einen Soft-Bounce',
    hard_bounce: 'KlickTipp meldet einen Hard-Bounce',
  }
  const base = descriptions[event.eventType] ?? `KlickTipp-Ereignis: ${event.eventType}`
  const detail = event.messageName || event.campaignName || event.tagName || event.linkLabel
  return { type: `klicktipp_${event.eventType}`, description: detail ? `${base}: ${detail}` : base }
}

async function processEvent(event: ParsedKlickTippWebhook, contact: { id: string }, fingerprint: string): Promise<void> {
  const supabase = createServerClient()
  const updates: Record<string, unknown> = { klicktipp_last_event_at: event.occurredAt }
  if (event.emailStatus) {
    updates.klicktipp_email_status = event.emailStatus
    updates.klicktipp_status_updated_at = event.occurredAt
  }
  if (event.klicktippId) updates.klicktipp_id = event.klicktippId

  const { error: updateError } = await supabase.from('contacts').update(updates).eq('id', contact.id)
  if (updateError) throw new Error(`Kontaktstatus konnte nicht aktualisiert werden: ${updateError.message}`)

  const activity = activityFor(event)
  const { error: activityError } = await supabase.from('activities').insert({
    lead_id: contact.id,
    external_event_key: `klicktipp:${fingerprint}`,
    type: activity.type,
    description: activity.description,
    data: {
      channel: 'klicktipp',
      campaign_name: event.campaignName,
      message_name: event.messageName,
      tag_name: event.tagName,
      link_label: event.linkLabel,
      email_status: event.emailStatus,
    },
    created_at: event.occurredAt,
  })
  if (activityError && activityError.code !== '23505') throw new Error(`Aktivität konnte nicht gespeichert werden: ${activityError.message}`)
}

export async function POST(request: NextRequest) {
  const declaredLength = Number.parseInt(request.headers.get('content-length') || '0', 10)
  if (Number.isFinite(declaredLength) && declaredLength > MAX_KLICKTIPP_WEBHOOK_BYTES) return new Response('Payload too large', { status: 413 })

  let storedEventId: string | null = null
  try {
    const rawBody = await request.text()
    if (new TextEncoder().encode(rawBody).byteLength > MAX_KLICKTIPP_WEBHOOK_BYTES) return new Response('Payload too large', { status: 413 })

    const event = parseKlickTippWebhook(rawBody, request.headers.get('content-type') || '')
    const headerToken = request.headers.get('x-klicktipp-webhook-token')
    if (!verifyKlickTippWebhookToken(headerToken || event.suppliedToken)) return new Response('Unauthorized', { status: 401 })

    const contact = await findContact(event)
    const supabase = createServerClient()
    const fingerprint = fingerprintKlickTippWebhook(rawBody, event.eventId)
    const { data: storedEvent, error: insertError } = await supabase
      .from('klicktipp_webhook_events')
      .insert({
        event_fingerprint: fingerprint,
        contact_id: contact?.id ?? null,
        klicktipp_id: event.klicktippId,
        event_type: event.eventType,
        occurred_at: event.occurredAt,
        email_status: event.emailStatus,
        campaign_name: event.campaignName,
        message_name: event.messageName,
        tag_name: event.tagName,
        link_label: event.linkLabel,
        redacted_payload: event.redactedPayload,
      })
      .select('event_fingerprint')
      .single()

    if (insertError?.code === '23505') {
      const { data: existingEvent } = await supabase
        .from('klicktipp_webhook_events')
        .select('processing_status')
        .eq('event_fingerprint', fingerprint)
        .single()
      if (existingEvent?.processing_status === 'processed' || existingEvent?.processing_status === 'unmatched') {
        return Response.json({ success: true, duplicate: true })
      }
      storedEventId = fingerprint
    } else {
      if (insertError || !storedEvent) return new Response('Temporary failure', { status: 503 })
      storedEventId = storedEvent.event_fingerprint
    }

    if (!contact) {
      await supabase.from('klicktipp_webhook_events').update({ processing_status: 'unmatched', processed_at: new Date().toISOString() }).eq('event_fingerprint', storedEventId)
      return Response.json({ success: true, matched: false })
    }

    await processEvent(event, contact, fingerprint)
    await supabase.from('klicktipp_webhook_events').update({ processing_status: 'processed', processed_at: new Date().toISOString() }).eq('event_fingerprint', storedEventId)
    return Response.json({ success: true, matched: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ungültiges KlickTipp-Ereignis'
    if (storedEventId) {
      const supabase = createServerClient()
      await supabase.from('klicktipp_webhook_events').update({ processing_status: 'failed', processing_error: message.slice(0, 500), processed_at: new Date().toISOString() }).eq('event_fingerprint', storedEventId)
    }
    console.error('[POST /api/webhooks/klicktipp-incoming] Verarbeitung fehlgeschlagen:', message)
    return new Response(storedEventId ? 'Temporary failure' : 'Invalid payload', { status: storedEventId ? 503 : 400 })
  }
}

export async function GET() {
  return Response.json({ service: 'KlickTipp Event Webhook', status: 'ready' })
}
