import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const DIALFIRE_API_URL = Deno.env.get("DIALFIRE_API_URL") || "https://api.dialfire.com"

interface DialfireContact {
  $id: string
  $ref: string
  $version: string
  first_name?: string
  vorname?: string
  last_name?: string
  nachname?: string
  email?: string
  $phone?: string
  company_name?: string
  Firmenname?: string
  Firma?: string
  ort?: string
  strasse?: string
  plz?: string
  Tätigkeit?: string
  Genaue_Tätigkeit?: string
  Mitarbeiter?: string | number
  Jahresumsatz?: string
  Anrede?: string
  Rechtsform?: string
  'Geburtstag vom GF/Inhaber'?: string
  'Wie viel Geschäftsführer'?: string | number
  'Seit wann Gewerbe'?: string
  Versicherungsgesellschaft?: string
  Zahlweise?: string
  'Beitrag Vorsorge'?: string | number
  Kontoinhaber?: string
  IBAN?: string
  Bemerkung?: string
  Notizen?: string
  Sparte?: string
  Inhaltssumme?: string
  $task_log?: Array<{
    fired: string
    status: string
    status_detail?: string
    duration?: number
  }>
  $version?: string
}

interface SyncResult {
  contact_id: string
  dialfire_id: string
  sync_status: 'success' | 'error' | 'conflict'
  changed_fields: string[]
  changes: Record<string, { old: any; new: any }>
  error_message?: string
}

// Helper: Get Dialfire API Key from system_config
async function getDialfireApiKey(supabase: any, campaign_id: string): Promise<string | null> {
  const { data } = await supabase
    .from('system_config')
    .select('value')
    .eq('key', `dialfire_api_key_${campaign_id}`)
    .single()

  return data?.value || null
}

// Helper: Fetch Dialfire Contact via flat_view
async function fetchDialfireContact(
  dialfireId: string,
  campaignId: string,
  apiKey: string
): Promise<DialfireContact | null> {
  const url = `${DIALFIRE_API_URL}/api/campaigns/${campaignId}/contacts/${dialfireId}/flat_view`

  console.log(`[Dialfire Pull] Fetching ${dialfireId} from ${campaignId}`)

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) {
      const text = await res.text()
      console.error(`[Dialfire Pull] Error ${res.status}:`, text)
      return null
    }

    return await res.json()
  } catch (err) {
    console.error(`[Dialfire Pull] Fetch error for ${dialfireId}:`, err)
    return null
  }
}

// Helper: Calculate deltas between Sentinel and Dialfire
function calculateDeltas(
  sentinelContact: any,
  dialfireContact: DialfireContact
): { changes: Record<string, { old: any; new: any }>; changedFields: string[] } {
  const changes: Record<string, { old: any; new: any }> = {}

  // Field mapping: Dialfire → Sentinel
  const fieldMap: Record<string, string[]> = {
    first_name: ['first_name', 'vorname'],
    last_name: ['last_name', 'nachname'],
    email: ['email'],
    phone_mobile: ['$phone'],
    company_name: ['company_name', 'Firmenname', 'Firma'],
    city: ['ort'],
    street: ['strasse'],
    postal_code: ['plz'],
    position: ['Tätigkeit'],
    industry: ['Genaue_Tätigkeit'],
    mitarbeitanzahl: ['Mitarbeiter'],
    jahresumsatz: ['Jahresumsatz'],
    anrede: ['Anrede'],
    rechtsform: ['Rechtsform'],
    geburtstag_gf_inhaber: ['Geburtstag vom GF/Inhaber'],
    geschaeftsfuehrer_anzahl: ['Wie viel Geschäftsführer'],
    seit_wann_gewerbe: ['Seit wann Gewerbe'],
    versicherungsgesellschaft: ['Versicherungsgesellschaft'],
    zahlweise: ['Zahlweise'],
    beitrag_vorsorge: ['Beitrag Vorsorge'],
    kontoinhaber: ['Kontoinhaber'],
    iban: ['IBAN'],
    bemerkung: ['Bemerkung', 'Notizen'],
    sparte: ['Sparte'],
    inhaltssumme: ['Inhaltssumme'],
  }

  // Extract Dialfire values (prefer English, fallback to German)
  const dialfireValues: Record<string, any> = {}
  for (const [sentinelField, dialfireFields] of Object.entries(fieldMap)) {
    for (const dialfireField of dialfireFields) {
      if (dialfireContact[dialfireField as keyof DialfireContact] !== undefined) {
        dialfireValues[sentinelField] = dialfireContact[dialfireField as keyof DialfireContact]
        break
      }
    }
  }

  // Extract call info from $task_log
  const lastCall = dialfireContact.$task_log?.[0]
  if (lastCall) {
    dialfireValues['dialfire_last_call_at'] = lastCall.fired
    dialfireValues['dialfire_last_call_status'] = lastCall.status
    dialfireValues['dialfire_call_duration'] = lastCall.duration
    dialfireValues['dialfire_disposition'] = lastCall.status_detail
  }

  dialfireValues['dialfire_retry_count'] = dialfireContact.$task_log?.length || 0
  dialfireValues['dialfire_updated_at'] = new Date().toISOString()

  // Compare and detect changes
  for (const [field, newValue] of Object.entries(dialfireValues)) {
    const oldValue = sentinelContact[field]

    // Normalize for comparison
    const oldNorm = oldValue === null ? undefined : oldValue
    const newNorm = newValue === null ? undefined : newValue

    // Skip if unchanged
    if (oldNorm === newNorm) {
      continue
    }

    // Convert mitarbeitanzahl to int if needed
    let compareNewValue = newValue
    if (field === 'mitarbeitanzahl' && typeof newValue === 'string') {
      compareNewValue = parseInt(newValue, 10)
    }

    changes[field] = { old: oldNorm, new: compareNewValue }
  }

  return {
    changes,
    changedFields: Object.keys(changes),
  }
}

// Helper: Generate auto-note from sync
function generateSyncNote(dialfireContact: DialfireContact, changes: Record<string, any>): string {
  const timestamp = new Date().toLocaleString('de-DE')
  const lastCall = dialfireContact.$task_log?.[0]

  let note = `[Dialfire Sync — ${timestamp}]\n`

  // Call info section
  if (lastCall) {
    note += `Anruf durchgeführt:\n`
    note += `  • Status: ${lastCall.status}\n`
    if (lastCall.duration) {
      note += `  • Dauer: ${Math.round(lastCall.duration / 60)} min\n`
    }
    if (lastCall.status_detail) {
      note += `  • Ergebnis: ${lastCall.status_detail}\n`
    }
    if (dialfireContact.$task_log && dialfireContact.$task_log.length > 1) {
      note += `  • Nächster Versuch: Geplant\n`
    }
    note += '\n'
  }

  // Field changes section
  if (Object.keys(changes).length > 0) {
    note += `Felder aktualisiert:\n`
    for (const [field, delta] of Object.entries(changes)) {
      if (field.startsWith('dialfire_')) {
        continue // Skip dialfire-specific fields in readable output
      }
      note += `  • ${field}: ${delta.old || '—'} → ${delta.new || '—'}\n`
    }
    note += '\n'
  }

  note += `ID: ${dialfireContact.$id}\n`
  note += `Version: ${dialfireContact.$version}`

  return note
}

// Main sync function for a single contact
async function pullSyncContact(
  supabase: any,
  contactId: string,
  dialfireId: string,
  campaignId: string,
  apiKey: string
): Promise<SyncResult> {
  console.log(`[Sync] Starting sync for contact ${contactId}`)

  try {
    // 1. Fetch Dialfire data
    const dialfireContact = await fetchDialfireContact(dialfireId, campaignId, apiKey)
    if (!dialfireContact) {
      throw new Error('Failed to fetch Dialfire contact')
    }

    // 2. Get current Sentinel contact
    const { data: sentinelContact, error: fetchError } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .single()

    if (fetchError) {
      throw new Error(`Failed to fetch Sentinel contact: ${fetchError.message}`)
    }

    // 3. Calculate deltas
    const { changes, changedFields } = calculateDeltas(sentinelContact, dialfireContact)

    // 4. If no changes, skip
    if (changedFields.length === 0) {
      console.log(`[Sync] No changes for ${contactId}`)
      return {
        contact_id: contactId,
        dialfire_id: dialfireId,
        sync_status: 'success',
        changed_fields: [],
        changes: {},
      }
    }

    // 5. Store before snapshot
    const beforeSnapshot = sentinelContact

    // 6. Update contact with Dialfire data
    const updateData: Record<string, any> = {}
    for (const [field, delta] of Object.entries(changes)) {
      updateData[field] = delta.new
    }

    const { error: updateError } = await supabase
      .from('contacts')
      .update(updateData)
      .eq('id', contactId)

    if (updateError) {
      throw new Error(`Failed to update contact: ${updateError.message}`)
    }

    // 7. Fetch updated contact for after snapshot
    const { data: updatedContact } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .single()

    // 8. Store audit trail
    const { error: syncLogError } = await supabase
      .from('dialfire_sync_log')
      .insert({
        contact_id: contactId,
        dialfire_id: dialfireId,
        sync_status: 'success',
        changed_fields: changedFields,
        changes,
        dialfire_version: dialfireContact.$version,
      })

    if (syncLogError) {
      console.error(`[Sync] Failed to log sync: ${syncLogError.message}`)
    }

    // 9. Store snapshot
    const { error: snapshotError } = await supabase
      .from('dialfire_sync_snapshots')
      .insert({
        contact_id: contactId,
        dialfire_id: dialfireId,
        before_snapshot: beforeSnapshot,
        dialfire_flat_view: dialfireContact,
        after_snapshot: updatedContact,
      })

    if (snapshotError) {
      console.error(`[Sync] Failed to store snapshot: ${snapshotError.message}`)
    }

    // 10. Generate and store auto-note
    const autoNote = generateSyncNote(dialfireContact, changes)
    const { data: latestHistory } = await supabase
      .from('contact_notes_history')
      .select('version')
      .eq('contact_id', contactId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle() // Use maybeSingle instead of single - handles empty result

    const nextVersion = (latestHistory?.version || 0) + 1

    const { error: noteError } = await supabase
      .from('contact_notes_history')
      .insert({
        contact_id: contactId,
        content: autoNote,
        source: 'dialfire_sync',
        source_metadata: {
          dialfire_id: dialfireId,
          changes,
          call_info: dialfireContact.$task_log?.[0]
            ? {
              last_call_at: dialfireContact.$task_log[0].fired,
              last_call_status: dialfireContact.$task_log[0].status,
              duration: dialfireContact.$task_log[0].duration,
            }
            : null,
        },
        version: nextVersion,
        created_by: 'system',
      })

    if (noteError) {
      console.error(`[Sync] Failed to store note: ${noteError.message}`)
    }

    // 11. Create activity log
    const { error: activityError } = await supabase
      .from('activities')
      .insert({
        lead_id: contactId,
        type: 'dialfire_synced',
        description: `Dialfire Sync — ${changedFields.length} Felder aktualisiert`,
        metadata: {
          changed_fields: changedFields,
          changes_count: changedFields.length,
          call_info: dialfireContact.$task_log?.[0]
            ? {
              last_call_at: dialfireContact.$task_log[0].fired,
              last_call_status: dialfireContact.$task_log[0].status,
              retry_count: dialfireContact.$task_log?.length || 0,
            }
            : null,
        },
      })

    if (activityError) {
      console.error(`[Sync] Failed to create activity: ${activityError.message}`)
    }

    console.log(`✅ Synced ${contactId}: ${changedFields.length} fields updated`)

    return {
      contact_id: contactId,
      dialfire_id: dialfireId,
      sync_status: 'success',
      changed_fields: changedFields,
      changes,
    }
  } catch (err) {
    console.error(`[Sync] Error for ${contactId}:`, err)

    // Log error
    try {
      await supabase
        .from('dialfire_sync_log')
        .insert({
          contact_id: contactId,
          dialfire_id: dialfireId,
          sync_status: 'error',
          error_message: String(err),
        })
    } catch (logErr) {
      console.error('Failed to log error:', logErr)
    }

    return {
      contact_id: contactId,
      dialfire_id: dialfireId,
      sync_status: 'error',
      changed_fields: [],
      changes: {},
      error_message: String(err),
    }
  }
}

// Main Edge Function handler
serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase credentials')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { contact_id, dialfire_id, campaign_id } = await req.json()

    if (!contact_id || !dialfire_id || !campaign_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: contact_id, dialfire_id, campaign_id' }),
        { status: 400 }
      )
    }

    // Get API key for this campaign
    const apiKey = await getDialfireApiKey(supabase, campaign_id)
    if (!apiKey) {
      // Fallback to env var for backward compatibility
      const fallbackKey = campaign_id === 'GENS85UE5SU4SSC7'
        ? Deno.env.get('DIALFIRE_API_KEY')
        : Deno.env.get('DIALFIRE_API_KEY_FACEBOOK')

      if (!fallbackKey) {
        throw new Error(`No API key found for campaign ${campaign_id}`)
      }

      // Perform sync
      const result = await pullSyncContact(
        supabase,
        contact_id,
        dialfire_id,
        campaign_id,
        fallbackKey
      )

      return new Response(
        JSON.stringify({ success: result.sync_status === 'success', result }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Perform sync
    const result = await pullSyncContact(
      supabase,
      contact_id,
      dialfire_id,
      campaign_id,
      apiKey
    )

    return new Response(
      JSON.stringify({ success: result.sync_status === 'success', result }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Error:', err)
    return new Response(
      JSON.stringify({ error: String(err), success: false }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
