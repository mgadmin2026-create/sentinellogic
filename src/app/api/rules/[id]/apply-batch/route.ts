import { createServerClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activities-logger'
import { sendRuleBatchNotification } from '@/lib/rule-notifications'
import { ruleKlicktippTags } from '@/lib/rule-klicktipp-tags'
import { syncStoredContactToKlickTipp } from '@/lib/klicktipp-sync'
import { NextRequest, NextResponse } from 'next/server'

// Ohne dieses Flag greift Vercels Standard-Timeout (deutlich unter einer Minute).
// Bei Regeln mit vielen passenden Kontakten (z.B. große Facebook-Sparten mit
// >100 Leads, je Kontakt 2-3 externe API-Calls an KlickTipp/Dialfire) reichte
// das nicht annähernd — der Lauf brach nach ~35-60 Kontakten ab, ohne Fehler
// anzuzeigen, und ein erneuter Klick fing wieder von vorne an.
export const maxDuration = 300

interface Rule {
  id: string
  name?: string
  condition_source: string
  actions: {
    dialfire_campaign?: string
    dialfire_task_name?: string
    klicktipp_tag?: string
    klicktipp_tags?: string[]
    set_status?: string
    send_notification?: boolean
    notification_email?: string
  }
}

// Vergleicht Tag-Listen unabhängig von der Reihenfolge — genutzt, um bei
// wiederholter Ausführung bereits korrekt getaggte Kontakte zu überspringen.
function sameTags(a: string[] | null | undefined, b: string[]): boolean {
  const as = [...(a ?? [])].sort()
  const bs = [...b].sort()
  return as.length === bs.length && as.every((tag, i) => tag === bs[i])
}

async function invokeEdgeFunction(functionName: string, payload: any) {
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

    const result = await res.json()
    return result
  } catch (err) {
    console.error(`[invokeEdgeFunction] ${functionName} error:`, err)
    return null
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient()
    const ruleId = params.id

    // 1. Load rule
    const { data: rule, error: ruleError } = await supabase
      .from('rules')
      .select('*')
      .eq('id', ruleId)
      .single()

    if (ruleError || !rule) {
      return NextResponse.json(
        { success: false, error: 'Regel nicht gefunden' },
        { status: 404 }
      )
    }

    // Ausführungszähler hochzählen: jede manuelle Ausführung wird gezählt,
    // auch wenn 0 Kontakte matchen (die Route returned sonst frueh).
    await supabase
      .from('rules')
      .update({ runs: (rule.runs ?? 0) + 1 })
      .eq('id', ruleId)

    // 2. Find contacts matching rule source AND insurance type (if specified)
    // Skip: archiviert, automation_disabled=true, status='customer'
    let query = supabase
      .from('contacts')
      .select('*')
      .eq('source', rule.condition_source)
      .is('archived_at', null)
      .eq('automation_disabled', false)
      .neq('status', 'customer')

    // Wenn Versicherungstyp in der Regel definiert ist, auch danach filtern
    if (rule.condition_sparte) {
      query = query.eq('sparte', rule.condition_sparte)
    }

    // Stabile Reihenfolge: ohne .order() ist die DB-Reihenfolge nicht garantiert.
    // Wichtig bei großen Regeln, deren Lauf durch das Funktions-Timeout abbrechen
    // kann — mit fester Reihenfolge + Skip-Logik oben macht jeder erneute Klick
    // beim ältesten noch offenen Kontakt weiter statt wieder von vorne zu beginnen.
    const { data: contacts, error: contactsError } = await query.order('created_at', { ascending: true })

    if (contactsError) {
      return NextResponse.json(
        { success: false, error: contactsError.message },
        { status: 500 }
      )
    }

    // Kein Früh-Return bei 0 Kontakten: Ausführung soll trotzdem gezählt und
    // (falls konfiguriert) eine Benachrichtigung gesendet werden. Die leere
    // Schleife unten wird einfach nicht durchlaufen.

    // 3. Apply rule to each contact
    const contactList = contacts ?? []
    let appliedCount = 0
    let failedCount = 0
    let skippedCount = 0
    let dialfireSynced = 0
    let dialfireFailed = 0
    let klicktippSynced = 0
    let klicktippFailed = 0
    let klicktippSkipped = 0
    const errors: string[] = []
    const affectedContacts: { email: string; name: string; dialfire: 'synced' | 'failed' | 'none' }[] = []

    // Menschenlesbare Beschreibung dessen, was die Regel tut
    const actionsSummary: string[] = []
    if (rule.actions.set_status) actionsSummary.push(`Status → "${rule.actions.set_status}"`)
    if (rule.actions.dialfire_campaign) actionsSummary.push(`Dialfire-Kampagne "${rule.actions.dialfire_campaign}"${rule.actions.dialfire_task_name ? ` (Task: ${rule.actions.dialfire_task_name})` : ''}`)
    const ruleKlicktippTagList = ruleKlicktippTags(rule.actions)
    if (ruleKlicktippTagList.length) actionsSummary.push(`KlickTipp-Tags "${ruleKlicktippTagList.join('", "')}"`)
    if (rule.actions.send_notification && rule.actions.notification_email) actionsSummary.push(`Benachrichtigung an ${rule.actions.notification_email}`)

    for (const contact of contactList) {
      try {
        // Build fields to update from rule actions
        const fieldsToSet: any = {}
        const fieldsSummary: any = {}

        if (rule.actions.dialfire_campaign) {
          fieldsToSet.dialfire_campaign_id = rule.actions.dialfire_campaign
          fieldsSummary.dialfire_campaign_id = rule.actions.dialfire_campaign
        }

        if (rule.actions.dialfire_task_name) {
          fieldsToSet.dialfire_task_name_field = rule.actions.dialfire_task_name
          fieldsSummary.dialfire_task_name = rule.actions.dialfire_task_name
        }

        if (ruleKlicktippTagList.length) {
          fieldsToSet.klicktipp_tags = ruleKlicktippTagList
          fieldsSummary.klicktipp_tags = ruleKlicktippTagList
        }

        if (rule.actions.set_status) {
          fieldsToSet.status = rule.actions.set_status
          fieldsSummary.status = rule.actions.set_status
        }

        // Skip if no actions
        if (Object.keys(fieldsToSet).length === 0) {
          skippedCount++
          continue
        }

        const contactName = `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim() || contact.email
        let dialfireOutcome: 'synced' | 'failed' | 'none' = 'none'

        // Update contact
        const { error: updateError } = await supabase
          .from('contacts')
          .update(fieldsToSet)
          .eq('id', contact.id)

        if (updateError) {
          errors.push(`${contact.email}: ${updateError.message}`)
          failedCount++
          continue
        }

        // Log activity — rule_id gehört strukturiert ins Datenfeld, nicht nur in
        // den Text. Sonst muss die Lauf-Historie die Beschreibung parsen.
        await logActivity(
          null,
          contact.id,
          'automation_executed',
          `Batch: Rule ${rule.id} applied (${Object.keys(fieldsToSet).join(', ')})`,
          { rule_id: rule.id, trigger: 'batch', ...fieldsSummary }
        )

        // Bereits mit denselben Tags synchronisierte Kontakte nicht erneut an die
        // KlickTipp-API schicken — bei großen Regeln (>100 Kontakte) ist das der
        // Hauptkostenfaktor pro Kontakt und verhindert, dass ein durch das
        // Timeout abgebrochener Lauf beim nächsten Klick wieder von vorne beginnt.
        const alreadyKlicktippSynced =
          ruleKlicktippTagList.length > 0 &&
          !!contact.klicktipp_id &&
          sameTags(contact.klicktipp_tags, ruleKlicktippTagList)

        if (ruleKlicktippTagList.length > 0 && !alreadyKlicktippSynced) {
          const klicktippResult = await syncStoredContactToKlickTipp(supabase, {
            ...contact,
            ...fieldsToSet,
          })
          if (klicktippResult.status === 'synced') klicktippSynced++
          if (klicktippResult.status === 'failed') klicktippFailed++
          if (klicktippResult.status === 'skipped') klicktippSkipped++
        } else if (alreadyKlicktippSynced) {
          klicktippSkipped++
        }

        // Dialfire Sync: Only if campaign or task is set
        // Edge-Function braucht zwingend dialfire_campaign_id -> nur dann syncen.
        // Bereits unter derselben Kampagne synchronisierte Kontakte überspringen
        // (gleicher Grund wie beim KlickTipp-Skip oben).
        const alreadyDialfireSynced =
          !!fieldsToSet.dialfire_campaign_id &&
          !!contact.dialfire_id &&
          contact.dialfire_campaign_id === fieldsToSet.dialfire_campaign_id

        if (fieldsToSet.dialfire_campaign_id && !alreadyDialfireSynced) {
          try {
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
                dialfire_campaign_id: fieldsToSet.dialfire_campaign_id,
                dialfire_task_name_field: fieldsToSet.dialfire_task_name_field,
              },
            })

            if (dialfireResult?.success) {
              const dialfireId = dialfireResult.dialfire_id

              // Update contact with dialfire_id
              const { error: dfIdError } = await supabase
                .from('contacts')
                .update({
                  dialfire_id: dialfireId,
                  dialfire_updated_at: new Date().toISOString(),
                })
                .eq('id', contact.id)

              if (dfIdError) {
                console.error(`[Dialfire Batch] Fehler beim Speichern der ID für ${contact.email}: ${dfIdError.message}`)
              }

              dialfireSynced++
              dialfireOutcome = 'synced'
              console.log(`[Dialfire Batch] Synced: ${contact.email} -> ID: ${dialfireId}`)
              await logActivity(
                null,
                contact.id,
                'dialfire_synced',
                `Dialfire synced via batch rule (ID: ${dialfireId})`
              )
            } else {
              dialfireFailed++
              dialfireOutcome = 'failed'
              console.warn(`[Dialfire Batch] Failed for ${contact.email}: ${dialfireResult?.error}`)
              await logActivity(
                null,
                contact.id,
                'dialfire_sync_failed',
                `Dialfire sync failed: ${dialfireResult?.error || 'Unknown error'}`
              )
            }
          } catch (err) {
            dialfireFailed++
            dialfireOutcome = 'failed'
            console.error(`[Dialfire Batch] Error for ${contact.email}:`, err)
          }
        } else if (alreadyDialfireSynced) {
          dialfireOutcome = 'synced'
        }

        affectedContacts.push({ email: contact.email, name: contactName, dialfire: dialfireOutcome })
        appliedCount++
      } catch (err) {
        errors.push(`${contact.email}: ${err instanceof Error ? err.message : 'Unknown error'}`)
        failedCount++
      }
    }

    // E-Mail-Benachrichtigung: eine Summary-Mail pro manueller Ausfuehrung
    if (rule.actions.send_notification && rule.actions.notification_email) {
      const sent = await sendRuleBatchNotification({
        to: rule.actions.notification_email,
        ruleName: rule.name || 'Regel',
        appliedCount,
        actions: rule.actions,
      })
      console.log(
        `[Batch] Benachrichtigung ${sent ? 'gesendet' : 'fehlgeschlagen'} an ${rule.actions.notification_email}`
      )
    }

    // 4. Return summary
    return NextResponse.json({
      success: true,
      message: `Regel auf ${appliedCount} von ${contactList.length} Kontakten angewendet`,
      applied: appliedCount,
      failed: failedCount,
      skipped: skippedCount,
      total: contactList.length,
      dialfireSynced,
      dialfireFailed,
      klicktippRequested: ruleKlicktippTagList.length > 0,
      klicktippSynced,
      klicktippFailed,
      klicktippSkipped,
      actionsSummary,
      affectedContacts,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err) {
    console.error('[POST /api/rules/[id]/apply-batch]:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
