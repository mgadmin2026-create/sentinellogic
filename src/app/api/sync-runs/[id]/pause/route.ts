// API-Route: den automatischen Retry eines sync_runs-Laufs manuell stoppen
// ("Pause"-Button im Control Center) — setzt status='skipped', wodurch
// processRetries() die Zeile danach nicht mehr aufgreift.
// POST /api/sync-runs/[id]/pause
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { pauseRun } from '@/lib/sync-runs/retry-handlers'

export const dynamic = 'force-dynamic'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return Response.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 })
  }
  if (!UUID_PATTERN.test(params.id)) {
    return Response.json({ success: false, error: 'Ungültige Lauf-ID' }, { status: 400 })
  }

  const supabase = createServerClient()
  const result = await pauseRun(supabase, params.id)

  if (!result.success) {
    return Response.json({ success: false, error: result.error }, { status: 400 })
  }
  return Response.json({ success: true })
}
