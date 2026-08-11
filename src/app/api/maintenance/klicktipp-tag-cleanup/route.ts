import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { ensureKlickTippTags, replaceKlickTippContactTags } from '@/lib/klicktipp-client'

export const maxDuration = 300

const CONFIRMATION = 'REPLACE_AZ_TAGS_2026'

function authorized(request: NextRequest): boolean {
  const expected = process.env.TEST_DATA_CLEANUP_TOKEN?.trim()
  const provided = request.headers.get('x-test-cleanup-token')?.trim()
  return !!expected && !!provided && expected === provided
}

function desiredTags(contactType: string | null): string[] {
  return contactType === 'privat'
    ? ['AZ Kunden', 'Kinderprofis']
    : ['AZ Kunden', 'AZ Firmen Kunden']
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return Response.json({ success: false, error: 'Nicht autorisiert' }, { status: 401 })
  }
  const body = await request.json().catch(() => null)
  if (body?.confirmation !== CONFIRMATION) {
    return Response.json({ success: false, error: 'Bestätigung fehlt' }, { status: 400 })
  }
  const requestedBatchSize = Number(body?.batchSize ?? 25)
  const batchSize = Number.isFinite(requestedBatchSize)
    ? Math.min(50, Math.max(1, Math.trunc(requestedBatchSize)))
    : 25

  try {
    await ensureKlickTippTags(['AZ Kunden', 'AZ Firmen Kunden', 'Kinderprofis'])
  } catch (tagError) {
    return Response.json(
      {
        success: false,
        error: tagError instanceof Error ? tagError.message : 'KlickTipp-Tags konnten nicht vorbereitet werden',
      },
      { status: 502 }
    )
  }

  const supabase = createServerClient()
  const { data: contacts, error } = await supabase
    .from('contacts')
    .select('id, email, kontakt_typ, klicktipp_tags')
    .eq('is_test_data', false)
    .is('archived_at', null)
    .not('email', 'is', null)
    .not('klicktipp_id', 'is', null)
    .order('created_at', { ascending: true })

  if (error) return Response.json({ success: false, error: error.message }, { status: 500 })

  const pendingContacts = (contacts ?? []).filter((contact) => {
    const nextTags = desiredTags(contact.kontakt_typ)
    const currentTags = Array.isArray(contact.klicktipp_tags) ? contact.klicktipp_tags : []
    return !(
      currentTags.length === nextTags.length &&
      nextTags.every((tag) => currentTags.includes(tag))
    )
  })
  const contactsToUpdate = pendingContacts.slice(0, batchSize)
  let updated = 0
  const errors: Array<{ contactId: string; error: string }> = []

  for (const contact of contactsToUpdate) {
    const nextTags = desiredTags(contact.kontakt_typ)
    const currentTags = Array.isArray(contact.klicktipp_tags) ? contact.klicktipp_tags : []
    try {
      const tagIds = await replaceKlickTippContactTags(contact.email, currentTags, nextTags)
      const { error: updateError } = await supabase
        .from('contacts')
        .update({
          klicktipp_tags: nextTags,
          klicktipp_tag_ids: tagIds,
          klicktipp_last_sync: new Date().toISOString(),
        })
        .eq('id', contact.id)
      if (updateError) throw new Error(updateError.message)
      updated++
    } catch (cleanupError) {
      errors.push({
        contactId: contact.id,
        error: cleanupError instanceof Error ? cleanupError.message : 'Unbekannter Fehler',
      })
    }
  }

  return Response.json({
    success: errors.length === 0,
    totalCandidates: contacts?.length ?? 0,
    pendingBefore: pendingContacts.length,
    attempted: contactsToUpdate.length,
    updated,
    failed: errors.length,
    remainingEstimate: pendingContacts.length - updated,
    errors,
  })
}
