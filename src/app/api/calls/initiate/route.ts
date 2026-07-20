import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import { initiatePlacetelCall, PlacetelApiError, sanitizePlacetelCall } from '@/lib/integrations/placetel'
import { isAllowedPhoneDestination, normalizePhoneNumber } from '@/lib/phone'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ALLOWED_PHONE_FIELDS = new Set(['phone_mobile', 'phone_office'])
const MAX_CALLS_PER_MINUTE = 5

function getAllowedCountryCodes(): string[] {
  return (process.env.PLACETEL_ALLOWED_COUNTRY_CODES || '+49')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}
function getDefaultSipuid(): string | null {
  const sipuid = process.env.PLACETEL_DEFAULT_SIPUID?.trim()
  return sipuid || null
}

export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return Response.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 })
  }
  if (!currentUser.active) {
    return Response.json({ success: false, error: 'Benutzerkonto ist deaktiviert' }, { status: 403 })
  }

  try {
    const body = await request.json() as { contactId?: unknown; phoneField?: unknown }
    const contactId = typeof body.contactId === 'string' ? body.contactId : ''
    const phoneField = typeof body.phoneField === 'string' ? body.phoneField : ''

    if (!UUID_PATTERN.test(contactId) || !ALLOWED_PHONE_FIELDS.has(phoneField)) {
      return Response.json({ success: false, error: 'Ungültige Anrufauswahl' }, { status: 400 })
    }

    const sipuid = getDefaultSipuid()
    if (!sipuid) {
      return Response.json(
        { success: false, error: 'Placetel-SIP-Benutzer ist noch nicht konfiguriert' },
        { status: 503 }
      )
    }

    const supabase = createServerClient()
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, phone_mobile, phone_office, archived_at')
      .eq('id', contactId)
      .single()

    if (contactError || !contact) {
      return Response.json({ success: false, error: 'Kontakt nicht gefunden' }, { status: 404 })
    }
    if (contact.archived_at) {
      return Response.json({ success: false, error: 'Archivierte Kontakte können nicht angerufen werden' }, { status: 409 })
    }

    const rawPhone = phoneField === 'phone_mobile' ? contact.phone_mobile : contact.phone_office
    const target = normalizePhoneNumber(rawPhone)
    if (!target) {
      return Response.json({ success: false, error: 'Die Telefonnummer ist nicht gültig' }, { status: 400 })
    }
    if (!isAllowedPhoneDestination(target, getAllowedCountryCodes())) {
      return Response.json({ success: false, error: 'Das Zielland ist für Placetel-Anrufe nicht freigegeben' }, { status: 403 })
    }

    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString()
    const { count, error: countError } = await supabase
      .from('call_logs')
      .select('id', { count: 'exact', head: true })
      .eq('initiated_by_user_id', currentUser.id)
      .gte('created_at', oneMinuteAgo)

    if (countError) {
      console.error('[POST /api/calls/initiate] Rate-Limit-Prüfung fehlgeschlagen:', countError.message)
      return Response.json({ success: false, error: 'Anruf konnte nicht sicher geprüft werden' }, { status: 503 })
    }
    if ((count ?? 0) >= MAX_CALLS_PER_MINUTE) {
      return Response.json(
        { success: false, error: 'Zu viele Anrufversuche. Bitte kurz warten.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      )
    }

    const { data: pendingCall, error: insertError } = await supabase
      .from('call_logs')
      .insert({
        contact_id: contactId,
        initiated_by_user_id: currentUser.id,
        direction: 'outgoing',
        status: 'initiated',
        to_number: target,
        remote_number_normalized: target,
        sipuid,
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (insertError || !pendingCall) {
      console.error('[POST /api/calls/initiate] Lokaler Anrufdatensatz fehlgeschlagen:', insertError?.message)
      return Response.json({ success: false, error: 'Anruf konnte nicht vorbereitet werden' }, { status: 500 })
    }

    try {
      const providerCall = await initiatePlacetelCall({ sipuid, target })
      const placetelCallId = providerCall.id == null ? null : String(providerCall.id)
      const { error: updateError } = await supabase
        .from('call_logs')
        .update({
          placetel_call_id: placetelCallId,
          provider_payload: sanitizePlacetelCall(providerCall),
        })
        .eq('id', pendingCall.id)

      if (updateError) {
        console.error('[POST /api/calls/initiate] Provider-ID konnte nicht gespeichert werden:', updateError.message)
      }

      await supabase.from('activities').insert({
        lead_id: contactId,
        type: 'placetel_call_started',
        description: `Placetel-Anruf gestartet: ${contact.first_name} ${contact.last_name}`,
        data: { call_log_id: pendingCall.id, phone_field: phoneField },
      })

      return Response.json(
        {
          success: true,
          data: {
            callId: pendingCall.id,
            status: 'initiated',
            protocolStored: !updateError,
          },
        },
        { status: 201 }
      )
    } catch (error) {
      const placetelError = error instanceof PlacetelApiError ? error : null
      await supabase
        .from('call_logs')
        .update({
          status: 'failed',
          ended_at: new Date().toISOString(),
          provider_payload: {
            error: placetelError?.message || 'Placetel-Anfrage fehlgeschlagen',
            status: placetelError?.status ?? null,
          },
        })
        .eq('id', pendingCall.id)

      const responseStatus = placetelError?.status === 429
        ? 429
        : placetelError?.status === 400
          ? 400
          : placetelError?.status === 401 || placetelError?.status === 403
            ? 502
            : 503

      return Response.json(
        { success: false, error: placetelError?.message || 'Anruf konnte nicht gestartet werden' },
        {
          status: responseStatus,
          headers: placetelError?.retryAfterSeconds
            ? { 'Retry-After': String(placetelError.retryAfterSeconds) }
            : undefined,
        }
      )
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ success: false, error: 'Ungültige Anfrage' }, { status: 400 })
    }
    console.error('[POST /api/calls/initiate] Unerwarteter Fehler:', error)
    return Response.json({ success: false, error: 'Anruf konnte nicht gestartet werden' }, { status: 500 })
  }
}
