import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const email = process.env.KLICKTIPP_USERNAME || 'info@onlinefirst.eu'
    const password = process.env.KLICKTIPP_PASSWORD || 'Jlraxx3006?!'

    console.log('[Debug Session] Attempting login with:', {
      email,
      passwordLength: password.length,
    })

    // Step 1: Login to KlickTipp
    const loginResponse = await fetch('https://api.klicktipp.com/v3/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: email,
        password: password,
      }),
    })

    const loginData = await loginResponse.text()

    console.log('[Debug Session] Login Response:', {
      status: loginResponse.status,
      statusText: loginResponse.statusText,
      bodyPreview: loginData.substring(0, 200),
    })

    if (!loginResponse.ok) {
      return NextResponse.json(
        {
          error: `Login failed: ${loginResponse.status}`,
          status: loginResponse.status,
          body: loginData,
        },
        { status: loginResponse.status }
      )
    }

    const sessionData = JSON.parse(loginData)
    const sessionId = sessionData.sid

    if (!sessionId) {
      return NextResponse.json(
        {
          error: 'No session ID in login response',
          response: sessionData,
        },
        { status: 400 }
      )
    }

    console.log('[Debug Session] Got session ID:', sessionId.substring(0, 20) + '...')

    // Step 2: List tags with session
    const tagsResponse = await fetch('https://api.klicktipp.com/v3/tag', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': sessionId,
      },
    })

    const tagsData = await tagsResponse.text()

    console.log('[Debug Session] Tags Response:', {
      status: tagsResponse.status,
      statusText: tagsResponse.statusText,
      bodyPreview: tagsData.substring(0, 200),
    })

    if (!tagsResponse.ok) {
      return NextResponse.json(
        {
          error: `Failed to list tags: ${tagsResponse.status}`,
          status: tagsResponse.status,
          body: tagsData,
        },
        { status: tagsResponse.status }
      )
    }

    const tags = JSON.parse(tagsData)

    return NextResponse.json({
      success: true,
      message: 'KlickTipp Session Auth is working!',
      sessionId: sessionId.substring(0, 20) + '...',
      tagsCount: tags.tags?.length || 0,
      tags: tags.tags || [],
    })
  } catch (err) {
    console.error('[Debug Session] Error:', err)
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    )
  }
}
