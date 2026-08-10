// API-Route: paginierte/filterbare Liste aus sync_runs für die
// "Automatisierungs-Läufe"-Tabelle im Control Center (/sync).
// GET /api/sync-runs?integration=&status=&limit=
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const MAX_LIMIT = 5000

export async function GET(request: NextRequest) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return Response.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 })
  }

  const supabase = createServerClient()
  const url = new URL(request.url)
  const integration = url.searchParams.get('integration')
  const status = url.searchParams.get('status')
  const limit = Math.min(Number.parseInt(url.searchParams.get('limit') || '500', 10) || 500, MAX_LIMIT)

  try {
    // Nur Top-Level-Läufe (Batches + eigenständige Einzelvorgänge) — die
    // Item-Kinder eines Batches (Facebook/Dialfire-Pull, oft hunderte pro
    // Lauf) haben immer parent_run_id gesetzt und würden sonst die Liste
    // fluten; ihr Status/Fehlerdetail ist über die aufklappbare Detailansicht
    // der Batch-Zeile erreichbar (siehe /api/sync-runs/[id]/detail).
    let query = supabase
      .from('sync_runs')
      .select(
        'id, run_kind, integration, trigger_type, status, attempt_count, max_attempts, error_class, error_detail, started_at, finished_at, next_retry_at, contact:contact_id(id, first_name, last_name)'
      )
      .is('parent_run_id', null)
      .order('started_at', { ascending: false })
      .limit(limit)

    if (integration) query = query.eq('integration', integration)
    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) throw new Error(error.message)

    return Response.json({ success: true, data: { runs: data ?? [] } })
  } catch (err) {
    console.error('[GET /api/sync-runs]', err)
    return Response.json({ success: false, error: 'Läufe konnten nicht geladen werden' }, { status: 500 })
  }
}
