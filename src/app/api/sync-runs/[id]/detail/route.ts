// API-Route: Detailaufschlüsselung für eine Batch-Zeile in der
// Automatisierungs-Läufe-Tabelle (Klick zum Aufklappen) — siehe
// batch-detail.ts für die Integration-spezifische Logik.
// GET /api/sync-runs/[id]/detail
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { getBatchDetail } from '@/lib/sync-runs/batch-detail'

export const dynamic = 'force-dynamic'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return Response.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 })
  }
  if (!UUID_PATTERN.test(params.id)) {
    return Response.json({ success: false, error: 'Ungültige Lauf-ID' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data: run, error } = await supabase
    .from('sync_runs')
    .select('id, integration, run_kind, data')
    .eq('id', params.id)
    .single()

  if (error || !run) {
    return Response.json({ success: false, error: 'Lauf nicht gefunden' }, { status: 404 })
  }
  if (run.run_kind !== 'batch') {
    return Response.json({ success: false, error: 'Nur Batch-Läufe haben eine Detailansicht' }, { status: 400 })
  }

  const detail = await getBatchDetail(supabase, run)
  return Response.json({ success: true, data: detail })
}
