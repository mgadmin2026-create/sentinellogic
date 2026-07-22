// API Route: einzelne E-Mail-Vorlage
// PATCH  /api/mail-templates/[id] — Vorlage bearbeiten
// DELETE /api/mail-templates/[id] — Vorlage löschen
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
  const updates: Record<string, string> = {}
  if (body.name !== undefined) updates.name = String(body.name).trim()
  if (body.subject !== undefined) updates.subject = String(body.subject).trim()
  if (body.body !== undefined) updates.body = String(body.body).trim()

  if (Object.keys(updates).length === 0) {
    return Response.json({ success: false, error: 'Keine Änderungen übergeben' }, { status: 400 })
  }
  if (updates.name === '' || updates.subject === '' || updates.body === '') {
    return Response.json({ success: false, error: 'Felder dürfen nicht leer sein' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('mail_templates')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()

  if (error) {
    console.error('[PATCH /api/mail-templates/[id]] Fehler:', error)
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
  const { error } = await supabase.from('mail_templates').delete().eq('id', params.id)

  if (error) {
    console.error('[DELETE /api/mail-templates/[id]] Fehler:', error)
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }

  return Response.json({ success: true })
}
