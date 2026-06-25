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
      url.searchParams.append('fields', 'id,created_time,field_data')
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
    let errors = 0

    for (const lead of allLeads) {
      try {
        const { data: existing, error: checkError } = await supabase
          .from('contacts')
          .select('id')
          .eq('facebook_id', lead.id)
          .maybeSingle()

        if (checkError && checkError.code !== 'PGRST116') {
          console.error(`Error checking lead ${lead.id}:`, checkError)
          errors++
          continue
        }

        if (existing) {
          skipped++
          continue
        }

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

        // FIX 2: Email validation before duplicate check
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
            errors++
          } else {
            console.log(`✅ Updated contact ${existingByEmail.id} with Facebook ID`)
            // FIX 3: Log activity for linked contact
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
            skipped++
          }
          continue
        }

        const { data: insertedData, error: insertError } = await supabase
          .from('contacts')
          .insert([contact])
          .select('id')

        if (insertError) {
          if (insertError.code === '23505') {
            console.log(`Duplicate facebook_id detected for ${lead.id}`)
            skipped++
          } else {
            console.error(`Error inserting lead ${lead.id}:`, insertError)
            errors++
          }
        } else if (insertedData && insertedData[0]) {
          const contactId = insertedData[0].id
          console.log(`✅ Contact ${contactId} created from Facebook lead ${lead.id}`)

          // FIX 3: Log activity for new contact
          await logActivity(
            null,
            contactId,
            'facebook_imported',
            'Lead imported from Facebook form sync',
            {
              facebook_id: lead.id,
              form_id: formId,
              source: 'facebook',
            }
          )

          synced++
          if (synced % 10 === 0) {
            console.log(`✅ Synced ${synced} contacts...`)
          }
        }
      } catch (leadError) {
        const errorMsg =
          leadError instanceof Error ? leadError.message : String(leadError)
        console.error(`Error processing lead ${lead.id}:`, errorMsg)
        errors++
      }
    }

    console.log(
      `✅ Sync completed! Synced: ${synced}, Skipped: ${skipped}, Errors: ${errors}`
    )

    return new NextResponse(
      JSON.stringify({
        success: true,
        totalFetched: allLeads.length,
        synced,
        skipped,
        errors,
        message: `Successfully synced ${synced} contacts from Facebook`,
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

function mapFacebookFieldsToContact(fieldData: any[] = []): Record<string, any> {
  const contact: Record<string, any> = {
    metadata: {},
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
    zip: 'postcode',
  }

  const customFieldMap: Record<string, string> = {
    'in_welcher_branche_seid_ihr_tätig?': 'branche',
    'welche_absicherung_möchtest_du_prüfen_lassen?': 'versicherungstyp',
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
