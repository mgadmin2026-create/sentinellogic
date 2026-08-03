import { NextRequest, NextResponse } from 'next/server'
import { runDialfirePullSync } from '@/lib/dialfire-pull-sync'

export const dynamic = 'force-dynamic'

// Wird periodisch von einem externen Scheduler aufgerufen (siehe
// .github/workflows/dialfire-sync-cron.yml) -- Vercel Hobby erlaubt nur eine
// Cron-Ausführung pro Tag, das reicht für einen regelmäßigen Dialfire-Pull
// nicht aus. Anders als der Facebook-Cron gibt es hier keine aktivierbare
// Konfiguration (kein "Auto"-Toggle mit Intervall in der DB) -- der Lauf
// selbst ist ungefährlich (kein-Op bei 0 verbundenen Kontakten), daher läuft
// er einfach im festen GitHub-Actions-Takt, solange der Workflow aktiv ist.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runDialfirePullSync()
    return NextResponse.json({ ok: true, result })
  } catch (err) {
    console.error('[GET /api/cron/dialfire-pull]', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
