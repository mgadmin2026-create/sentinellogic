// API-Route: Gesundheits-Aggregation pro Integration für die Kacheln im
// Control Center (/sync) — löst die bisher rein hartcodierten
// status/count-Werte in INITIAL_SOURCES ab.
// GET /api/sync-runs/summary
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const INTEGRATIONS = [
  'klicktipp', 'dialfire', 'facebook', 'dialfire_pull', 'superchat', 'strato_calendar',
  'strato_mail', 'klicktipp_webhook',
] as const

// Je Integration nur die 50 jüngsten Läufe zählen (analog zum bestehenden
// Muster in RegelLaufHistorie/runs-Route) — sonst würde eine Integration
// mit vielen Läufen ältere Fehler unbegrenzt mitschleppen.
const WINDOW_PER_INTEGRATION = 50

interface IntegrationHealth {
  total: number
  success: number
  failed: number
  retrying: number
  lastRun: string | null
  lastStatus: string | null
}

export async function GET(_request: NextRequest) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return Response.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 })
  }

  const supabase = createServerClient()

  try {
    const { data: runs, error } = await supabase
      .from('sync_runs')
      .select('integration, status, started_at')
      .eq('run_kind', 'item')
      .in('integration', INTEGRATIONS as unknown as string[])
      .order('started_at', { ascending: false })
      .limit(INTEGRATIONS.length * WINDOW_PER_INTEGRATION * 3)

    if (error) throw new Error(error.message)

    const perIntegration: Record<string, IntegrationHealth> = {}
    for (const integration of INTEGRATIONS) {
      perIntegration[integration] = { total: 0, success: 0, failed: 0, retrying: 0, lastRun: null, lastStatus: null }
    }

    for (const run of runs ?? []) {
      const bucket = perIntegration[run.integration]
      if (!bucket) continue

      if (bucket.lastRun === null) {
        bucket.lastRun = run.started_at
        bucket.lastStatus = run.status
      }
      if (bucket.total >= WINDOW_PER_INTEGRATION) continue

      bucket.total++
      if (run.status === 'success') bucket.success++
      else if (run.status === 'failed' || run.status === 'dead_letter') bucket.failed++
      else if (run.status === 'retrying') bucket.retrying++
    }

    return Response.json({ success: true, data: perIntegration })
  } catch (err) {
    console.error('[GET /api/sync-runs/summary]', err)
    return Response.json({ success: false, error: 'Gesundheitsdaten konnten nicht geladen werden' }, { status: 500 })
  }
}
