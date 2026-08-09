import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { SuperchatApiError } from '@/lib/integrations/superchat'
import { syncContactToSuperchat } from '@/lib/superchat-sync'
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
      'id, first_name, last_name, email, phone_mobile, phone_office, anrede, company_name, street, hausnummer, postal_code, city, country, geburtstag, archived_at, superchat_id'
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

  try {
    const result = await syncContactToSuperchat(supabase, contact, { userId: currentUser.id })
    return Response.json({ success: true, data: result })
  } catch (error) {
    const message =
      error instanceof SuperchatApiError
        ? error.message
        : 'Kontakt konnte nicht an SuperChat übertragen werden'

    const status =
      error instanceof SuperchatApiError && error.status === 429
        ? 429
        : error instanceof SuperchatApiError && [401, 403].includes(error.status || 0)
          ? 502
          : 400
    return Response.json({ success: false, error: message }, { status })
  }
}
