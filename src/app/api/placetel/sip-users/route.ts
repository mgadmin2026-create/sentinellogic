// API Route: Placetel-Nebenstellen für die Zuordnung im Team (admin-only)
// GET /api/placetel/sip-users — Auswahlliste für die SIP-Zuordnung
import { getCurrentUser } from '@/lib/auth'
import { isAdmin } from '@/lib/roles'
import { listPlacetelSipUsers, PlacetelApiError } from '@/lib/integrations/placetel'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function GET() {
  const currentUser = await getCurrentUser()
  if (!currentUser || !isAdmin(currentUser.role)) {
    return Response.json({ success: false, error: 'Nur für Admins' }, { status: 403 })
  }

  try {
    const sipUsers = await listPlacetelSipUsers()
    return Response.json({
      success: true,
      data: sipUsers
        .filter((sipUser) => Boolean(sipUser.sipuid))
        .map((sipUser) => ({
          sipuid: String(sipUser.sipuid),
          name: sipUser.name ?? null,
          online: sipUser.online ?? null,
        })),
    })
  } catch (error) {
    const message = error instanceof PlacetelApiError
      ? error.message
      : 'Placetel-Nebenstellen konnten nicht geladen werden'
    console.error('[GET /api/placetel/sip-users] Fehler:', message)
    return Response.json({ success: false, error: message }, { status: 502 })
  }
}
