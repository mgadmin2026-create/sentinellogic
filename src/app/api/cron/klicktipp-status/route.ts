import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getKlickTippContactStatus } from '@/lib/klicktipp-client'

export const dynamic = 'force-dynamic'

const BATCH_SIZE = 100
const CONCURRENCY = 5

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServerClient()
  const { data: contacts, error } = await supabase
    .from('contacts')
    .select('id, klicktipp_id, klicktipp_email_status')
    .not('klicktipp_id', 'is', null)
    .is('archived_at', null)
    .order('klicktipp_status_checked_at', { ascending: true, nullsFirst: true })
    .limit(BATCH_SIZE)

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  let checked = 0
  let changed = 0
  let failed = 0
  const list = contacts ?? []

  for (let index = 0; index < list.length; index += CONCURRENCY) {
    await Promise.all(list.slice(index, index + CONCURRENCY).map(async (contact) => {
      const checkedAt = new Date().toISOString()
      try {
        const result = await getKlickTippContactStatus(contact.klicktipp_id)
        const statusChanged = result.status !== 'unknown' && result.status !== contact.klicktipp_email_status
        const updates: Record<string, unknown> = { klicktipp_status_checked_at: checkedAt }
        if (result.status !== 'unknown') {
          updates.klicktipp_email_status = result.status
          if (statusChanged) updates.klicktipp_status_updated_at = checkedAt
        }
        const { error: updateError } = await supabase.from('contacts').update(updates).eq('id', contact.id)
        if (updateError) throw new Error(updateError.message)

        if (statusChanged) {
          const { error: activityError } = await supabase.from('activities').insert({
            lead_id: contact.id,
            type: 'klicktipp_status_changed',
            description: `KlickTipp-E-Mail-Status: ${result.status}`,
            data: { channel: 'klicktipp', old_status: contact.klicktipp_email_status, new_status: result.status, source: 'reconciliation' },
          })
          if (activityError) throw new Error(activityError.message)
          changed++
        }
        checked++
      } catch (syncError) {
        failed++
        console.error('[KlickTipp Statusabgleich] Kontakt konnte nicht geprüft werden:', syncError instanceof Error ? syncError.message : 'Unbekannter Fehler')
      }
    }))
  }

  return NextResponse.json({ ok: true, checked, changed, failed, remainingPossible: list.length === BATCH_SIZE })
}
