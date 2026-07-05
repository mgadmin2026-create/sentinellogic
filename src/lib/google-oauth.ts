/**
 * Google OAuth 2.0 Flow for Google Drive
 */

export const GOOGLE_OAUTH_CONFIG = {
  clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
  clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
  scopes: [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/drive.file',
    'openid',
    'email',
    'profile',
  ],
}

/**
 * Redirect-URI ableiten.
 * Bevorzugt die tatsaechlich aufgerufene Domain (origin) — dadurch ist die URL
 * immer korrekt, egal ob NEXT_PUBLIC_SITE_URL gesetzt/eingebacken ist.
 * Faellt sonst auf NEXT_PUBLIC_SITE_URL bzw. localhost zurueck.
 */
export function getRedirectUri(origin?: string | null): string {
  const base =
    origin || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  return `${base.replace(/\/$/, '')}/api/auth/google/callback`
}

/**
 * Generate Google OAuth authorization URL
 */
export function getGoogleAuthUrl(state: string, origin?: string | null): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_OAUTH_CONFIG.clientId,
    redirect_uri: getRedirectUri(origin),
    response_type: 'code',
    scope: GOOGLE_OAUTH_CONFIG.scopes.join(' '),
    state: state,
    access_type: 'offline',
    prompt: 'consent',
  })

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

/**
 * Exchange authorization code for tokens.
 * Die redirect_uri MUSS identisch zur Authorisierungsanfrage sein.
 */
export async function exchangeCodeForTokens(code: string, origin?: string | null) {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_OAUTH_CONFIG.clientId,
        client_secret: GOOGLE_OAUTH_CONFIG.clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: getRedirectUri(origin),
      }).toString(),
    })

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.statusText}`)
    }

    const data = await response.json()

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scope: data.scope,
    }
  } catch (err) {
    console.error('[Google OAuth] Token exchange error:', err)
    throw err
  }
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string) {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_OAUTH_CONFIG.clientId,
        client_secret: GOOGLE_OAUTH_CONFIG.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    })

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.statusText}`)
    }

    const data = await response.json()

    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    }
  } catch (err) {
    console.error('[Google OAuth] Token refresh error:', err)
    throw err
  }
}
