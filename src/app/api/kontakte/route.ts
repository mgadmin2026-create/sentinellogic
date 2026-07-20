// API Route: Kontakte-Verwaltung (neue contacts-Tabelle)
// GET  /api/kontakte — alle Kontakte abrufen
// POST /api/kontakte — neuen Kontakt anlegen
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { executeAutomation } from '@/lib/automation-engine'
import { logActivity, logContactCreated } from '@/lib/activities-logger'
import { getCurrentUser } from '@/lib/auth'
import { syncContactToKlickTipp } from '@/lib/klicktipp-client'
import { detectTestContact } from '@/lib/test-data'

// Helper: Rufe Edge Function auf
async function invokeEdgeFunction(functionName: string, payload: any) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  console.log('[invokeEdgeFunction] Starting', { functionName, url: supabaseUrl, hasKey: !!supabaseKey })

  if (!supabaseUrl || !supabaseKey) {
    console.warn('[invokeEdgeFunction] Missing env vars', { url: !!supabaseUrl, key: !!supabaseKey })
    return null
  }

  const url = `${supabaseUrl}/functions/v1/${functionName}`

  try {
    console.log('[invokeEdgeFunction] Calling:', url)
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify(payload),
    })

    console.log('[invokeEdgeFunction] Response status:', res.status)
    const result = await res.json()
    console.log('[invokeEdgeFunction] Result:', result)
    return result
  } catch (err) {
    console.error(`[invokeEdgeFunction] ${functionName} error:`, err)
    return null
  }
}
const VALID_STATUSES = ['new', 'contacted', 'qualified', 'customer']
const VALID_SOURCES = ['facebook', 'tiktok', 'calendly', 'csv', 'email', 'manuell', 'ki_upload']

// Pipeline-Schritte für Init
const PIPELINE_STEPS_DEF = [
  'lead_in', 'contacted', 'data_gathering', 'wait_policies', 'calc_offers',
  'download_offers', 'contract_overview', 'send_offers', 'offer_meeting',
  'sales_talk', 'contracts_store', 'aftercare'
]

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') ?? '100', 10)
    const status = url.searchParams.get('status')
    const search = url.searchParams.get('search')
    const includeArchived = url.searchParams.get('includeArchived') === 'true'

    let query = supabase.from('contacts').select('*').order('created_at', { ascending: false })

    if (!includeArchived) {
      query = query.is('archived_at', null)
    }

    if (status && VALID_STATUSES.includes(status)) {
      query = query.eq('status', status)
    }

    if (search) {
      const q = `%${search}%`
      query = query.or(`first_name.ilike.${q},last_name.ilike.${q},email.ilike.${q},company_name.ilike.${q}`)
    }

    const { data, error } = await query.limit(limit)

    if (error) {
      console.error('[GET /api/kontakte] Fehler:', error)
      return Response.json({ success: false, error: error.message }, { status: 500 })
    }

    // Tags gebündelt nachladen (ein Query statt N+1)
    let contacts = data ?? []
    if (contacts.length > 0) {
      const { data: tagRows } = await supabase
        .from('contact_tag_map')
        .select('contact_id, tag:tag_id(id, name)')
        .in('contact_id', contacts.map((c) => c.id))

      const tagsByContact = new Map<string, { id: string; name: string }[]>()
      for (const row of tagRows ?? []) {
        const list = tagsByContact.get((row as any).contact_id) ?? []
        list.push((row as any).tag)
        tagsByContact.set((row as any).contact_id, list)
      }
      contacts = contacts.map((c) => ({ ...c, tags: tagsByContact.get(c.id) ?? [] }))
    }

    return Response.json({ success: true, data: contacts })
  } catch (err) {
    console.error('[GET /api/kontakte] Fehler:', err)
    return Response.json({ success: false, error: 'Kontakte konnten nicht geladen werden' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const body = await request.json()

    console.log('[POST /api/kontakte] Body:', { klicktipp_tag: body.klicktipp_tag, email: body.email })

    // Pflichtfelder — E-Mail ist optional (KI-Upload: Dokumente enthalten oft keine Kunden-E-Mail)
    if (!body.first_name || !body.last_name) {
      return Response.json(
        { success: false, error: 'Felder erforderlich: first_name, last_name' },
        { status: 400 }
      )
    }

    // E-Mail normalisieren (null wenn nicht vorhanden)
    const email = body.email ? String(body.email).trim().toLowerCase() : null

    // Testdaten werden nur bei vollständig sichtbarer Konvention technisch markiert.
    const testContact = detectTestContact({
      first_name: body.first_name,
      email,
      company_name: body.company_name,
    })

    if (testContact.hasTestSignal && !testContact.isTestData) {
      return Response.json(
        {
          success: false,
          error: 'Unvollständige Testdaten-Kennzeichnung. Erforderlich: Vorname [TEST], Firma [TESTDATEN] … und E-Mail pw+<lauf-id>@example.invalid.',
        },
        { status: 400 }
      )
    }

    // Duplikatprüfung (E-Mail + Name — case-insensitive)
    // Zuerst E-Mail prüfen
    if (email) {
      const { data: emailMatch } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, email')
        .ilike('email', email)
        .limit(1)
        .maybeSingle()

      if (emailMatch) {
        return Response.json(
          {
            success: false,
            error: `Duplikat: Kontakt mit dieser E-Mail existiert bereits (${emailMatch.first_name} ${emailMatch.last_name}).`,
            duplicate: true,
            existing: emailMatch,
          },
          { status: 409 }
        )
      }
    }

    // Dann Name prüfen
    const { data: nameMatch } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, email')
      .eq('first_name', String(body.first_name).trim())
      .eq('last_name', String(body.last_name).trim())
      .limit(1)
      .maybeSingle()

    if (nameMatch) {
      return Response.json(
        {
          success: false,
          error: `Duplikat: Kontakt mit diesem Namen existiert bereits (${nameMatch.email || 'keine E-Mail'}).`,
          duplicate: true,
          existing: nameMatch,
        },
        { status: 409 }
      )
    }

    // Initialisiere Pipeline-Steps (alle Schritte als nicht erledigt)
    const initialPipelineSteps = PIPELINE_STEPS_DEF.map(key => ({
      key,
      done: false,
      completed_at: null,
      due_date: null,
    }))

    // Neue Kontakt anlegen
    const kontaktData = {
      first_name: String(body.first_name).trim(),
      last_name: String(body.last_name).trim(),
      email,
      phone_mobile: body.phone_mobile ? String(body.phone_mobile).trim() : null,
      phone_office: body.phone_office ? String(body.phone_office).trim() : null,
      company_name: body.company_name ? String(body.company_name).trim() : null,
      industry: body.industry ? String(body.industry).trim() : null,
      position: body.position ? String(body.position).trim() : null,
      street: body.street ? String(body.street).trim() : null,
      postal_code: body.postal_code ? String(body.postal_code).trim() : null,
      city: body.city ? String(body.city).trim() : null,
      country: body.country ? String(body.country).trim() : null,
      website: body.website ? String(body.website).trim() : null,
      mitarbeitanzahl: body.mitarbeitanzahl ? parseInt(String(body.mitarbeitanzahl), 10) : null,
      jahresumsatz: body.jahresumsatz ? String(body.jahresumsatz).trim() : null,
      source: VALID_SOURCES.includes(String(body.source ?? 'manuell')) ? body.source : 'manuell',
      status: VALID_STATUSES.includes(String(body.status ?? 'new')) ? body.status : 'new',
      kontakt_typ: ['privat', 'gewerbe'].includes(String(body.kontakt_typ)) ? body.kontakt_typ : 'gewerbe',
      assigned_user_id: body.assigned_user_id ?? null,
      notes: body.notes ? String(body.notes).trim() : null,
      pipeline_stage: 'lead_in',
      pipeline_steps: initialPipelineSteps,
      // Dialfire Integration
      dialfire_campaign_id: body.dialfire_campaign_id ? String(body.dialfire_campaign_id).trim() : null,
      dialfire_task_name_field: body.dialfire_task_name_field ? String(body.dialfire_task_name_field).trim() : null,
      // PKV Insurance Fields
      geburtstag: body.geburtstag ? String(body.geburtstag).trim() : null,
      jahreseinkommen: body.jahreseinkommen ? String(body.jahreseinkommen).trim() : null,
      groesse: body.groesse ? parseInt(String(body.groesse), 10) : null,
      gewicht: body.gewicht ? parseInt(String(body.gewicht), 10) : null,
      gesundheitszustand: body.gesundheitszustand ? String(body.gesundheitszustand).trim() : null,
      seit_wann_selbststaendig: body.seit_wann_selbststaendig ? String(body.seit_wann_selbststaendig).trim() : null,
      dienstverhaltnis: body.dienstverhaltnis ? String(body.dienstverhaltnis).trim() : null,
      // Insurance Records (1-5)
      versicherungsgesellschaft_1: body.versicherungsgesellschaft_1 ? String(body.versicherungsgesellschaft_1).trim() : null,
      leistungen_1: body.leistungen_1 ? String(body.leistungen_1).trim() : null,
      aktueller_beitrag_1: body.aktueller_beitrag_1 ? String(body.aktueller_beitrag_1).trim() : null,
      kontoinhaber_1: body.kontoinhaber_1 ? String(body.kontoinhaber_1).trim() : null,
      iban_1: body.iban_1 ? String(body.iban_1).trim() : null,
      versicherungsgesellschaft_2: body.versicherungsgesellschaft_2 ? String(body.versicherungsgesellschaft_2).trim() : null,
      leistungen_2: body.leistungen_2 ? String(body.leistungen_2).trim() : null,
      aktueller_beitrag_2: body.aktueller_beitrag_2 ? String(body.aktueller_beitrag_2).trim() : null,
      kontoinhaber_2: body.kontoinhaber_2 ? String(body.kontoinhaber_2).trim() : null,
      iban_2: body.iban_2 ? String(body.iban_2).trim() : null,
      versicherungsgesellschaft_3: body.versicherungsgesellschaft_3 ? String(body.versicherungsgesellschaft_3).trim() : null,
      leistungen_3: body.leistungen_3 ? String(body.leistungen_3).trim() : null,
      aktueller_beitrag_3: body.aktueller_beitrag_3 ? String(body.aktueller_beitrag_3).trim() : null,
      kontoinhaber_3: body.kontoinhaber_3 ? String(body.kontoinhaber_3).trim() : null,
      iban_3: body.iban_3 ? String(body.iban_3).trim() : null,
      versicherungsgesellschaft_4: body.versicherungsgesellschaft_4 ? String(body.versicherungsgesellschaft_4).trim() : null,
      leistungen_4: body.leistungen_4 ? String(body.leistungen_4).trim() : null,
      aktueller_beitrag_4: body.aktueller_beitrag_4 ? String(body.aktueller_beitrag_4).trim() : null,
      kontoinhaber_4: body.kontoinhaber_4 ? String(body.kontoinhaber_4).trim() : null,
      iban_4: body.iban_4 ? String(body.iban_4).trim() : null,
      versicherungsgesellschaft_5: body.versicherungsgesellschaft_5 ? String(body.versicherungsgesellschaft_5).trim() : null,
      leistungen_5: body.leistungen_5 ? String(body.leistungen_5).trim() : null,
      aktueller_beitrag_5: body.aktueller_beitrag_5 ? String(body.aktueller_beitrag_5).trim() : null,
      kontoinhaber_5: body.kontoinhaber_5 ? String(body.kontoinhaber_5).trim() : null,
      iban_5: body.iban_5 ? String(body.iban_5).trim() : null,
      notizen_2: body.notizen_2 ? String(body.notizen_2).trim() : null,
      // Extended Dialfire Fields
      hausnummer: body.hausnummer ? String(body.hausnummer).trim() : null,
      prüfung_grund: body.prüfung_grund ? String(body.prüfung_grund).trim() : null,
      krankenversicherung_status: body.krankenversicherung_status ? String(body.krankenversicherung_status).trim() : null,
      situation: body.situation ? String(body.situation).trim() : null,
      // Klassifikation / Gewerbe-Felder (bisher beim Anlegen fälschlich nicht übernommen)
      sparte: body.sparte ? String(body.sparte).trim() : null,
      qualität: body.qualität ? String(body.qualität).trim() : null,
      bestandskunde: body.bestandskunde === true || body.bestandskunde === 'true',
      versicherungstyp: body.versicherungstyp ? String(body.versicherungstyp).trim() : null,
      rechtsform: body.rechtsform ? String(body.rechtsform).trim() : null,
      anrede: body.anrede ? String(body.anrede).trim() : null,
      bemerkung: body.bemerkung ? String(body.bemerkung).trim() : null,
      versicherungsgesellschaft: body.versicherungsgesellschaft ? String(body.versicherungsgesellschaft).trim() : null,
      zahlweise: body.zahlweise ? String(body.zahlweise).trim() : null,
      kontoinhaber: body.kontoinhaber ? String(body.kontoinhaber).trim() : null,
      iban: body.iban ? String(body.iban).trim() : null,
      inhaltssumme: body.inhaltssumme ? String(body.inhaltssumme).trim() : null,
      beitrag_vorsorge: body.beitrag_vorsorge ? parseFloat(String(body.beitrag_vorsorge)) : null,
      geburtstag_gf_inhaber: body.geburtstag_gf_inhaber ? String(body.geburtstag_gf_inhaber).trim() : null,
      geschaeftsfuehrer_anzahl: body.geschaeftsfuehrer_anzahl ? parseInt(String(body.geschaeftsfuehrer_anzahl), 10) : null,
      seit_wann_gewerbe: body.seit_wann_gewerbe ? String(body.seit_wann_gewerbe).trim() : null,
      // Marker-Spalten erst bei Testdaten mitsenden: Reguläre Kontakte bleiben
      // auch während des kontrollierten Migration-Rollouts uneingeschränkt nutzbar.
      ...(testContact.isTestData
        ? { is_test_data: true, test_run_id: testContact.testRunId }
        : {}),
    }

    const { data, error } = await supabase
      .from('contacts')
      .insert([kontaktData])
      .select()
      .single()

    if (error) {
      console.error('[POST /api/kontakte] Fehler:', error)
      return Response.json({ success: false, error: error.message }, { status: 500 })
    }

    // Log activity
    if (data?.id) {
      const currentUser = await getCurrentUser()
      await logContactCreated(data.id, `${data.first_name} ${data.last_name}`, currentUser?.id)
    }

    // Execute automation rules (if not disabled)
    const automationDisabled = body.automation_disabled === true || testContact.isTestData
    if (data?.id) {
      const automationResult = await executeAutomation(
        data.id,
        data.source,
        automationDisabled,
        data.sparte
      )
      if (automationResult.error) {
        console.warn('[Automation] Failed:', automationResult.error)
      }
    }

    // KlickTipp Sync: Synce neuen Kontakt zu KlickTipp mit Tag "Sentinel"
    if (data?.id && data?.email && !testContact.isTestData) {
      try {
        const klicktippResult = await syncContactToKlickTipp({
          id: data.id,
          email: data.email,
          first_name: data.first_name,
          last_name: data.last_name,
          company_name: data.company_name,
          city: data.city,
          country: data.country,
          phone_mobile: data.phone_mobile,
          website: data.website,
          tagName: 'Sentinel', // Auto-assign "Sentinel" tag
        })

        // Speichere KlickTipp ID
        await supabase
          .from('contacts')
          .update({
            klicktipp_id: klicktippResult.id,
            klicktipp_tags: klicktippResult.tags || [],
            klicktipp_last_sync: new Date().toISOString(),
          })
          .eq('id', data.id)

        console.log(`✅ [KlickTipp] Kontakt synced: ${data.email} (KlickTipp ID: ${klicktippResult.id})`)
        await logActivity(null, data.id, 'klicktipp_synced', `KlickTipp synced mit Tag "Sentinel"`)
      } catch (err) {
        console.error(`[KlickTipp] Sync failed für ${data.email}:`, err)
        await logActivity(null, data.id, 'klicktipp_sync_failed', `KlickTipp sync failed: ${String(err)}`)
      }
    }

    // Dialfire Sync: Nur wenn Dialfire-Daten vorhanden
    // Lade aktualisierte Daten nach Automation um dialfire_campaign_id zu checken
    let updatedContact: any = null
    if (data?.id) {
      const { data: contactData } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', data.id)
        .single()
      updatedContact = contactData
    }

    // Edge-Function braucht zwingend dialfire_campaign_id -> nur dann syncen
    if (data?.id && updatedContact?.dialfire_campaign_id && !testContact.isTestData) {
      try {
        const c = updatedContact ?? data
        const dialfireResult = await invokeEdgeFunction('send-to-dialfire', {
          contact: {
            id: data.id,
            email: c.email,
            first_name: c.first_name,
            last_name: c.last_name,
            phone_mobile: c.phone_mobile || c.phone_office,
            company_name: c.company_name,
            street: c.street,
            postal_code: c.postal_code,
            city: c.city,
            position: c.position,
            industry: c.industry,
            source: c.source,
            mitarbeitanzahl: c.mitarbeitanzahl,
            jahresumsatz: c.jahresumsatz,
            anrede: c.anrede,
            geburtstag: c.geburtstag,
            jahreseinkommen: c.jahreseinkommen,
            groesse: c.groesse,
            gewicht: c.gewicht,
            gesundheitszustand: c.gesundheitszustand,
            seit_wann_selbststaendig: c.seit_wann_selbststaendig,
            dienstverhaltnis: c.dienstverhaltnis,
            hausnummer: c.hausnummer,
            prüfung_grund: c.prüfung_grund,
            krankenversicherung_status: c.krankenversicherung_status,
            situation: c.situation,
            versicherungsgesellschaft_1: c.versicherungsgesellschaft_1,
            leistungen_1: c.leistungen_1,
            aktueller_beitrag_1: c.aktueller_beitrag_1,
            kontoinhaber_1: c.kontoinhaber_1,
            iban_1: c.iban_1,
            versicherungsgesellschaft_2: c.versicherungsgesellschaft_2,
            leistungen_2: c.leistungen_2,
            aktueller_beitrag_2: c.aktueller_beitrag_2,
            kontoinhaber_2: c.kontoinhaber_2,
            iban_2: c.iban_2,
            versicherungsgesellschaft_3: c.versicherungsgesellschaft_3,
            leistungen_3: c.leistungen_3,
            aktueller_beitrag_3: c.aktueller_beitrag_3,
            kontoinhaber_3: c.kontoinhaber_3,
            iban_3: c.iban_3,
            versicherungsgesellschaft_4: c.versicherungsgesellschaft_4,
            leistungen_4: c.leistungen_4,
            aktueller_beitrag_4: c.aktueller_beitrag_4,
            kontoinhaber_4: c.kontoinhaber_4,
            iban_4: c.iban_4,
            versicherungsgesellschaft_5: c.versicherungsgesellschaft_5,
            leistungen_5: c.leistungen_5,
            aktueller_beitrag_5: c.aktueller_beitrag_5,
            kontoinhaber_5: c.kontoinhaber_5,
            iban_5: c.iban_5,
            notizen_2: c.notizen_2,
            dialfire_campaign_id: updatedContact?.dialfire_campaign_id,
            dialfire_task_name_field: updatedContact?.dialfire_task_name_field,
          },
        })

        if (!dialfireResult) {
          console.warn(`[Dialfire] invokeEdgeFunction returned null for ${data.email}`)
          await logActivity(null, data.id, 'dialfire_sync_failed', 'Dialfire sync failed: Edge Function call failed or returned null')
        } else if (dialfireResult?.success) {
          const dialfireId = dialfireResult.dialfire_id

          // Speichere dialfire_id in Supabase
          const { error: updateError } = await supabase
            .from('contacts')
            .update({
              dialfire_id: dialfireId,
            })
            .eq('id', data.id)

          if (updateError) {
            console.error(`[Dialfire] Fehler beim Speichern der ID: ${updateError.message}`)
          } else {
            console.log(`[Dialfire] Sync erfolgreich: ${data.email} -> ID: ${dialfireId}`)
          }

          await logActivity(null, data.id, 'dialfire_synced', `Dialfire synced (task: ${process.env.DIALFIRE_TASK_NAME || 'call'}, ID: ${dialfireId})`)
        } else {
          console.warn(`[Dialfire] Sync fehlgeschlagen für ${data.email}: ${dialfireResult?.error}`)
          await logActivity(null, data.id, 'dialfire_sync_failed', `Dialfire sync failed: ${dialfireResult?.error || 'Unknown error'}`)
        }
      } catch (err) {
        console.error(`[Dialfire] Fehler beim Sync für ${data.email}:`, err)
        await logActivity(null, data.id, 'dialfire_sync_failed', `Dialfire sync failed: ${String(err)}`)
      }
    }

    return Response.json({ success: true, data }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/kontakte] Fehler:', err)
    return Response.json({ success: false, error: 'Kontakt konnte nicht erstellt werden' }, { status: 500 })
  }
}
