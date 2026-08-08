import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runDialfirePullSync } from '@/lib/dialfire-pull-sync'
import { getSyncConfig, isSyncDue, markSyncCompleted } from '@/lib/sync-runs/sync-config'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Wird periodisch von einem externen Scheduler aufgerufen (siehe
// .github/workflows/dialfire-sync-cron.yml) -- Vercel Hobby erlaubt nur eine
// Cron-Ausführung pro Tag, das reicht für die Intervall-Optionen im
// "Auto"-Toggle auf /sync nicht aus. Der GitHub-Actions-Takt tickt daher
// häufiger (alle 30 Min); diese Route prüft sync_config und führt
// den Sync nur aus, wenn "Auto" aktiviert und der Zyklus fällig ist --
// exakt dasselbe Muster wie /api/cron/facebook-sync. Retry-Processing für
// alle Integrationen läuft bereits im facebook-sync-Cron (häufigerer Takt),
// deshalb kein zusätzliches Piggyback hier.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const config = await getSyncConfig(supabase, 'dialfire_pull')
  if (!isSyncDue(config)) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: config.enabled ? 'not_due' : 'disabled',
      next_sync_at: config.next_sync_at,
    })
  }

  const now = new Date()
  try {
    const result = await runDialfirePullSync('cron')
    const nextSyncAt = await markSyncCompleted(supabase, 'dialfire_pull', config.interval_type, now)

    return NextResponse.json({ ok: true, skipped: false, next_sync_at: nextSyncAt.toISOString(), result })
  } catch (err) {
    console.error('[GET /api/cron/dialfire-pull]', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
