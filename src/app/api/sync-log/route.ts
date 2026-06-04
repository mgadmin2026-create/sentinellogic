// API Route: Sync-Protokoll
// GET  /api/sync-log — letzte Einträge laden
// POST /api/sync-log — neuen Eintrag anlegen (nach CSV-Import / Webhook)
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const limit = parseInt(new URL(request.url).searchParams.get('limit') ?? '20', 10)
    const { data, error } = await supabase
      .from('sync_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw new Error(error.message)
    return Response.json({ success: true, data: data ?? [] })
  } catch (error) {
    console.error('[GET /api/sync-log]', error)
    return Response.json({ success: false, error: 'Sync-Log konnte nicht geladen werden' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const body = await request.json()
    const { source, count, duplicates_skipped, status, message, lead_ids, lead_names } = body
    const { data, error } = await supabase
      .from('sync_log')
      .insert({
        source: source ?? 'unbekannt',
        count: count ?? 0,
        duplicates_skipped: duplicates_skipped ?? 0,
        status: status ?? 'success',
        message: message ?? '',
        lead_ids: lead_ids ?? [],
        lead_names: lead_names ?? [],
      })
      .select().single()
    if (error) throw new Error(error.message)
    return Response.json({ success: true, data }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/sync-log]', error)
    return Response.json({ success: false, error: 'Sync-Log-Eintrag konnte nicht gespeichert werden' }, { status: 500 })
  }
}
