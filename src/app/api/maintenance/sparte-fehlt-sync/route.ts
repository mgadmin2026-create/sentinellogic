import { getCurrentUser } from '@/lib/auth'
import { ensureKlickTippTags } from '@/lib/klicktipp-client'
import { syncStoredContactToKlickTipp } from '@/lib/klicktipp-sync'
import { matchExistingSuperchatContacts, SuperchatApiError } from '@/lib/integrations/superchat'
import { isAdmin } from '@/lib/roles'
import { createServerClient } from '@/lib/supabase/server'
import { syncContactToSuperchat } from '@/lib/superchat-sync'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const maxDuration = 60

const BATCH_SIZE = 5
const SOURCE_TAG = 'Sparte fehlt'
const KLICKTIPP_TAGS = ['AZ Kunden', 'AZ Firmen Kunden']
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Phase = 'klicktipp' | 'superchat'

export async function POST(request: Request) {
  const currentUser = await getCurrentUser()
  if (!currentUser || !isAdmin(currentUser.role)) {
    return Response.json({ success: false, error: 'Administratorrechte erforderlich' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const phase: Phase = body.phase === 'superchat' ? 'superchat' : 'klicktipp'
  const cursor = typeof body.cursor === 'string' && UUID_PATTERN.test(body.cursor) ? body.cursor : null
  const supabase = createServerClient()

  const { data: sourceTag, error: tagError } = await supabase
    .from('tags')
    .select('id')
    .ilike('name', SOURCE_TAG)
    .maybeSingle()

  if (tagError || !sourceTag) {
    console.error('[Sparte fehlt Sync] Quell-Tag konnte nicht eindeutig geladen werden')
    return Response.json({ success: false, error: `Tag „${SOURCE_TAG}“ wurde nicht eindeutig gefunden` }, { status: 500 })
  }

  let mapQuery = supabase
    .from('contact_tag_map')
    .select('contact_id')
    .eq('tag_id', sourceTag.id)
    .order('contact_id', { ascending: true })
    .limit(BATCH_SIZE)
  if (cursor) mapQuery = mapQuery.gt('contact_id', cursor)

  const { data: mappings, error: mappingError } = await mapQuery
  if (mappingError) {
    console.error('[Sparte fehlt Sync] Kontaktzuordnungen konnten nicht geladen werden')
    return Response.json({ success: false, error: 'Kontakte konnten nicht geladen werden' }, { status: 500 })
  }

  const contactIds = (mappings ?? []).map((mapping) => mapping.contact_id)
  if (contactIds.length === 0) {
    return Response.json({
      success: true,
      data: emptyResult(phase, cursor, false),
    })
  }

  const { data: contactRows, error: contactError } = await supabase
    .from('contacts')
    .select('*')
    .in('id', contactIds)
    .is('archived_at', null)
    .eq('is_test_data', false)

  if (contactError) {
    console.error('[Sparte fehlt Sync] Kontaktdaten konnten nicht geladen werden')
    return Response.json({ success: false, error: 'Kontaktdaten konnten nicht geladen werden' }, { status: 500 })
  }

  const contactsById = new Map((contactRows ?? []).map((contact) => [contact.id, contact]))
  const contacts = contactIds.flatMap((id) => {
    const contact = contactsById.get(id)
    return contact ? [contact] : []
  })
  const result = emptyResult(phase, cursor, mappings?.length === BATCH_SIZE)

  if (phase === 'klicktipp') {
    let desiredTagIds: number[]
    try {
      desiredTagIds = await ensureKlickTippTags(KLICKTIPP_TAGS)
    } catch (error) {
      return Response.json({
        success: false,
        error: error instanceof Error ? error.message : 'KlickTipp-Tags konnten nicht vorbereitet werden',
      }, { status: 502 })
    }

    for (const contact of contacts) {
      result.examined += 1
      const existingNames = Array.isArray(contact.klicktipp_tags) ? contact.klicktipp_tags : []
      const existingIds = Array.isArray(contact.klicktipp_tag_ids) ? contact.klicktipp_tag_ids : []
      const mergedNames = Array.from(new Set([...existingNames, ...KLICKTIPP_TAGS]))
      const mergedIds = Array.from(new Set([...existingIds, ...desiredTagIds]))

      const syncResult = await syncStoredContactToKlickTipp(supabase, {
        ...contact,
        klicktipp_tags: mergedNames,
        klicktipp_tag_ids: mergedIds,
      })

      if (syncResult.status === 'synced') {
        const { error: updateError } = await supabase
          .from('contacts')
          .update({ klicktipp_tags: mergedNames, klicktipp_tag_ids: mergedIds })
          .eq('id', contact.id)
        if (updateError) result.failed += 1
        else {
          result.klicktippSynchronized += 1
          result.klicktippIdsSaved += contact.klicktipp_id ? 0 : 1
        }
      } else if (syncResult.status === 'skipped') {
        result.skipped += 1
      } else {
        result.failed += 1
      }
      result.nextCursor = contact.id
    }
  } else {
    const alreadyLinked = contacts.filter((contact) => contact.superchat_id)
    result.examined += alreadyLinked.length
    result.superchatAlreadyLinked += alreadyLinked.length

    const openContacts = contacts.filter((contact) => !contact.superchat_id)
    if (openContacts.length === 0) {
      result.nextCursor = contactIds.at(-1) ?? cursor
      return Response.json({ success: true, data: result })
    }
    let comparison: Awaited<ReturnType<typeof matchExistingSuperchatContacts>>
    try {
      comparison = await matchExistingSuperchatContacts(openContacts.map((contact) => ({
        referenceId: contact.id,
        contact: {
          email: contact.email,
          phoneMobile: contact.phone_mobile,
          phoneOffice: contact.phone_office,
        },
      })))
    } catch (error) {
      if (error instanceof SuperchatApiError && error.status === 429) {
        result.rateLimited = true
        result.hasMore = true
        return Response.json({ success: true, data: result })
      }
      console.error('[Sparte fehlt Sync] SuperChat-Bestand konnte nicht abgeglichen werden')
      return Response.json({ success: false, error: 'SuperChat-Bestandsabgleich fehlgeschlagen' }, { status: 502 })
    }

    const matchesByContact = new Map(comparison.matches.map((match) => [match.referenceId, match]))
    const ambiguousIds = new Set(comparison.ambiguousReferenceIds)

    for (const contact of openContacts) {
      result.examined += 1
      const match = matchesByContact.get(contact.id)
      if (match) {
        const linkedAt = new Date().toISOString()
        const { data: updated, error: updateError } = await supabase
          .from('contacts')
          .update({ superchat_id: match.id, superchat_last_sync: linkedAt, superchat_sync_error: null })
          .eq('id', contact.id)
          .is('superchat_id', null)
          .select('id')
          .maybeSingle()

        if (updateError || !updated) result.failed += 1
        else {
          result.superchatLinkedExisting += 1
          await supabase.from('activities').insert({
            lead_id: contact.id,
            type: 'superchat_synced',
            description: 'Bestehenden SuperChat-Kontakt für Sonderaktion verknüpft',
            data: { operation: 'linked_bulk', matched_by: match.matchedBy, source_tag: SOURCE_TAG },
            user_id: currentUser.id,
          })
        }
        result.nextCursor = contact.id
        continue
      }

      if (ambiguousIds.has(contact.id)) {
        result.superchatAmbiguous += 1
        result.nextCursor = contact.id
        continue
      }

      try {
        await syncContactToSuperchat(supabase, contact, { userId: currentUser.id })
        result.superchatCreated += 1
        result.nextCursor = contact.id
      } catch (error) {
        if (error instanceof SuperchatApiError && error.status === 429) {
          result.rateLimited = true
          result.hasMore = true
          break
        }
        if (error instanceof SuperchatApiError && error.status === 409) result.superchatConflicts += 1
        else result.failed += 1
        result.nextCursor = contact.id
      }
    }
  }

  return Response.json({ success: true, data: result })
}

function emptyResult(phase: Phase, cursor: string | null, hasMore: boolean) {
  return {
    phase,
    examined: 0,
    klicktippSynchronized: 0,
    klicktippIdsSaved: 0,
    superchatCreated: 0,
    superchatLinkedExisting: 0,
    superchatAlreadyLinked: 0,
    superchatAmbiguous: 0,
    superchatConflicts: 0,
    skipped: 0,
    failed: 0,
    rateLimited: false,
    nextCursor: cursor,
    hasMore,
  }
}
