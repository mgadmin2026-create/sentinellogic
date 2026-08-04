// API Route: Sparten (inkl. Erstgespräch-Leitfaden)
// GET  /api/sparten — alle Sparten auflisten (sortiert)
// POST /api/sparten — neue Sparte anlegen
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return Response.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 })
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('sparten')
    .select('*')
    .order('sort_order')
    .order('name')

  if (error) {
    console.error('[GET /api/sparten] Fehler:', error)
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }

  return Response.json({ success: true, data: data ?? [] })
}

export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return Response.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 })
  }

  const body = await request.json()
  const name = String(body.name || '').trim()

  if (!name) {
    return Response.json({ success: false, error: 'Feld erforderlich: name' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('sparten')
    .insert({
      name,
      leitfaden_titel: body.leitfaden_titel ? String(body.leitfaden_titel).trim() : null,
      leitfaden_fragen: Array.isArray(body.leitfaden_fragen) ? body.leitfaden_fragen : [],
      leitfaden_abschluss: body.leitfaden_abschluss ? String(body.leitfaden_abschluss).trim() : null,
      sort_order: Number.isFinite(body.sort_order) ? body.sort_order : 0,
    })
    .select()
    .single()

  if (error) {
    console.error('[POST /api/sparten] Fehler:', error)
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }

  return Response.json({ success: true, data }, { status: 201 })
}
