// API Route: Einzelner Mitarbeiter (admin-only)
// PATCH  /api/team/[id] — Rolle ändern, aktivieren/deaktivieren, Passwort zurücksetzen
// DELETE /api/team/[id] — Konto entfernen
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { isAdmin } from '@/lib/roles'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const currentUser = await getCurrentUser()
  if (!currentUser || !isAdmin(currentUser.role)) {
    return Response.json({ success: false, error: 'Nur für Admins' }, { status: 403 })
  }

  const { id } = params
  const body = await request.json()
  const supabase = createServerClient()

  // Passwort zurücksetzen läuft über die Auth-Ebene, nicht public.users
  if (body.password) {
    const password = String(body.password)
    if (password.length < 8) {
      return Response.json({ success: false, error: 'Passwort muss mindestens 8 Zeichen haben' }, { status: 400 })
    }
    const { error: pwError } = await supabase.auth.admin.updateUserById(id, { password })
    if (pwError) {
      console.error('[PATCH /api/team/[id]] Passwort-Fehler:', pwError)
      return Response.json({ success: false, error: pwError.message }, { status: 500 })
    }
  }

  const updates: Record<string, unknown> = {}
  if (body.role !== undefined) updates.role = String(body.role).trim()
  if (body.active !== undefined) updates.active = body.active === true

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.from('users').update(updates).eq('id', id)
    if (error) {
      console.error('[PATCH /api/team/[id]] Fehler:', error)
      return Response.json({ success: false, error: error.message }, { status: 500 })
    }
  }

  return Response.json({ success: true })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const currentUser = await getCurrentUser()
  if (!currentUser || !isAdmin(currentUser.role)) {
    return Response.json({ success: false, error: 'Nur für Admins' }, { status: 403 })
  }

  const { id } = params
  if (id === currentUser.id) {
    return Response.json({ success: false, error: 'Eigenes Konto kann nicht gelöscht werden' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { error } = await supabase.auth.admin.deleteUser(id)

  if (error) {
    console.error('[DELETE /api/team/[id]] Fehler:', error)
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }

  return Response.json({ success: true })
}
