// Geteilte Facebook-Lead-Sync-Logik -- aus src/app/api/sync/facebook-leads/route.ts
// extrahiert, damit sowohl der manuelle "Jetzt synchronisieren"-Button als
// auch der Cron-Trigger (/api/cron/facebook-sync) dieselbe Implementierung
// nutzen, statt sie zu duplizieren.
//
// Seit Phase 3 der Sync-Architektur-Vereinheitlichung zusätzlich an
// sync_runs angebunden: ein run_kind='batch'-Eintrag für den gesamten Lauf,
// je ein run_kind='item'-Eintrag pro Lead darunter (parent_run_id). Das
// bestehende activities-Logging bleibt unverändert (additiv) -- sync_runs
// ermöglicht Fehlerklassifikation + automatischen Retry pro Lead (das rohe
// Lead-Objekt steckt dafür im sync_runs.data-Feld). Seit Phase 5 ist
// sync_runs auch die alleinige Quelle für das Sync-Protokoll auf /sync
// (kein direktes sync_log-Schreiben mehr, siehe sync-log-adapter.ts).
import { createServerClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activities-logger'
import { recordRunStart, recordRunOutcome, runWithTracking, type ResumeRun } from '@/lib/sync-runs/retry-runner'
import { classifyError } from '@/lib/sync-runs/error-classification'

const supabase = createServerClient()

export interface FacebookSyncResult {
  status: number
  body: Record<string, any>
}

export interface FacebookLeadRaw {
  id: string
  created_time?: string
  field_data?: any[]
  qualification_status?: string
  _formId: string
}

export interface FacebookLeadProcessResult {
  outcome: 'linked' | 'created'
  contactId: string
  email: string | null
}

/** Trägt die zum Zeitpunkt des Fehlers bekannte E-Mail mit, damit die Fehlerliste im Sync-Protokoll wie bisher befüllt wird. */
class FacebookLeadError extends Error {
  email: string | null
  constructor(message: string, email: string | null = null) {
    super(message)
    this.email = email
  }
}

/**
 * Verarbeitet einen einzelnen Facebook-Lead: E-Mail-Abgleich, Update/Upsert,
 * Aktivitäts-Log, Notiz. Wirft bei jedem Fehler (statt ihn abzufangen),
 * damit sowohl der normale Lauf als auch ein späterer Retry über
 * runWithTracking()/classifyError() laufen. lead._formId genügt als Kontext
 * für einen Retry -- kein zusätzlicher Parameter nötig.
 */
export async function processFacebookLead(lead: FacebookLeadRaw): Promise<FacebookLeadProcessResult> {
  const formId = lead._formId
  const contact = mapFacebookFieldsToContact(lead.field_data, lead.qualification_status, formId)
  contact.facebook_id = lead.id
  contact.facebook_form_id = formId
  contact.source = 'facebook'

  if (lead.created_time) {
    try {
      contact.created_at = new Date(lead.created_time).toISOString()
    } catch {
      console.warn(`Invalid timestamp for lead ${lead.id}`)
    }
  }

  const hasValidEmail =
    contact.email && typeof contact.email === 'string' && contact.email.trim().length > 0

  let existingByEmail: any = null
  if (hasValidEmail) {
    const { data, error } = await supabase
      .from('contacts')
      .select('id')
      .eq('email', contact.email)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      throw new FacebookLeadError(`Email check failed: ${error.message}`, contact.email ?? null)
    }
    existingByEmail = data
  }

  if (existingByEmail) {
    const { error: updateError } = await supabase
      .from('contacts')
      .update({ facebook_id: lead.id, facebook_form_id: formId })
      .eq('id', existingByEmail.id)

    if (updateError) {
      throw new FacebookLeadError(`Update failed: ${updateError.message}`, contact.email ?? null)
    }

    console.log(`✅ Updated contact ${existingByEmail.id} with Facebook ID`)
    await logActivity(
      null,
      existingByEmail.id,
      'facebook_linked',
      'Facebook lead linked to existing contact',
      { facebook_id: lead.id, form_id: formId }
    )
    return { outcome: 'linked', contactId: existingByEmail.id, email: contact.email ?? null }
  }

  const { data: insertedData, error: insertError } = await supabase
    .from('contacts')
    .upsert([contact], { onConflict: 'facebook_id' })
    .select('id')

  if (insertError) {
    throw new FacebookLeadError(insertError.message, contact.email ?? null)
  }
  if (!insertedData || !insertedData[0]) {
    throw new FacebookLeadError('Upsert lieferte keinen Kontakt zurück', contact.email ?? null)
  }

  const contactId = insertedData[0].id
  console.log(`✅ Contact ${contactId} created/updated from Facebook lead ${lead.id}`)

  await logActivity(
    null,
    contactId,
    'facebook_imported',
    'Lead imported from Facebook form sync',
    {
      facebook_id: lead.id,
      form_id: formId,
      source: 'facebook',
      facebook_phase: contact.facebook_phase || null,
      form_data: lead.field_data || {},
    }
  )

  // Create note with Facebook metadata (Fehler hier waren schon vor der Migration nicht fatal)
  await supabase
    .from('contact_notes_history')
    .insert({
      contact_id: contactId,
      content: `Facebook Lead Import\nForm ID: ${formId}\nLead ID: ${lead.id}\nPhase: ${contact.facebook_phase || 'Neu'}`,
      type: 'facebook_sync',
      category: 'dialfire',
      created_by: 'system',
      metadata: {
        facebook_id: lead.id,
        form_id: formId,
        facebook_phase: contact.facebook_phase,
        form_data: lead.field_data || {},
      },
    })

  return { outcome: 'created', contactId, email: contact.email ?? null }
}

export async function runFacebookLeadSync(triggerType: 'cron' | 'manual' = 'manual'): Promise<FacebookSyncResult> {
  let batchRun: { id: string; attempt_count: number; max_attempts: number } | null = null

  async function failBatch(errorDetail: string) {
    if (!batchRun) return
    const classification = classifyError(new Error(errorDetail))
    await recordRunOutcome(supabase, batchRun, {
      success: false,
      errorClass: classification.errorClass,
      // Batch-Zeilen werden nie erneut "retried" (das wäre der komplette Lauf
      // nochmal) -- der nächste reguläre Cron-Tick ist der faktische Retry.
      retryable: false,
      errorDetail,
    })
  }

  try {
    const accessToken = process.env.FACEBOOK_ACCESS_TOKEN

    if (!accessToken) {
      return { status: 400, body: { error: 'Missing FACEBOOK_ACCESS_TOKEN' } }
    }

    // Support multiple form IDs (comma-separated in env var)
    const formIdString = process.env.FACEBOOK_FORM_IDS || process.env.FACEBOOK_FORM_ID || '1488535808896676'
    const formIds = formIdString.split(',').map(id => id.trim())

    batchRun = await recordRunStart(supabase, {
      runKind: 'batch',
      integration: 'facebook',
      triggerType,
      data: { formIds },
    })

    console.log(`🔄 Starting Facebook Lead sync for forms: ${formIds.join(', ')}`)

    let allLeads: FacebookLeadRaw[] = []
    const maxIterations = 50

    // Fetch leads from all forms
    for (const formId of formIds) {
      console.log(`📥 Fetching leads from form ${formId}...`)

      let after: string | null = null
      let hasMore = true
      let iterations = 0

      while (hasMore && iterations < maxIterations) {
        iterations++

        const url = new URL(`https://graph.facebook.com/v18.0/${formId}/leads`)
        url.searchParams.append('fields', 'id,created_time,field_data,qualification_status')
        url.searchParams.append('limit', '100')

        if (after) {
          url.searchParams.append('after', after)
        }

        console.log(`📥 Fetching batch ${iterations} from form ${formId}...`)

        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error(`Facebook API Error (${response.status}):`, errorText)
          await failBatch(`Facebook API Error (HTTP ${response.status}): ${errorText}`)
          return {
            status: response.status,
            body: { error: 'Facebook API Error', details: errorText, status: response.status },
          }
        }

        let data: any
        try {
          data = await response.json()
        } catch (parseError) {
          console.error('Failed to parse Facebook response:', parseError)
          await failBatch('Invalid JSON response from Facebook')
          return { status: 500, body: { error: 'Invalid JSON response from Facebook' } }
        }

        if (data.data && data.data.length > 0) {
          // Attach formId to each lead for later use
          const leadsWithFormId: FacebookLeadRaw[] = data.data.map((lead: any) => ({ ...lead, _formId: formId }))
          allLeads = [...allLeads, ...leadsWithFormId]
          console.log(
            `✅ Fetched ${data.data.length} leads (total so far: ${allLeads.length})`
          )
        }

        if (data.paging?.cursors?.after) {
          after = data.paging.cursors.after
        } else {
          hasMore = false
        }
      }
    }

    console.log(`📊 Total leads fetched from all forms: ${allLeads.length}`)

    let synced = 0
    let skipped = 0
    let updated = 0
    let errors = 0
    const errorDetails: any[] = []
    const duplicateDetails: any[] = []

    for (const lead of allLeads) {
      try {
        const result = await runWithTracking(
          supabase,
          {
            runKind: 'item',
            integration: 'facebook',
            triggerType,
            parentRunId: batchRun?.id,
            data: { lead },
          },
          () => processFacebookLead(lead)
        )

        if (result.outcome === 'linked') {
          duplicateDetails.push({
            facebook_id: lead.id,
            email: result.email,
            existing_contact_id: result.contactId,
            action: 'linked',
            reason: 'email matched existing contact',
          })
          updated++
        } else {
          synced++
          if (synced % 10 === 0) {
            console.log(`✅ Synced ${synced} contacts...`)
          }
        }
      } catch (leadError) {
        const errorMsg =
          leadError instanceof Error ? leadError.message : String(leadError)
        const email = leadError instanceof FacebookLeadError ? leadError.email : null
        console.error(`Error processing lead ${lead.id}:`, errorMsg)
        errorDetails.push({
          lead_id: lead.id,
          email,
          error_message: errorMsg,
        })
        errors++
      }
    }

    // sync_log wird seit Phase 5 nicht mehr direkt beschrieben -- das
    // Sync-Protokoll auf /sync liest diese Zahlen jetzt aus der bereits
    // gesetzten sync_runs-Batch-Zeile (siehe recordRunOutcome unten) via
    // src/lib/sync-runs/sync-log-adapter.ts.
    console.log(
      `✅ Sync completed! Synced: ${synced}, Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`
    )

    if (batchRun) {
      await recordRunOutcome(supabase, batchRun, {
        success: true,
        data: { synced, updated, skipped, errors, total: allLeads.length },
      })
    }

    return {
      status: 200,
      body: {
        success: errors === 0 || synced > 0,
        totalFetched: allLeads.length,
        synced,
        updated,
        skipped,
        errors,
        error_details: errorDetails,
        duplicate_details: duplicateDetails,
        message: `Successfully synced ${synced + updated} contacts from Facebook`,
      },
    }
  } catch (error) {
    console.error('Sync Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    await failBatch(message)
    return {
      status: 500,
      body: { error: message },
    }
  }
}

/**
 * Verarbeitet einen fälligen Retry für einen einzelnen Facebook-Lead.
 * Genutzt von retry-handlers.ts -- das rohe Lead-Objekt kommt aus
 * sync_runs.data.lead, ein frischer Facebook-API-Call ist dafür nicht nötig.
 */
export async function retryFacebookLead(
  lead: FacebookLeadRaw,
  resumeFrom: ResumeRun
): Promise<FacebookLeadProcessResult> {
  return runWithTracking(
    supabase,
    { runKind: 'item', integration: 'facebook', triggerType: 'auto', data: { lead } },
    () => processFacebookLead(lead),
    resumeFrom
  )
}

function mapFacebookFieldsToContact(fieldData: any[] = [], qualificationStatus?: string, formId?: string): Record<string, any> {
  const contact: Record<string, any> = {
    metadata: {},
  }

  // Store Facebook phase/qualification status
  if (qualificationStatus) {
    contact.facebook_phase = qualificationStatus
  }

  // Set sparte based on form ID
  if (formId === '1251160670355401') {
    contact.sparte = 'PKV'
  } else if (formId === '1488535808896676') {
    contact.sparte = 'Unternehmerschutz'
  } else if (formId === '3169048349946307') {
    contact.sparte = 'Auslandsreiseversicherung'
  }

  const fieldMap: Record<string, string> = {
    email: 'email',
    email_address: 'email',
    first_name: 'first_name',
    last_name: 'last_name',
    phone_number: 'phone_mobile',
    phone: 'phone_mobile',
    company: 'company_name',
    company_name: 'company_name',
    city: 'city',
    state: 'state',
    zip: 'postal_code',
  }

  const customFieldMap: Record<string, string> = {
    'in_welcher_branche_seid_ihr_tätig?': 'industry',
    'welche_absicherung_möchtest_du_prüfen_lassen?': 'sparte',
    'was_möchtest_du_prüfen_lassen?': 'prüfung_grund', // Was soll geprüft werden
    'wie_hoch_ist_euer_jahresumsatz?': 'jahresumsatz',
    'wie_viele_mitarbeitende_habt_ihr?__': 'mitarbeitanzahl',
    'welche_situation_passt_aktuell_am_besten_zu_dir?': 'situation',
    'wie_bist_du_aktuell_krankenversichert?': 'krankenversicherung_status',

    // Auslandsreiseversicherung (KinderProfis, Formular-ID 3169048349946307)
    'wie_viele_personen_sollen_in_der_family__abgesichert_werden?': 'anzahl_personen',
    'wann_verreist_ihr_das_nächste_mal?': 'reisezeitpunkt',
  }

  let fullName = ''

  fieldData.forEach((field) => {
    const fbName = field.name.toLowerCase()
    let value = field.values?.[0]

    if (!value || value.trim() === '') return

    // Clean value: remove bullet points and leading/trailing underscores
    value = value.trim().replace(/^[•_\s]+|[•_\s]+$/g, '').trim()

    if (fbName === 'full_name') {
      fullName = value
    } else if (fieldMap[fbName]) {
      contact[fieldMap[fbName]] = value
    } else if (customFieldMap[fbName]) {
      const mappedField = customFieldMap[fbName]
      // Don't override sparte if it was already set based on form ID
      if (mappedField === 'sparte' && contact.sparte) {
        // Skip: already set from form ID
      } else {
        // Store all custom fields as text (mitarbeitanzahl can be "1_bis_5", "6_bis_20", etc.)
        contact[mappedField] = value
      }
    }

    contact.metadata[fbName] = value
  })

  // Split full_name into first_name and last_name if needed
  if (fullName && !contact.first_name) {
    const nameParts = fullName.split(/\s+/).filter(Boolean)
    if (nameParts.length === 1) {
      contact.first_name = nameParts[0]
      contact.last_name = ''
    } else if (nameParts.length > 1) {
      contact.first_name = nameParts[0]
      contact.last_name = nameParts.slice(1).join(' ')
    }
  }

  return contact
}
