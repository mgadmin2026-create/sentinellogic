import { getCurrentUser } from '@/lib/auth'
import { matchExistingSuperchatContacts, SuperchatApiError } from '@/lib/integrations/superchat'
import { isAdmin } from '@/lib/roles'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const maxDuration = 60

export async function POST() {
  const currentUser = await getCurrentUser()
  if (!currentUser || !isAdmin(currentUser.role)) {
    return Response.json({ success: false, error: 'Administratorrechte erforderlich' }, { status: 403 })
  }

  const supabase = createServerClient()
  const { data: contacts, error: contactError } = await supabase
    .from('contacts')
    .select('id, email, phone_mobile, phone_office')
    .is('superchat_id', null)
    .is('archived_at', null)

  if (contactError) {
    console.error('[SuperChat Bestandsabgleich] Offene Kontakte konnten nicht geladen werden')
    return Response.json({ success: false, error: 'Sentinel-Kontakte konnten nicht geladen werden' }, { status: 500 })
  }

  try {
    const comparison = await matchExistingSuperchatContacts(
      (contacts ?? []).map((contact) => ({
        referenceId: contact.id,
        contact: {
          email: contact.email,
          phoneMobile: contact.phone_mobile,
          phoneOffice: contact.phone_office,
        },
      }))
    )

    let linked = 0
    let databaseConflicts = 0
    const linkedAt = new Date().toISOString()

    for (const match of comparison.matches) {
      const { data: updated, error: updateError } = await supabase
        .from('contacts')
        .update({
          superchat_id: match.id,
          superchat_last_sync: linkedAt,
          superchat_sync_error: null,
        })
        .eq('id', match.referenceId)
        .is('superchat_id', null)
        .select('id')
        .maybeSingle()

      if (updateError || !updated) {
        databaseConflicts += 1
        continue
      }

      linked += 1
      await supabase.from('activities').insert({
        lead_id: match.referenceId,
        type: 'superchat_synced',
        description: 'Bestehenden SuperChat-Kontakt im Bestandsabgleich verknüpft',
        data: { operation: 'linked_bulk', matched_by: match.matchedBy },
        user_id: currentUser.id,
      })
    }

    return Response.json({
      success: true,
      data: {
        examined: contacts?.length ?? 0,
        uniquelyMatched: comparison.matches.length,
        linked,
        notFound: comparison.notFoundReferenceIds.length,
        ambiguous: comparison.ambiguousReferenceIds.length,
        databaseConflicts,
      },
    })
  } catch (error) {
    const message = error instanceof SuperchatApiError
      ? error.message
      : 'SuperChat-Bestandsabgleich ist fehlgeschlagen'
    return Response.json({ success: false, error: message }, { status: 502 })
  }
}
