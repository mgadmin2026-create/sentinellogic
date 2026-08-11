// API-Route: alle fälligen Wiederholungen einer Integration sofort ausführen
// (statt auf den nächsten Cron-Tick zu warten) — Pendant zu
// /api/sync-runs/[id]/retry, aber für ALLE fälligen Zeilen einer Integration
// statt nur eine. "Jetzt synchronisieren"-Button der ereignisgetriggerten
// Integrationen im Control Center.
// POST /api/sync-runs/retry-all  { integration: string }
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { processRetries, hasRetryHandler } from '@/lib/sync-runs/retry-handlers'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return Response.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const integration = body?.integration
  if (typeof integration !== 'string' || !hasRetryHandler(integration)) {
    return Response.json({ success: false, error: 'Keine wiederholbare Integration' }, { status: 400 })
  }

  const supabase = createServerClient()
  const result = await processRetries(supabase, integration)
  return Response.json({ success: true, processed: result.processed })
}
