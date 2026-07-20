// API Route: aktuell eingeloggter User (für Client Components, die die
// Rolle für UI-Entscheidungen brauchen, z.B. "Team"-Karte nur für Admins)
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return Response.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 })
  }
  return Response.json({ success: true, data: user })
}
