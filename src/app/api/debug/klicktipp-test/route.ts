import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const developerKey = process.env.KLICKTIPP_DEVELOPER_KEY
    const customerKey = process.env.KLICKTIPP_CUSTOMER_KEY

    console.log('[Debug] Klicktipp-Schlüssel geladen:', {
      developerKeyPresent: Boolean(developerKey),
      customerKeyPresent: Boolean(customerKey),
    })

    if (!developerKey || !customerKey) {
      return NextResponse.json(
        { error: 'Missing KlickTipp credentials' },
        { status: 400 }
      )
    }

    // Test Basic Auth Header
    const credentials = `${developerKey}:${customerKey}`
    const encoded = Buffer.from(credentials).toString('base64')
    const authHeader = `Basic ${encoded}`

    // Test API Call - List Tags (try without version)
    const response = await fetch('https://api.klicktipp.com/tag', {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
    })

    const responseText = await response.text()

    console.log('[Debug] API Response:', {
      status: response.status,
      statusText: response.statusText,
      responseReceived: Boolean(responseText),
    })

    if (!response.ok) {
      return NextResponse.json(
        {
          error: `KlickTipp API returned ${response.status}`,
          status: response.status,
          statusText: response.statusText,
        },
        { status: response.status }
      )
    }

    const data = JSON.parse(responseText)

    return NextResponse.json({
      success: true,
      message: 'KlickTipp API is working!',
      tagsCount: data.tags?.length || 0,
      tags: data.tags || [],
    })
  } catch (err) {
    console.error('[Debug] Error:', err)
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    )
  }
}
