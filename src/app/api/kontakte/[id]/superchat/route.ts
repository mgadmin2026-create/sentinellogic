import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import {
  createSuperchatContact,
  SuperchatApiError,
  updateSuperchatContact,
} from '@/lib/integrations/superchat'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return Response.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 })
  }
  if (!currentUser.active) {
    return Response.json({ success: false, error: 'Benutzerkonto ist deaktiviert' }, { status: 403 })
  }
  if (!UUID_PATTERN.test(params.id)) {
    return Response.json({ success: false, error: 'Ungültige Kontakt-ID' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data: contact, error: contactError } = await supabase
    .from('contacts')
    .select(
      'id, first_name, last_name, email, phone_mobile, phone_office, geschlecht, archived_at, superchat_id'
    )
    .eq('id', params.id)
    .single()

  if (contactError || !contact) {
    return Response.json({ success: false, error: 'Kontakt nicht gefunden' }, { status: 404 })
  }
  if (contact.archived_at) {
    return Response.json(
      { success: false, error: 'Archivierte Kontakte können nicht übertragen werden' },
      { status: 409 }
    )
  }

  const providerInput = {
    firstName: contact.first_name,
    lastName: contact.last_name,
    email: contact.email,
    phoneMobile: contact.phone_mobile,
    phoneOffice: contact.phone_office,
    gender: contact.geschlecht,
  }

  try {
    const wasUpdate = Boolean(contact.superchat_id)
    const result = contact.superchat_id
      ? await updateSuperchatContact(contact.superchat_id, providerInput)
      : await createSuperchatContact(providerInput)
    const synchronizedAt = new Date().toISOString()

    const { error: updateError } = await supabase
      .from('contacts')
      .update({
        superchat_id: result.id,
        superchat_last_sync: synchronizedAt,
        superchat_sync_error: null,
      })
      .eq('id', contact.id)

    if (updateError) {
      console.error('[SuperChat Sync] Synchronisationsstatus konnte nicht gespeichert werden')
      return Response.json(
        {
          success: false,
          error: wasUpdate
            ? 'Kontakt wurde übertragen, der lokale Status konnte aber nicht gespeichert werden'
            : 'Kontakt wurde in SuperChat angelegt, die Verknüpfung konnte aber nicht gespeichert werden',
        },
        { status: 500 }
      )
    }

    await supabase.from('activities').insert({
      lead_id: contact.id,
      type: 'superchat_synced',
      description: wasUpdate
        ? 'Kontakt in SuperChat aktualisiert'
        : 'Kontakt an SuperChat übertragen',
      data: { operation: wasUpdate ? 'updated' : 'created' },
      user_id: currentUser.id,
    })

    return Response.json({
      success: true,
      data: {
        superchatId: result.id,
        synchronizedAt,
        operation: wasUpdate ? 'updated' : 'created',
      },
    })
  } catch (error) {
    const message =
      error instanceof SuperchatApiError
        ? error.message
        : 'Kontakt konnte nicht an SuperChat übertragen werden'

    console.error('[SuperChat Sync] Übertragung fehlgeschlagen', {
      status: error instanceof SuperchatApiError ? error.status : null,
    })

    await supabase
      .from('contacts')
      .update({ superchat_sync_error: message })
      .eq('id', contact.id)

    await supabase.from('activities').insert({
      lead_id: contact.id,
      type: 'superchat_sync_failed',
      description: 'SuperChat-Übertragung fehlgeschlagen',
      data: { reason: message },
      user_id: currentUser.id,
    })

    const status =
      error instanceof SuperchatApiError && error.status === 429
        ? 429
        : error instanceof SuperchatApiError && [401, 403].includes(error.status || 0)
          ? 502
          : 400
    return Response.json({ success: false, error: message }, { status })
  }
}
