import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { exchangeCodeForTokens } from '@/lib/google-oauth'
import { buildDriveClient, findOrCreateRootFolder } from '@/lib/google-drive-oauth'

export const dynamic = 'force-dynamic'

const SETTINGS_PATH = '/einstellungen/dokumente'

/**
 * OAuth-Callback: verbindet das zentrale System-Google-Konto.
 * Speichert Token + Root-Ordner in google_drive_system_token (Zeile id=1).
 */
export async function GET(request: NextRequest) {
  const redirect = (query: string) =>
    NextResponse.redirect(new URL(`${SETTINGS_PATH}?${query}`, request.url))

  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const oauthError = searchParams.get('error')

    if (oauthError) {
      return redirect(`error=${encodeURIComponent(oauthError)}`)
    }
    if (!code || !state) {
      return redirect('error=missing_code_or_state')
    }

    // CSRF: State gegen Cookie pruefen
    const cookieState = request.cookies.get('gdrive_oauth_state')?.value
    if (!cookieState || cookieState !== state) {
      return redirect('error=state_mismatch')
    }

    // Code gegen Tokens tauschen
    const tokens = await exchangeCodeForTokens(code)

    // Verbundene Konto-E-Mail ermitteln
    let connectedEmail: string | null = null
    try {
      const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      })
      if (userinfoRes.ok) {
        const info = await userinfoRes.json()
        connectedEmail = info.email ?? null
      }
    } catch (e) {
      console.warn('[Google Auth] Konto-E-Mail konnte nicht ermittelt werden:', e)
    }

    // Root-Ordner im verbundenen Konto anlegen/finden
    const drive = buildDriveClient(tokens.accessToken)
    const rootFolderId = await findOrCreateRootFolder(drive)

    // Zentrales Token speichern (immer Zeile id=1)
    const supabase = createServerClient()
    const { error: upsertError } = await supabase
      .from('google_drive_system_token')
      .upsert({
        id: 1,
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expires_at: tokens.expiresAt,
        scope: tokens.scope,
        root_folder_id: rootFolderId,
        connected_email: connectedEmail,
        updated_at: new Date().toISOString(),
      })

    if (upsertError) {
      console.error('[Google Auth] Token-Speicherung fehlgeschlagen:', upsertError)
      return redirect('error=token_storage_failed')
    }

    console.log(`[Google Auth] ✅ System-Konto verbunden: ${connectedEmail ?? 'unbekannt'}`)

    const response = redirect('connected=1')
    response.cookies.delete('gdrive_oauth_state')
    return response
  } catch (err) {
    console.error('[Google Auth] Callback error:', err)
    const msg = err instanceof Error ? err.message : 'OAuth callback failed'
    return redirect(`error=${encodeURIComponent(msg)}`)
  }
}
