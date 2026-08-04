// API Route: einzelne Sparte
// PATCH  /api/sparten/[id] — Sparte bearbeiten (Name/Leitfaden)
// DELETE /api/sparten/[id] — Sparte löschen (kaskadiert über contact_sparte_map)
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return Response.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 })
  }

  const body = await request.json()
  const updates: Record<string, any> = {}
  if (body.name !== undefined) updates.name = String(body.name).trim()
  if (body.leitfaden_titel !== undefined) updates.leitfaden_titel = body.leitfaden_titel ? String(body.leitfaden_titel).trim() : null
  if (body.leitfaden_fragen !== undefined) updates.leitfaden_fragen = Array.isArray(body.leitfaden_fragen) ? body.leitfaden_fragen : []
  if (body.leitfaden_abschluss !== undefined) updates.leitfaden_abschluss = body.leitfaden_abschluss ? String(body.leitfaden_abschluss).trim() : null
  if (body.sort_order !== undefined) updates.sort_order = Number.isFinite(body.sort_order) ? body.sort_order : 0

  if (Object.keys(updates).length === 0) {
    return Response.json({ success: false, error: 'Keine Änderungen übergeben' }, { status: 400 })
  }
  if (updates.name === '') {
    return Response.json({ success: false, error: 'Name darf nicht leer sein' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('sparten')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()

  if (error) {
    console.error('[PATCH /api/sparten/[id]] Fehler:', error)
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }

  return Response.json({ success: true, data })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return Response.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 })
  }

  const supabase = createServerClient()
  const { error } = await supabase.from('sparten').delete().eq('id', params.id)

  if (error) {
    console.error('[DELETE /api/sparten/[id]] Fehler:', error)
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }

  return Response.json({ success: true })
}
