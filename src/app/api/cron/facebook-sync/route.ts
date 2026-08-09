import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runFacebookLeadSync } from '@/lib/facebook-sync'
import { getSyncConfig, isSyncDue, markSyncCompleted } from '@/lib/sync-runs/sync-config'
import { processRetries } from '@/lib/sync-runs/retry-handlers'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Wird periodisch von einem externen Scheduler aufgerufen (siehe
// .github/workflows/facebook-sync-cron.yml) -- Vercel Hobby erlaubt nur eine
// Cron-Ausführung pro Tag, das reicht für die 15/30/60-Minuten-Optionen im
// "Auto"-Toggle auf /sync nicht aus. Deshalb GitHub Actions als externer,
// planabhängiger Trigger, alle 15 Minuten -- diese Route selbst prüft dann,
// ob laut sync_config überhaupt ein Sync fällig ist.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Piggyback: dieser Trigger läuft alle 15 Min über GitHub Actions und ist
  // damit der einzige verlässliche wiederkehrende Heartbeat, den es aktuell
  // gibt — genutzt, um fällige sync_runs-Retries für alle Integrationen zu
  // verarbeiten, unabhängig davon, ob Facebook selbst gerade fällig ist.
  // Kein eigener Scheduler-Baustein (das bleibt Fahrplan, offene Phase 5);
  // Fehler dürfen den Facebook-Sync nicht blockieren.
  try {
    await processRetries(supabase, 'klicktipp')
    await processRetries(supabase, 'dialfire')
    await processRetries(supabase, 'facebook')
    await processRetries(supabase, 'dialfire_pull')
    await processRetries(supabase, 'superchat')
    await processRetries(supabase, 'strato_calendar')
    await processRetries(supabase, 'klicktipp_webhook')
  } catch (err) {
    console.error('[cron/facebook-sync] Retry-Processing fehlgeschlagen:', err)
  }

  const config = await getSyncConfig(supabase, 'facebook')
  if (!isSyncDue(config)) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: config.enabled ? 'not_due' : 'disabled',
      next_sync_at: config.next_sync_at,
    })
  }

  const now = new Date()
  const { body: result } = await runFacebookLeadSync('cron')
  const nextSyncAt = await markSyncCompleted(supabase, 'facebook', config.interval_type, now)

  return NextResponse.json({
    ok: true,
    skipped: false,
    next_sync_at: nextSyncAt.toISOString(),
    result,
  })
}
