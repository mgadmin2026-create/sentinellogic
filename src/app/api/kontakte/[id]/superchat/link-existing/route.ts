import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { findExistingSuperchatContactCandidates, SuperchatApiError } from '@/lib/integrations/superchat'
import { linkExistingSuperchatContact } from '@/lib/superchat-sync'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(
  request: NextRequest,
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
      'id, first_name, last_name, email, phone_mobile, phone_office, anrede, company_name, street, hausnummer, postal_code, city, country, geburtstag, status, archived_at, superchat_id'
    )
    .eq('id', params.id)
    .single()

  if (contactError || !contact) {
    return Response.json({ success: false, error: 'Kontakt nicht gefunden' }, { status: 404 })
  }
  if (contact.archived_at) {
    return Response.json(
      { success: false, error: 'Archivierte Kontakte können nicht verknüpft werden' },
      { status: 409 }
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const selectedSuperchatId = typeof body.superchatId === 'string' ? body.superchatId : undefined
    const result = await linkExistingSuperchatContact(
      supabase,
      contact,
      { userId: currentUser.id },
      selectedSuperchatId
    )
    return Response.json({ success: true, data: result })
  } catch (error) {
    const message = error instanceof SuperchatApiError
      ? error.message
      : 'Bestehender SuperChat-Kontakt konnte nicht verknüpft werden'
    const status = error instanceof SuperchatApiError && error.status === 429 ? 429 : 409
    return Response.json({ success: false, error: message }, { status })
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return Response.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 })
  if (!currentUser.active) return Response.json({ success: false, error: 'Benutzerkonto ist deaktiviert' }, { status: 403 })
  if (!UUID_PATTERN.test(params.id)) return Response.json({ success: false, error: 'Ungültige Kontakt-ID' }, { status: 400 })

  const supabase = createServerClient()
  const { data: contact, error } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, email, phone_mobile, phone_office, superchat_id, archived_at')
    .eq('id', params.id)
    .single()

  if (error || !contact) return Response.json({ success: false, error: 'Kontakt nicht gefunden' }, { status: 404 })
  if (contact.archived_at) return Response.json({ success: false, error: 'Archivierte Kontakte können nicht verknüpft werden' }, { status: 409 })
  if (contact.superchat_id) return Response.json({ success: false, error: 'Kontakt ist bereits mit SuperChat verknüpft' }, { status: 409 })

  try {
    const candidates = await findExistingSuperchatContactCandidates({
      firstName: contact.first_name,
      lastName: contact.last_name,
      email: contact.email,
      phoneMobile: contact.phone_mobile,
      phoneOffice: contact.phone_office,
    })
    return Response.json({ success: true, data: { candidates } })
  } catch (candidateError) {
    const message = candidateError instanceof SuperchatApiError
      ? candidateError.message
      : 'SuperChat-Treffer konnten nicht geladen werden'
    return Response.json({ success: false, error: message }, { status: 502 })
  }
}
