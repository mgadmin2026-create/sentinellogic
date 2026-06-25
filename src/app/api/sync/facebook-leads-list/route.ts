import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/sync/facebook-leads-list
 * Preview: Fetches all leads from Facebook WITHOUT syncing to database
 * Use this to inspect what leads will be synced before running the actual sync
 */
export async function GET(request: NextRequest) {
  try {
    const formId = request.nextUrl.searchParams.get('formId') || process.env.FACEBOOK_FORM_ID || '1488535808896676'
    const accessToken = process.env.FACEBOOK_ACCESS_TOKEN

    if (!accessToken) {
      return new NextResponse(
        JSON.stringify({ error: 'Missing FACEBOOK_ACCESS_TOKEN' }),
        { status: 400 }
      )
    }

    console.log(`📋 Listing Facebook Leads for form ${formId} (PREVIEW MODE - no sync)`)

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

    console.log(`📊 Total leads available: ${allLeads.length}`)

    // Map and format leads for preview
    const mappedLeads = allLeads.map((lead) => {
      const contact = mapFacebookFieldsToContact(lead.field_data)
      return {
        facebook_id: lead.id,
        facebook_created_time: lead.created_time,
        first_name: contact.first_name || '',
        last_name: contact.last_name || '',
        email: contact.email || '',
        phone_mobile: contact.phone_mobile || '',
        company_name: contact.company_name || '',
        city: contact.city || '',
        state: contact.state || '',
        postcode: contact.postcode || '',
        raw_fields: lead.field_data,
      }
    })

    return new NextResponse(
      JSON.stringify({
        mode: 'PREVIEW',
        totalLeads: allLeads.length,
        formId,
        leads: mappedLeads,
        message: `📋 Preview of ${allLeads.length} leads (NOT synced to database). Call /api/sync/facebook-leads to actually sync.`,
      }),
      { status: 200 }
    )
  } catch (error) {
    console.error('List Error:', error)
    return new NextResponse(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500 }
    )
  }
}

function mapFacebookFieldsToContact(fieldData: any[] = []): Record<string, any> {
  const contact: Record<string, any> = {}

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
