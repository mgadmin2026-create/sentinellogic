import { NextRequest, NextResponse } from 'next/server'
import { getGoogleAuthUrl } from '@/lib/google-oauth'
import { randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'

/**
 * Oeffentliche Domain aus dem Request ableiten (Vercel setzt x-forwarded-*).
 */
function getRequestOrigin(request: NextRequest): string {
  const proto = request.headers.get('x-forwarded-proto') ?? 'https'
  const host =
    request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  if (host) return `${proto}://${host}`
  return request.nextUrl.origin
}

/**
 * Startet den OAuth-Flow zum Verbinden des zentralen System-Google-Kontos.
 * Der Admin wird direkt zu Google weitergeleitet. Ein State-Cookie schuetzt vor CSRF.
 */
export async function GET(request: NextRequest) {
  try {
    const state = randomBytes(32).toString('hex')
    const authUrl = getGoogleAuthUrl(state, getRequestOrigin(request))

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
