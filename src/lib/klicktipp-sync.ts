import { logActivity } from '@/lib/activities-logger'
import { syncContactToKlickTipp } from '@/lib/klicktipp-client'
import { createServerClient } from '@/lib/supabase/server'
import { runWithTracking, type ResumeRun } from '@/lib/sync-runs/retry-runner'

type SupabaseClient = ReturnType<typeof createServerClient>

export interface StoredKlickTippContact {
  id: string
  email?: string | null
  first_name?: string | null
  last_name?: string | null
  company_name?: string | null
  street?: string | null
  postal_code?: string | null
  city?: string | null
  country?: string | null
  phone_mobile?: string | null
  website?: string | null
  geburtstag?: string | null
  geschlecht?: string | null
  klicktipp_tags?: string[] | null
  klicktipp_tag_ids?: number[] | null
  is_test_data?: boolean | null
}

export interface StoredKlickTippSyncResult {
  status: 'synced' | 'skipped' | 'failed'
  subscriberId?: string
  error?: string
}

export interface KlickTippSyncMeta {
  /** Regel, deren Ausführung diesen Sync ausgelöst hat — für die Regel-Verlauf-Ansicht. */
  ruleId?: string | null
  /** Bei Retry-Ausführung: die fortzuführende sync_runs-Zeile statt einer neuen. */
  resumeFrom?: ResumeRun
}

/**
 * Zentraler Sync-Ablauf inklusive CRM-Status und Aktivitätsprotokoll.
 * Technisch markierte Testkontakte werden niemals automatisch übertragen.
 */
export async function syncStoredContactToKlickTipp(
  supabase: SupabaseClient,
  contact: StoredKlickTippContact,
  meta: KlickTippSyncMeta = {}
): Promise<StoredKlickTippSyncResult> {
  if (contact.is_test_data) return { status: 'skipped' }
  if (!contact.email?.trim()) return { status: 'skipped' }

  try {
    const result = await runWithTracking(
      supabase,
      {
        runKind: 'item',
        integration: 'klicktipp',
        // Alle drei bestehenden Aufrufer (Kontaktanlage, Regel-Batch, manueller
        // Katch-up-Button) sind direkte Nutzer-/API-Aktionen, keine automatische
        // Regel-Ausführung im Hintergrund — daher pauschal 'manual'.
        triggerType: 'manual',
        contactId: contact.id,
        ruleId: meta.ruleId,
      },
      async () => {
        const syncResult = await syncContactToKlickTipp({
          id: contact.id,
          email: contact.email!,
          first_name: contact.first_name,
          last_name: contact.last_name,
          company_name: contact.company_name,
          street: contact.street,
          postal_code: contact.postal_code,
          city: contact.city,
          country: contact.country,
          phone_mobile: contact.phone_mobile,
          website: contact.website,
          geburtstag: contact.geburtstag,
          geschlecht: contact.geschlecht,
          tagIds: contact.klicktipp_tag_ids ?? [],
          tagNames: contact.klicktipp_tags ?? [],
        })

        const { error: updateError } = await supabase
          .from('contacts')
          .update({
            klicktipp_id: syncResult.id,
            klicktipp_last_sync: new Date().toISOString(),
          })
          .eq('id', contact.id)

        if (updateError) {
          throw new Error('KlickTipp-ID konnte nach erfolgreicher Übertragung nicht gespeichert werden')
        }

        return syncResult
      },
      meta.resumeFrom
    )

    await logActivity(
      null,
      contact.id,
      'klicktipp_synced',
      'Kontakt erfolgreich an KlickTipp übertragen',
      { klicktipp_id: result.id, tag_ids: result.tagIds }
    )

    return { status: 'synced', subscriberId: result.id }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter KlickTipp-Fehler'
    console.error('[KlickTipp] Kontaktübertragung fehlgeschlagen:', message)
    await logActivity(
      null,
      contact.id,
      'klicktipp_sync_failed',
      `KlickTipp-Übertragung fehlgeschlagen: ${message}`
    )
    return { status: 'failed', error: message }
  }
}
