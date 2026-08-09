// API-Route: einen einzelnen sync_runs-Lauf sofort erneut ausführen (statt
// auf den nächsten Cron-Tick/next_retry_at zu warten) — "Retry jetzt"-Button
// im Control Center.
// POST /api/sync-runs/[id]/retry
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { retryRunNow } from '@/lib/sync-runs/retry-handlers'

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
  const result = await retryRunNow(supabase, params.id)

  if (!result.success) {
    return Response.json({ success: false, error: result.error }, { status: 400 })
  }
  return Response.json({ success: true })
}
