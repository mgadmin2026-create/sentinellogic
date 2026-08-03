import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runDialfirePullSync } from '@/lib/dialfire-pull-sync'
import { berechneNaechstenSync } from '@/lib/facebook-sync-schedule'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Wird periodisch von einem externen Scheduler aufgerufen (siehe
// .github/workflows/dialfire-sync-cron.yml) -- Vercel Hobby erlaubt nur eine
// Cron-Ausführung pro Tag, das reicht für die Intervall-Optionen im
// "Auto"-Toggle auf /sync nicht aus. Der GitHub-Actions-Takt tickt daher
// häufiger (alle 30 Min); diese Route prüft dialfire_sync_config und führt
// den Sync nur aus, wenn "Auto" aktiviert und der Zyklus fällig ist --
// exakt dasselbe Muster wie /api/cron/facebook-sync.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: config, error: configError } = await supabase
    .from('dialfire_sync_config')
    .select('*')
    .single()

  if (configError || !config || !config.enabled) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'disabled' })
  }

  const now = new Date()
  if (config.next_sync_at && new Date(config.next_sync_at) > now) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'not_due', next_sync_at: config.next_sync_at })
  }

  try {
    const result = await runDialfirePullSync()

    const nextSyncAt = berechneNaechstenSync(config.interval_type, now)
    await supabase
      .from('dialfire_sync_config')
      .update({
        last_sync_at: now.toISOString(),
        next_sync_at: nextSyncAt.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('id', config.id)

    return NextResponse.json({ ok: true, skipped: false, next_sync_at: nextSyncAt.toISOString(), result })
  } catch (err) {
    console.error('[GET /api/cron/dialfire-pull]', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
