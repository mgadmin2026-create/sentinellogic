import { createServerClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activities-logger'
import { sendRuleBatchNotification } from '@/lib/rule-notifications'
import { NextRequest, NextResponse } from 'next/server'

interface Rule {
  id: string
  name?: string
  condition_source: string
  actions: {
    dialfire_campaign?: string
    dialfire_task_name?: string
    klicktipp_tag?: string
    set_status?: string
    send_notification?: boolean
    notification_email?: string
  }
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
    // Skip: automation_disabled=true, status='customer'
    let query = supabase
      .from('contacts')
      .select('*')
      .eq('source', rule.condition_source)
      .eq('automation_disabled', false)
      .neq('status', 'customer')

    // Wenn Versicherungstyp in der Regel definiert ist, auch danach filtern
    if (rule.condition_sparte) {
      query = query.eq('sparte', rule.condition_sparte)
    }

    const { data: contacts, error: contactsError } = await query

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
    const errors: string[] = []
    const affectedContacts: { email: string; name: string; dialfire: 'synced' | 'failed' | 'none' }[] = []

    // Menschenlesbare Beschreibung dessen, was die Regel tut
    const actionsSummary: string[] = []
    if (rule.actions.set_status) actionsSummary.push(`Status → "${rule.actions.set_status}"`)
    if (rule.actions.dialfire_campaign) actionsSummary.push(`Dialfire-Kampagne "${rule.actions.dialfire_campaign}"${rule.actions.dialfire_task_name ? ` (Task: ${rule.actions.dialfire_task_name})` : ''}`)
    if (rule.actions.klicktipp_tag) actionsSummary.push(`KlickTipp-Tag "${rule.actions.klicktipp_tag}"`)
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

        if (rule.actions.klicktipp_tag) {
          fieldsToSet.klicktipp_tags = [rule.actions.klicktipp_tag]
          fieldsSummary.klicktipp_tags = [rule.actions.klicktipp_tag]
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

        // Log activity
        await logActivity(
          null,
          contact.id,
          'automation_executed',
          `Batch: Rule ${rule.id} applied (${Object.keys(fieldsToSet).join(', ')})`,
          fieldsSummary
        )

        // Dialfire Sync: Only if campaign or task is set
        // Edge-Function braucht zwingend dialfire_campaign_id -> nur dann syncen
        if (fieldsToSet.dialfire_campaign_id) {
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
