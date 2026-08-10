// API Route: CSV-Import-Protokoll
// POST /api/sync-log — nach einem CSV-Import einen sync_runs-Batch-Eintrag
// anlegen (integration='csv_import'), damit Importe wie alle anderen
// Integrationen einheitlich in der Automatisierungs-Läufe-Tabelle auf /sync
// erscheinen (inkl. Detailansicht, siehe batch-detail.ts). Ersetzt die
// frühere direkte sync_log-Tabelle — GET gibt es nicht mehr, das Sync-
// Protokoll wurde in Automatisierungs-Läufe konsolidiert.
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { recordRunStart, recordRunOutcome } from '@/lib/sync-runs/retry-runner'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const body = await request.json()
    const { source, count, duplicates_skipped, message, lead_ids, lead_names } = body

    const run = await recordRunStart(supabase, {
      runKind: 'batch',
      integration: 'csv_import',
      triggerType: 'manual',
      data: {
        source: source ?? 'CSV-Import',
        count: count ?? 0,
        duplicates_skipped: duplicates_skipped ?? 0,
        message: message ?? '',
        lead_ids: lead_ids ?? [],
        lead_names: lead_names ?? [],
      },
    })

    if (run) {
      await recordRunOutcome(supabase, run, { success: true })
    }

    return Response.json({ success: true }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/sync-log]', error)
    return Response.json({ success: false, error: 'Import-Protokoll konnte nicht gespeichert werden' }, { status: 500 })
  }
}
