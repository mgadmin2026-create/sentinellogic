import { getCurrentUser } from '@/lib/auth'
import { assignConversationLabelToContact, SuperchatApiError } from '@/lib/integrations/superchat'
import { isAdmin } from '@/lib/roles'
import { createServerClient } from '@/lib/supabase/server'
import { linkExistingSuperchatContact, syncContactToSuperchat } from '@/lib/superchat-sync'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const maxDuration = 60

const BATCH_SIZE = 5
const LABEL_NAME = 'Kein Interesse'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: Request) {
  const currentUser = await getCurrentUser()
  if (!currentUser || !isAdmin(currentUser.role)) {
    return Response.json({ success: false, error: 'Administratorrechte erforderlich' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const cursor = typeof body.cursor === 'string' && UUID_PATTERN.test(body.cursor) ? body.cursor : null
  const supabase = createServerClient()

  let query = supabase
    .from('contacts')
    .select(
      'id, first_name, last_name, email, phone_mobile, phone_office, anrede, company_name, street, hausnummer, postal_code, city, country, geburtstag, status, superchat_id'
    )
    .eq('status', 'not_interested')
    .is('archived_at', null)
    .order('id', { ascending: true })
    .limit(BATCH_SIZE)

  if (cursor) query = query.gt('id', cursor)

  const { data: contacts, error: contactError } = await query
  if (contactError) {
    console.error('[SuperChat Kein Interesse] Kontakte konnten nicht geladen werden')
    return Response.json({ success: false, error: 'Kontakte konnten nicht geladen werden' }, { status: 500 })
  }

  const result = {
    examined: 0,
    synchronized: 0,
    linkedExisting: 0,
    alreadyLinked: 0,
    contactsLabeled: 0,
    conversationsUpdated: 0,
    alreadyLabeled: 0,
    withoutConversation: 0,
    conflicts: 0,
    failed: 0,
    rateLimited: false,
  }
  let nextCursor = cursor

  for (const contact of contacts ?? []) {
    result.examined += 1
    nextCursor = contact.id
    let superchatId = contact.superchat_id

    try {
      if (superchatId) {
        result.alreadyLinked += 1
      } else {
        try {
          const syncResult = await syncContactToSuperchat(supabase, contact, { userId: currentUser.id })
          superchatId = syncResult.superchatId
          result.synchronized += 1
        } catch (syncError) {
          if (!(syncError instanceof SuperchatApiError) || syncError.status !== 409) throw syncError

          // Ein bereits vorhandener Kontakt wird nur bei einem eindeutigen
          // E-Mail-/Telefon-Treffer automatisch verbunden. Mehrdeutige Treffer
          // bleiben bewusst zur manuellen Auswahl offen.
          try {
            const linkResult = await linkExistingSuperchatContact(
              supabase,
              contact,
              { userId: currentUser.id }
            )
            superchatId = linkResult.superchatId
            result.linkedExisting += 1
          } catch {
            result.conflicts += 1
            continue
          }
        }
      }

      const labelResult = await assignConversationLabelToContact(superchatId, LABEL_NAME)
      if (labelResult.conversationsFound === 0) {
        result.withoutConversation += 1
      } else if (labelResult.conversationsUpdated === 0) {
        result.alreadyLabeled += 1
      } else {
        result.contactsLabeled += 1
        result.conversationsUpdated += labelResult.conversationsUpdated
        await supabase.from('activities').insert({
          lead_id: contact.id,
          type: 'superchat_label_applied',
          description: `SuperChat-Gesprächslabel „${LABEL_NAME}“ gesetzt`,
          data: labelResult,
          user_id: currentUser.id,
        })
      }
    } catch (error) {
      if (error instanceof SuperchatApiError && error.status === 429) {
        result.rateLimited = true
        break
      }
      console.error('[SuperChat Kein Interesse] Kontakt konnte nicht vollständig verarbeitet werden', {
        status: error instanceof SuperchatApiError ? error.status : null,
      })
      result.failed += 1
    }
  }

  return Response.json({
    success: true,
    data: {
      ...result,
      nextCursor,
      hasMore: !result.rateLimited && (contacts?.length ?? 0) === BATCH_SIZE,
    },
  })
}
