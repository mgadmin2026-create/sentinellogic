import { NextRequest } from 'next/server'
import {
  syncStoredContactToKlickTipp,
  type StoredKlickTippContact,
} from '@/lib/klicktipp-sync'
import { createServerClient } from '@/lib/supabase/server'

const MAX_CONTACTS_PER_RUN = 250

/**
 * Überträgt Bestandskontakte kontrolliert in kleinen Paketen.
 * Die Route ist über die normale Supabase-Anmeldung der Anwendung geschützt.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const body = await request.json().catch(() => ({}))
    const requestedLimit = Number(body.limit) || 50
    const limit = Math.min(Math.max(requestedLimit, 1), MAX_CONTACTS_PER_RUN)
    const onlyUnsynced = body.only_unsynced !== false

    let query = supabase
      .from('contacts')
      .select([
        'id', 'email', 'first_name', 'last_name', 'company_name', 'street',
        'postal_code', 'city', 'country', 'phone_mobile', 'website',
        'geburtstag', 'geschlecht', 'klicktipp_tags',
        'klicktipp_tag_ids', 'klicktipp_id', 'is_test_data',
      ].join(','))
      .is('archived_at', null)
      .eq('is_test_data', false)
      .not('email', 'is', null)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (onlyUnsynced) query = query.is('klicktipp_id', null)

    const { data: contacts, error } = await query
    if (error) {
      return Response.json({ success: false, error: error.message }, { status: 500 })
    }

    let synced = 0
    let failed = 0
    let skipped = 0

    for (const contact of contacts ?? []) {
      const result = await syncStoredContactToKlickTipp(
        supabase,
        contact as unknown as StoredKlickTippContact
      )
      if (result.status === 'synced') synced++
      else if (result.status === 'failed') failed++
      else skipped++
    }

    return Response.json({
      success: failed === 0,
      processed: contacts?.length ?? 0,
      synced,
      failed,
      skipped,
      has_more: (contacts?.length ?? 0) === limit,
    })
  } catch (error) {
    console.error('[KlickTipp Bestandsabgleich] Fehlgeschlagen:', error)
    return Response.json(
      { success: false, error: 'KlickTipp-Bestandsabgleich fehlgeschlagen' },
      { status: 500 }
    )
  }
}
