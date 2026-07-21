import { getCurrentUser } from '@/lib/auth'
import { isAdmin } from '@/lib/roles'
import {
  getPlacetelAccount,
  listPlacetelSipUsers,
  PlacetelApiError,
} from '@/lib/integrations/placetel'

export const dynamic = 'force-dynamic'

function safeError(error: unknown): { status: number | null; message: string } {
  if (error instanceof PlacetelApiError) {
    return { status: error.status, message: error.message }
  }
  return { status: null, message: 'Placetel-Prüfung fehlgeschlagen' }
}

export async function GET() {
  const currentUser = await getCurrentUser()
  if (!currentUser || !isAdmin(currentUser.role)) {
    return Response.json({ success: false, error: 'Nur für Admins' }, { status: 403 })
  }

  const configured = {
    apiBaseUrl: Boolean(process.env.PLACETEL_API_BASE_URL?.trim()),
    apiToken: Boolean(process.env.PLACETEL_API_TOKEN?.trim()),
    defaultSipuid: Boolean(process.env.PLACETEL_DEFAULT_SIPUID?.trim()),
    notifyHmacSecret: Boolean(process.env.PLACETEL_WEBHOOK_TOKEN?.trim()),
    allowedCountryCodes: (process.env.PLACETEL_ALLOWED_COUNTRY_CODES || '+49')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  }

  if (!configured.apiToken) {
    return Response.json({
      success: true,
      configured,
      connection: { valid: false, error: 'PLACETEL_API_TOKEN fehlt' },
      account: null,
      sipUsers: [],
      notify: {
        setup: 'Placetel Webportal: Einstellungen -> Externe APIs',
        automaticallyVerifiable: false,
      },
    })
  }

  const [accountResult, sipUsersResult] = await Promise.allSettled([
    getPlacetelAccount(),
    listPlacetelSipUsers(),
  ])

  const errors = [accountResult, sipUsersResult]
    .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    .map((result) => safeError(result.reason))

  const account = accountResult.status === 'fulfilled'
    ? {
        id: accountResult.value.id ?? null,
        name: accountResult.value.name ?? null,
        company: accountResult.value.company ?? null,
        platform: accountResult.value.platform ?? null,
        primarySipUserId: accountResult.value.primary_sip_user_id ?? null,
      }
    : null

  const sipUsers = sipUsersResult.status === 'fulfilled'
    ? sipUsersResult.value.map((sipUser) => ({
        id: sipUser.id ?? null,
        sipuid: sipUser.sipuid ?? null,
        name: sipUser.name ?? null,
        description: sipUser.description ?? null,
        did: sipUser.did ?? null,
        callerid: sipUser.callerid ?? null,
        type: sipUser.type ?? null,
        online: sipUser.online ?? null,
      }))
    : []

  return Response.json({
    success: errors.length === 0,
    configured,
    connection: {
      valid: accountResult.status === 'fulfilled',
      errors,
    },
    account,
    sipUsers,
    notify: {
      setup: 'Placetel Webportal: Einstellungen -> Externe APIs',
      endpoint: '/api/webhooks/placetel',
      authentication: 'HMAC-SHA256 via X-PLACETEL-SIGNATURE',
      automaticallyVerifiable: false,
    },
  }, { status: accountResult.status === 'fulfilled' ? 200 : 502 })
}
