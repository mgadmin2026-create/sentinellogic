import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Pfade, die ohne Login erreichbar bleiben müssen:
// - /login: der Login selbst
// - /api/webhooks/*: externe Dienste (Dialfire, KlickTipp, Facebook) rufen diese direkt auf
// - /api/test-environment, /api/test-runs: eigene Token-Absicherung für CI/Playwright
// - /api/auth/google/*: bestehender Google-Drive-System-OAuth-Flow, separates Thema
const PUBLIC_PATH_PREFIXES = [
  '/login',
  '/api/webhooks/',
  '/api/test-environment',
  '/api/test-runs',
  '/api/auth/google/',
]

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix))
}

export async function middleware(request: NextRequest) {
  if (isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next()
  }

  const { response, user } = await updateSession(request)

  if (!user) {
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 })
    }
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Auf alles anwenden außer:
     * - Next.js-interne Pfade (_next/static, _next/image)
     * - statische Assets (favicon.ico, Bilder, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
