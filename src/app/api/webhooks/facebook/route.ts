import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logActivity } from '@/lib/activities-logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET: Facebook Webhook Verification
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const challenge = searchParams.get('hub.challenge')
    const token = searchParams.get('hub.verify_token')
    const mode = searchParams.get('hub.mode')

    console.log('[DEBUG] mode:', mode, 'token:', token, 'env_token:', process.env.FACEBOOK_VERIFY_TOKEN)

    if (mode === 'subscribe' && token === process.env.FACEBOOK_VERIFY_TOKEN) {
      console.log('✅ Facebook Webhook verified')
      return new NextResponse(challenge)
    } else {
      console.error('❌ Webhook verification failed - mode:', mode, 'token match:', token === process.env.FACEBOOK_VERIFY_TOKEN)
      return new NextResponse('Forbidden', { status: 403 })
    }
  } catch (error) {
    console.error('Webhook GET Error:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

// POST: Handle incoming Facebook leads
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { entry } = body

    if (!entry || !Array.isArray(entry)) {
      return new NextResponse(JSON.stringify({ ok: false }), { status: 400 })
    }

    let leadsProcessed = 0
    const errors: string[] = []

    for (const item of entry) {
      for (const change of item.changes || []) {
        try {
          const leadGenId = change.value?.leadgen_id
          const formId = change.value?.form_id

          if (!leadGenId || !formId) continue

          // Fetch lead details from Facebook
          const leadResponse = await fetch(
            `https://graph.facebook.com/v18.0/${leadGenId}?fields=field_data,created_time&access_token=${process.env.FACEBOOK_ACCESS_TOKEN}`,
            { method: 'GET' }
          )

          if (!leadResponse.ok) {
            const errorMsg = `Failed to fetch lead ${leadGenId}: ${leadResponse.statusText}`
            console.error(errorMsg)
            errors.push(errorMsg)
            continue
          }

          const fbLead = await leadResponse.json()

          // Map Facebook fields to contact structure
          const contact = mapFacebookFieldsToContact(fbLead.field_data)
          contact.facebook_id = leadGenId
          contact.facebook_form_id = formId
          contact.source = 'facebook'
          contact.created_at = new Date(fbLead.created_time).toISOString()

          // Check if contact already exists by facebook_id
          const { data: existingByFb, error: checkFbError } = await supabase
            .from('contacts')
            .select('id')
            .eq('facebook_id', leadGenId)
            .maybeSingle()

          if (checkFbError && checkFbError.code !== 'PGRST116') {
            console.error('Error checking existing facebook contact:', checkFbError)
            errors.push(`Facebook ID check failed: ${checkFbError.message}`)
            continue
          }

          if (existingByFb) {
            console.log(`Contact with facebook_id ${leadGenId} already exists, skipping`)
            continue
          }

          // Check if contact exists by email
          const { data: existingByEmail, error: checkEmailError } = await supabase
            .from('contacts')
            .select('id')
            .eq('email', contact.email)
            .maybeSingle()

          if (checkEmailError && checkEmailError.code !== 'PGRST116') {
            console.error('Error checking existing email:', checkEmailError)
            errors.push(`Email check failed: ${checkEmailError.message}`)
            continue
          }

          if (existingByEmail) {
            // Update existing contact with facebook_id
            const { error: updateError } = await supabase
              .from('contacts')
              .update({
                facebook_id: leadGenId,
                facebook_form_id: formId,
              })
              .eq('id', existingByEmail.id)

            if (updateError) {
              console.error('Error updating contact with facebook_id:', updateError)
              errors.push(`Update failed for email ${contact.email}`)
            } else {
              console.log(`✅ Updated contact ${existingByEmail.id} with Facebook ID`)
              await logActivity(null, existingByEmail.id, 'facebook_linked', 'Facebook lead linked to existing contact', {
                facebook_id: leadGenId,
                form_id: formId,
              })
              leadsProcessed++
            }
            continue
          }

          // Insert new contact
          const { data: insertedData, error: insertError } = await supabase
            .from('contacts')
            .insert([contact])
            .select('id')

          if (insertError) {
            const errorMsg = `Error inserting contact: ${insertError.message}`
            console.error(errorMsg)
            errors.push(errorMsg)
          } else if (insertedData && insertedData[0]) {
            const contactId = insertedData[0].id
            console.log(`✅ Contact ${contactId} created from Facebook lead ${leadGenId}`)

            await logActivity(
              contactId,
              'facebook_imported',
              `Lead imported from Facebook form`,
              {
                facebook_id: leadGenId,
                form_id: formId,
                source: 'facebook',
              }
            )

            leadsProcessed++
          }
        } catch (leadError) {
          const errorMsg = `Error processing individual lead: ${leadError instanceof Error ? leadError.message : String(leadError)}`
          console.error(errorMsg)
          errors.push(errorMsg)
        }
      }
    }

    return new NextResponse(
      JSON.stringify({
        ok: true,
        leadsProcessed,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200 }
    )
  } catch (error) {
    console.error('Webhook POST Error:', error)
    return new NextResponse(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500 }
    )
  }
}

function mapFacebookFieldsToContact(fieldData: Array<{ name: string; values: string[] }> = []): Record<string, any> {
  const contact: Record<string, any> = {
    metadata: {},
  }

  const fieldMap: Record<string, string> = {
    email: 'email',
    email_address: 'email',
    full_name: 'name',
    first_name: 'first_name',
    last_name: 'last_name',
    phone_number: 'phone_mobile',
    phone: 'phone_mobile',
    company: 'company_name',
    city: 'city',
    state: 'state',
    zip: 'postcode',
  }

  fieldData.forEach((field) => {
    const fbName = field.name.toLowerCase()
    const value = field.values?.[0]

    if (!value || value.trim() === '') return

    if (fieldMap[fbName]) {
      contact[fieldMap[fbName]] = value
    }

    contact.metadata[fbName] = value
  })

  // Split full_name into first_name and last_name if needed
  if (contact.name && !contact.first_name) {
    const nameParts = contact.name.split(' ')
    contact.first_name = nameParts[0]
    contact.last_name = nameParts.slice(1).join(' ')
  }

  return contact
}
