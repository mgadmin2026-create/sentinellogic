import { NextResponse } from 'next/server'
import { getGoogleAuthUrl } from '@/lib/google-oauth'
import { randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'

/**
 * Startet den OAuth-Flow zum Verbinden des zentralen System-Google-Kontos.
 * Der Admin wird direkt zu Google weitergeleitet. Ein State-Cookie schuetzt vor CSRF.
 */
export async function GET() {
  try {
    const state = randomBytes(32).toString('hex')
    const authUrl = getGoogleAuthUrl(state)

    const response = NextResponse.redirect(authUrl)
    response.cookies.set('gdrive_oauth_state', state, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 600, // 10 Minuten
    })
    return response
  } catch (err) {
    console.error('[Google Auth] Start error:', err)
    const msg = err instanceof Error ? err.message : 'Auth start failed'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
