import { getCurrentUser } from '@/lib/auth'
import { SuperchatApiError } from '@/lib/integrations/superchat'
import { isAdmin } from '@/lib/roles'
import { createServerClient } from '@/lib/supabase/server'
import { syncContactToSuperchat } from '@/lib/superchat-sync'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const maxDuration = 60

const BATCH_SIZE = 10

export async function POST() {
  const currentUser = await getCurrentUser()
  if (!currentUser || !isAdmin(currentUser.role)) {
    return Response.json({ success: false, error: 'Administratorrechte erforderlich' }, { status: 403 })
  }

  const supabase = createServerClient()
  const { data: contacts, error } = await supabase
    .from('contacts')
    .select(
      'id, first_name, last_name, email, phone_mobile, phone_office, anrede, company_name, street, hausnummer, postal_code, city, country, geburtstag, status, superchat_id'
    )
    .eq('source', 'facebook')
    .is('archived_at', null)
    .is('superchat_id', null)
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE)

  if (error) {
    console.error('[SuperChat Facebook Sync] Kontakte konnten nicht geladen werden')
    return Response.json({ success: false, error: 'Facebook-Kontakte konnten nicht geladen werden' }, { status: 500 })
  }

  let created = 0
  let conflicts = 0
  let failed = 0

  for (const contact of contacts ?? []) {
    try {
      await syncContactToSuperchat(supabase, contact, { userId: currentUser.id })
      created += 1
    } catch (syncError) {
      if (syncError instanceof SuperchatApiError && syncError.status === 409) conflicts += 1
      else failed += 1
    }
  }

  const { count: remaining, error: countError } = await supabase
    .from('contacts')
    .select('id', { count: 'exact', head: true })
    .eq('source', 'facebook')
    .is('archived_at', null)
    .is('superchat_id', null)

  if (countError) {
    console.error('[SuperChat Facebook Sync] Restmenge konnte nicht bestimmt werden')
    return Response.json({ success: false, error: 'Restmenge konnte nicht bestimmt werden' }, { status: 500 })
  }

  return Response.json({
    success: true,
    data: {
      examined: contacts?.length ?? 0,
      created,
      conflicts,
      failed,
      remaining: remaining ?? 0,
    },
  })
}
