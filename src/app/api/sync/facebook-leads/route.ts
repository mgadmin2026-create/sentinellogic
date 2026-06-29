import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logActivity } from '@/lib/activities-logger'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const formId = process.env.FACEBOOK_FORM_ID || '1488535808896676'
    const accessToken = process.env.FACEBOOK_ACCESS_TOKEN

    if (!accessToken) {
      return new NextResponse(
        JSON.stringify({ error: 'Missing FACEBOOK_ACCESS_TOKEN' }),
        { status: 400 }
      )
    }

    console.log(`🔄 Starting Facebook Lead sync for form ${formId}`)

    let allLeads: any[] = []
    let after: string | null = null
    let hasMore = true
    let iterations = 0
    const maxIterations = 50

    while (hasMore && iterations < maxIterations) {
      iterations++

      const url = new URL(`https://graph.facebook.com/v18.0/${formId}/leads`)
      url.searchParams.append('fields', 'id,created_time,field_data,qualification_status')
      url.searchParams.append('limit', '100')

      if (after) {
        url.searchParams.append('after', after)
      }

      console.log(`📥 Fetching batch ${iterations}...`)

      // FIX 1: Use Authorization header instead of query parameter
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Facebook API Error (${response.status}):`, errorText)
        return new NextResponse(
          JSON.stringify({
            error: 'Facebook API Error',
            details: errorText,
            status: response.status,
          }),
          { status: response.status }
        )
      }

      let data: any
      try {
        data = await response.json()
      } catch (parseError) {
        console.error('Failed to parse Facebook response:', parseError)
        return new NextResponse(
          JSON.stringify({ error: 'Invalid JSON response from Facebook' }),
          { status: 500 }
        )
      }

      if (data.data && data.data.length > 0) {
        allLeads = [...allLeads, ...data.data]
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

    console.log(`📊 Total leads fetched: ${allLeads.length}`)

    let synced = 0
    let skipped = 0
    let updated = 0
    let errors = 0
    const errorDetails: any[] = []
    const duplicateDetails: any[] = []

    for (const lead of allLeads) {
      try {
        const contact = mapFacebookFieldsToContact(lead.field_data)
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

        // Email validation before duplicate check
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
            console.error('Error checking existing email:', error)
            errorDetails.push({
              lead_id: lead.id,
              email: contact.email,
              error_message: `Email check failed: ${error.message}`,
            })
            errors++
            continue
          }

          existingByEmail = data
        }

        if (existingByEmail) {
          const { error: updateError } = await supabase
            .from('contacts')
            .update({
              facebook_id: lead.id,
              facebook_form_id: formId,
            })
            .eq('id', existingByEmail.id)

          if (updateError) {
            console.error('Error updating contact with facebook_id:', updateError)
            errorDetails.push({
              lead_id: lead.id,
              email: contact.email,
              error_message: `Update failed: ${updateError.message}`,
            })
            errors++
          } else {
            console.log(`✅ Updated contact ${existingByEmail.id} with Facebook ID`)
            duplicateDetails.push({
              facebook_id: lead.id,
              email: contact.email,
              existing_contact_id: existingByEmail.id,
              action: 'linked',
              reason: 'email matched existing contact',
            })
            await logActivity(
              null,
              existingByEmail.id,
              'facebook_linked',
              'Facebook lead linked to existing contact',
              {
                facebook_id: lead.id,
                form_id: formId,
              }
            )
            updated++
          }
          continue
        }

        const { data: insertedData, error: insertError } = await supabase
          .from('contacts')
          .upsert([contact], { onConflict: 'facebook_id' })
          .select('id')

        if (insertError) {
          console.error(`Error upserting lead ${lead.id}:`, insertError)
          errorDetails.push({
            lead_id: lead.id,
            email: contact.email,
            error_message: insertError.message,
          })
          errors++
        } else if (insertedData && insertedData[0]) {
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

          // Create note with Facebook metadata
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

          synced++
          if (synced % 10 === 0) {
            console.log(`✅ Synced ${synced} contacts...`)
          }
        }
      } catch (leadError) {
        const errorMsg =
          leadError instanceof Error ? leadError.message : String(leadError)
        console.error(`Error processing lead ${lead.id}:`, errorMsg)
        errorDetails.push({
          lead_id: lead.id,
          email: null,
          error_message: errorMsg,
        })
        errors++
      }
    }

    // Log sync to sync_log table
    const syncStatus = errors > 0 ? (synced > 0 ? 'partial' : 'error') : 'success'
    const { error: syncLogError } = await supabase
      .from('sync_log')
      .insert([
        {
          source: 'facebook',
          count: synced + updated,
          duplicates_skipped: skipped,
          status: syncStatus,
          message: `Synced: ${synced}, Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`,
          lead_ids: [],
          lead_names: [],
          error_details: errorDetails,
          duplicate_details: duplicateDetails,
        },
      ])

    if (syncLogError) {
      console.error('Error logging sync to sync_log:', syncLogError)
    }

    console.log(
      `✅ Sync completed! Synced: ${synced}, Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`
    )

    return new NextResponse(
      JSON.stringify({
        success: errors === 0 || synced > 0,
        totalFetched: allLeads.length,
        synced,
        updated,
        skipped,
        errors,
        error_details: errorDetails,
        duplicate_details: duplicateDetails,
        message: `Successfully synced ${synced + updated} contacts from Facebook`,
      }),
      { status: 200 }
    )
  } catch (error) {
    console.error('Sync Error:', error)
    return new NextResponse(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500 }
    )
  }
}

function mapFacebookFieldsToContact(fieldData: any[] = [], qualificationStatus?: string): Record<string, any> {
  const contact: Record<string, any> = {
    metadata: {},
  }

  // Store Facebook phase/qualification status
  if (qualificationStatus) {
    contact.facebook_phase = qualificationStatus
  }

  const fieldMap: Record<string, string> = {
    email: 'email',
    email_address: 'email',
    first_name: 'first_name',
    last_name: 'last_name',
    phone_number: 'phone_mobile',
    phone: 'phone_mobile',
    company: 'company_name',
    city: 'city',
    state: 'state',
    zip: 'postal_code',
  }

  const customFieldMap: Record<string, string> = {
    'in_welcher_branche_seid_ihr_tätig?': 'industry',
    'welche_absicherung_möchtest_du_prüfen_lassen?': 'insurance_product',
    'wie_hoch_ist_euer_jahresumsatz?': 'jahresumsatz',
    'wie_viele_mitarbeitende_habt_ihr?__': 'mitarbeiterzahl',
  }

  let fullName = ''

  fieldData.forEach((field) => {
    const fbName = field.name.toLowerCase()
    const value = field.values?.[0]

    if (!value || value.trim() === '') return

    if (fbName === 'full_name') {
      fullName = value.trim()
    } else if (fieldMap[fbName]) {
      contact[fieldMap[fbName]] = value.trim()
    } else if (customFieldMap[fbName]) {
      contact[customFieldMap[fbName]] = value.trim()
    }

    contact.metadata[fbName] = value.trim()
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
