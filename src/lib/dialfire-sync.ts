// Konsolidierter Dialfire-Push — vorher an zwei Stellen (kontakte/route.ts,
// apply-batch/route.ts) fast identisch dupliziert, inkl. eines ~90-Felder-
// Payloads und je eigenem invokeEdgeFunction-Helper. Struktur an
// klicktipp-sync.ts angelehnt (runWithTracking + activities-Log).
//
// Beim Konsolidieren zwei reale Inkonsistenzen zwischen den beiden alten
// Call-Sites gefunden und harmonisiert (nur additiv, kein Feld entfernt):
// kontakte/route.ts setzte dialfire_updated_at beim Erfolg NICHT, apply-batch
// schickte usa_kanada_eingeschlossen NICHT mit.
import { logActivity } from '@/lib/activities-logger'
import { createServerClient } from '@/lib/supabase/server'
import { runWithTracking, type ResumeRun } from '@/lib/sync-runs/retry-runner'

type SupabaseClient = ReturnType<typeof createServerClient>

export interface DialfireSyncContact {
  id: string
  email?: string | null
  first_name?: string | null
  last_name?: string | null
  phone_mobile?: string | null
  phone_office?: string | null
  company_name?: string | null
  street?: string | null
  postal_code?: string | null
  city?: string | null
  position?: string | null
  industry?: string | null
  source?: string | null
  mitarbeitanzahl?: number | null
  jahresumsatz?: number | null
  anrede?: string | null
  geburtstag?: string | null
  jahreseinkommen?: number | null
  groesse?: number | null
  gewicht?: number | null
  gesundheitszustand?: string | null
  seit_wann_selbststaendig?: string | null
  dienstverhaltnis?: string | null
  hausnummer?: string | null
  prüfung_grund?: string | null
  krankenversicherung_status?: string | null
  situation?: string | null
  versicherungsgesellschaft_1?: string | null
  leistungen_1?: string | null
  aktueller_beitrag_1?: string | null
  kontoinhaber_1?: string | null
  iban_1?: string | null
  versicherungsgesellschaft_2?: string | null
  leistungen_2?: string | null
  aktueller_beitrag_2?: string | null
  kontoinhaber_2?: string | null
  iban_2?: string | null
  versicherungsgesellschaft_3?: string | null
  leistungen_3?: string | null
  aktueller_beitrag_3?: string | null
  kontoinhaber_3?: string | null
  iban_3?: string | null
  versicherungsgesellschaft_4?: string | null
  leistungen_4?: string | null
  aktueller_beitrag_4?: string | null
  kontoinhaber_4?: string | null
  iban_4?: string | null
  versicherungsgesellschaft_5?: string | null
  leistungen_5?: string | null
  aktueller_beitrag_5?: string | null
  kontoinhaber_5?: string | null
  iban_5?: string | null
  notizen_2?: string | null
  usa_kanada_eingeschlossen?: boolean | null
  dialfire_campaign_id?: string | null
  dialfire_task_name_field?: string | null
}

export interface DialfireSyncMeta {
  ruleId?: string | null
  triggerType?: 'auto' | 'manual'
  resumeFrom?: ResumeRun
}

export interface DialfireSyncResult {
  status: 'synced' | 'skipped' | 'failed'
  dialfireId?: string
  error?: string
}

async function invokeEdgeFunction(functionName: string, payload: unknown): Promise<any> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.warn('[invokeEdgeFunction] Missing env vars')
    return null
  }

  const url = `${supabaseUrl}/functions/v1/${functionName}`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify(payload),
    })
    return await res.json()
  } catch (err) {
    console.error(`[invokeEdgeFunction] ${functionName} error:`, err)
    return null
  }
}

/**
 * Zentraler Dialfire-Push inklusive CRM-Status und Aktivitätsprotokoll.
 * Ohne gesetzte dialfire_campaign_id wird nichts übertragen (skipped).
 */
export async function syncContactToDialfire(
  supabase: SupabaseClient,
  contact: DialfireSyncContact,
  meta: DialfireSyncMeta = {}
): Promise<DialfireSyncResult> {
  if (!contact.dialfire_campaign_id) return { status: 'skipped' }

  try {
    const dialfireId = await runWithTracking(
      supabase,
      {
        runKind: 'item',
        integration: 'dialfire',
        triggerType: meta.triggerType ?? 'manual',
        contactId: contact.id,
        ruleId: meta.ruleId,
      },
      async () => {
        const dialfireResult = await invokeEdgeFunction('send-to-dialfire', {
          contact: {
            id: contact.id,
            email: contact.email,
            first_name: contact.first_name,
            last_name: contact.last_name,
            phone_mobile: contact.phone_mobile || contact.phone_office,
            company_name: contact.company_name,
            street: contact.street,
            postal_code: contact.postal_code,
            city: contact.city,
            position: contact.position,
            industry: contact.industry,
            source: contact.source,
            mitarbeitanzahl: contact.mitarbeitanzahl,
            jahresumsatz: contact.jahresumsatz,
            anrede: contact.anrede,
            geburtstag: contact.geburtstag,
            jahreseinkommen: contact.jahreseinkommen,
            groesse: contact.groesse,
            gewicht: contact.gewicht,
            gesundheitszustand: contact.gesundheitszustand,
            seit_wann_selbststaendig: contact.seit_wann_selbststaendig,
            dienstverhaltnis: contact.dienstverhaltnis,
            hausnummer: contact.hausnummer,
            prüfung_grund: contact.prüfung_grund,
            krankenversicherung_status: contact.krankenversicherung_status,
            situation: contact.situation,
            versicherungsgesellschaft_1: contact.versicherungsgesellschaft_1,
            leistungen_1: contact.leistungen_1,
            aktueller_beitrag_1: contact.aktueller_beitrag_1,
            kontoinhaber_1: contact.kontoinhaber_1,
            iban_1: contact.iban_1,
            versicherungsgesellschaft_2: contact.versicherungsgesellschaft_2,
            leistungen_2: contact.leistungen_2,
            aktueller_beitrag_2: contact.aktueller_beitrag_2,
            kontoinhaber_2: contact.kontoinhaber_2,
            iban_2: contact.iban_2,
            versicherungsgesellschaft_3: contact.versicherungsgesellschaft_3,
            leistungen_3: contact.leistungen_3,
            aktueller_beitrag_3: contact.aktueller_beitrag_3,
            kontoinhaber_3: contact.kontoinhaber_3,
            iban_3: contact.iban_3,
            versicherungsgesellschaft_4: contact.versicherungsgesellschaft_4,
            leistungen_4: contact.leistungen_4,
            aktueller_beitrag_4: contact.aktueller_beitrag_4,
            kontoinhaber_4: contact.kontoinhaber_4,
            iban_4: contact.iban_4,
            versicherungsgesellschaft_5: contact.versicherungsgesellschaft_5,
            leistungen_5: contact.leistungen_5,
            aktueller_beitrag_5: contact.aktueller_beitrag_5,
            kontoinhaber_5: contact.kontoinhaber_5,
            iban_5: contact.iban_5,
            notizen_2: contact.notizen_2,
            usa_kanada_eingeschlossen: contact.usa_kanada_eingeschlossen,
            dialfire_campaign_id: contact.dialfire_campaign_id,
            dialfire_task_name_field: contact.dialfire_task_name_field,
          },
        })

        if (!dialfireResult) {
          throw new Error('Dialfire Edge Function antwortete nicht oder lieferte kein Ergebnis')
        }
        if (!dialfireResult.success) {
          throw new Error(dialfireResult.error || 'Unbekannter Dialfire-Fehler')
        }

        const id = String(dialfireResult.dialfire_id)
        const { error: updateError } = await supabase
          .from('contacts')
          .update({ dialfire_id: id, dialfire_updated_at: new Date().toISOString() })
          .eq('id', contact.id)

        if (updateError) {
          console.error(`[Dialfire] Fehler beim Speichern der ID für ${contact.email}: ${updateError.message}`)
        }

        return id
      },
      meta.resumeFrom
    )

    await logActivity(
      null,
      contact.id,
      'dialfire_synced',
      `Dialfire synced${contact.dialfire_task_name_field ? ` (Task: ${contact.dialfire_task_name_field})` : ''} (ID: ${dialfireId})`
    )

    return { status: 'synced', dialfireId }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Dialfire-Fehler'
    console.error('[Dialfire] Kontaktübertragung fehlgeschlagen:', message)
    await logActivity(null, contact.id, 'dialfire_sync_failed', `Dialfire sync failed: ${message}`)
    return { status: 'failed', error: message }
  }
}
