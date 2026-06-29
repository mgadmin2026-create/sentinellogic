import { createHmac } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logActivity } from '@/lib/activities-logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Validate Facebook webhook signature (HMAC-SHA256)
function verifyFacebookSignature(body: string, xHubSignature: string | null): boolean {
  if (!xHubSignature) return false

  const appSecret = process.env.FACEBOOK_APP_SECRET
  if (!appSecret) {
    console.error('❌ FACEBOOK_APP_SECRET not configured')
    return false
  }

  const hash = createHmac('sha256', appSecret).update(body).digest('hex')
  const signature = `sha256=${hash}`

  return signature === xHubSignature
}

// GET: Facebook Webhook Verification
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const challenge = searchParams.get('hub.challenge')
    const token = searchParams.get('hub.verify_token')
    const mode = searchParams.get('hub.mode')

    if (mode === 'subscribe' && token === process.env.FACEBOOK_VERIFY_TOKEN) {
      console.log('✅ Facebook Webhook verified')
      return new NextResponse(challenge)
    } else {
      console.error('❌ Webhook verification failed')
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
    // FIX 1: Verify Facebook webhook signature (POST)
    const xHubSignature = request.headers.get('x-hub-signature-256')
    const rawBody = await request.text()

    if (!verifyFacebookSignature(rawBody, xHubSignature)) {
      console.error('❌ Invalid Facebook webhook signature')
      return new NextResponse(JSON.stringify({ error: 'Invalid signature' }), { status: 403 })
    }

    const body = JSON.parse(rawBody)
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

          // FIX 2: Use Authorization header instead of query parameter
          const leadResponse = await fetch(
            `https://graph.facebook.com/v18.0/${leadGenId}?fields=field_data,created_time,qualification_status`,
            {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${process.env.FACEBOOK_ACCESS_TOKEN}`,
              },
            }
          )

          if (!leadResponse.ok) {
            const errorMsg = `Failed to fetch lead ${leadGenId}: ${leadResponse.statusText}`
            console.error(errorMsg)
            errors.push(errorMsg)
            continue
          }

          let fbLead: any
          try {
            fbLead = await leadResponse.json()
          } catch (parseError) {
            errors.push(`Failed to parse Facebook response for lead ${leadGenId}`)
            continue
          }

          if (!fbLead.field_data || !Array.isArray(fbLead.field_data)) {
            errors.push(`Invalid field_data structure for lead ${leadGenId}`)
            continue
          }

          // Map Facebook fields to contact structure
          const contact = mapFacebookFieldsToContact(fbLead.field_data, fbLead.qualification_status)
          contact.facebook_id = leadGenId
          contact.facebook_form_id = formId
          contact.source = 'facebook'

          if (fbLead.created_time) {
            try {
              contact.created_at = new Date(fbLead.created_time).toISOString()
            } catch {
              console.warn(`Invalid timestamp for lead ${leadGenId}`)
            }
          }

          // FIX 3 & 4: Email validation + smart duplicate detection
          const hasValidEmail = contact.email && typeof contact.email === 'string' && contact.email.trim().length > 0

          // First check: facebook_id (always unique)
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

          // Second check: email (only if email is valid)
          let existingByEmail: any = null
          if (hasValidEmail) {
            const { data, error } = await supabase
              .from('contacts')
              .select('id')
              .eq('email', contact.email)
              .maybeSingle()

            if (error && error.code !== 'PGRST116') {
              console.error('Error checking existing email:', error)
              errors.push(`Email check failed: ${contact.email}`)
              continue
            }

            existingByEmail = data
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
              await logActivity(
                null,
                existingByEmail.id,
                'facebook_linked',
                'Facebook lead linked to existing contact',
                {
                  facebook_id: leadGenId,
                  form_id: formId,
                }
              )
              leadsProcessed++
            }
            continue
          }

          // FIX 5: UPSERT to handle duplicates and race conditions
          const { data: insertedData, error: insertError } = await supabase
            .from('contacts')
            .upsert([contact], { onConflict: 'facebook_id' })
            .select('id')

          if (insertError) {
            const errorMsg = `Error upserting contact: ${insertError.message}`
            console.error(errorMsg)
            errors.push(errorMsg)
          } else if (insertedData && insertedData[0]) {
            const contactId = insertedData[0].id
            console.log(`✅ Contact ${contactId} created/updated from Facebook lead ${leadGenId}`)

            await logActivity(
              null,
              contactId,
              'facebook_imported',
              'Lead imported from Facebook form',
              {
                facebook_id: leadGenId,
                form_id: formId,
                source: 'facebook',
                facebook_phase: contact.facebook_phase || null,
                form_data: body.entry[0].changes[0].value.field_data || {},
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

function mapFacebookFieldsToContact(fieldData: Array<{ name: string; values: string[] }> = [], qualificationStatus?: string): Record<string, any> {
  const contact: Record<string, any> = {
    metadata: {},
  }

  // Store Facebook phase/qualification status
  if (qualificationStatus) {
    contact.facebook_phase = qualificationStatus
  }

  const fieldMap: Record<string, string> = {
    // Contact basics
    email: 'email',
    email_address: 'email',
    full_name: 'name',
    first_name: 'first_name',
    last_name: 'last_name',

    // Phone
    phone_number: 'phone_mobile',
    phone: 'phone_mobile',

    // Company info
    company: 'company_name',
    company_name: 'company_name',

    // Address
    city: 'city',
    state: 'state',
    street: 'street',
    address: 'street',
    zip: 'postal_code',
    postal_code: 'postal_code',
    country: 'country',

    // Business details (KEY FIELDS!)
    industry: 'industry',
    branche: 'industry',
    mitarbeiterzahl: 'mitarbeiterzahl',
    mitarbeitende: 'mitarbeiterzahl',
    employee_count: 'mitarbeiterzahl',
    employees: 'mitarbeiterzahl',
    jahresumsatz: 'jahresumsatz',
    revenue: 'jahresumsatz',
    annual_revenue: 'jahresumsatz',
    umsatz: 'jahresumsatz',

    // Insurance product (what they want to check/insure)
    'welche_absicherung_möchtest_du_prüfen_lassen?': 'insurance_product',
    absicherung: 'insurance_product',
    insurance_product: 'insurance_product',

    // Other
    website: 'website',
    position: 'position',
    jobtitle: 'position',
  }

  fieldData.forEach((field) => {
    const fbName = field.name.toLowerCase()
    const value = field.values?.[0]

    if (!value || value.trim() === '') return

    if (fieldMap[fbName]) {
      contact[fieldMap[fbName]] = value.trim()
    }

    // Store ALL fields in metadata for audit trail
    contact.metadata[fbName] = value.trim()
  })

  // Split full_name into first_name and last_name if needed
  if (contact.name && !contact.first_name) {
    const nameParts = contact.name.trim().split(/\s+/).filter(Boolean)
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
