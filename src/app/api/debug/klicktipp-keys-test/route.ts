import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

async function testKeyOrder(order: string, devKey: string, custKey: string) {
  let credentials: string

  if (order === 'dev:cust') {
    credentials = `${devKey}:${custKey}`
  } else {
    credentials = `${custKey}:${devKey}`
  }

  const encoded = Buffer.from(credentials).toString('base64')
  const authHeader = `Basic ${encoded}`

  const response = await fetch('https://api.klicktipp.com/tag', {
    method: 'GET',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
  })

  const body = await response.text()

  return {
    order,
    status: response.status,
    statusText: response.statusText,
    responseReceived: Boolean(body),
  }
}

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const developerKey = process.env.KLICKTIPP_DEVELOPER_KEY
    const customerKey = process.env.KLICKTIPP_CUSTOMER_KEY

    if (!developerKey || !customerKey) {
      return NextResponse.json({ error: 'Missing keys' }, { status: 400 })
    }

    // Test both orders
    const result1 = await testKeyOrder('dev:cust', developerKey, customerKey)
    const result2 = await testKeyOrder('cust:dev', developerKey, customerKey)

    return NextResponse.json({
      results: [result1, result2],
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
