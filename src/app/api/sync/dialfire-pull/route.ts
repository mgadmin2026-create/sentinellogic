// API Route: Dialfire Pull-Sync für alle verbundenen Kontakte (Batch)
// GET /api/sync/dialfire-pull — Lauf über alle verbundenen Kontakte,
// ruft pro Kontakt dieselbe Edge Function auf wie der manuelle Einzel-Sync
// (DialfireSyncPanel → /api/dialfire/pull-sync) und protokolliert einen
// gesammelten Eintrag in sync_log — analog zum Facebook-Sync-Mechanismus.
// Kernlogik liegt in src/lib/dialfire-pull-sync.ts, geteilt mit dem
// automatischen Cron-Trigger (/api/cron/dialfire-pull).
import { NextResponse } from 'next/server'
import { runDialfirePullSync } from '@/lib/dialfire-pull-sync'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const result = await runDialfirePullSync()
    return NextResponse.json(result)
  } catch (err) {
    console.error('[GET /api/sync/dialfire-pull]', err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
