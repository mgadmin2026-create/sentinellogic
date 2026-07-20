// API Route: Team-Verwaltung (admin-only)
// GET  /api/team — alle Mitarbeiter-Konten auflisten
// POST /api/team — neuen Mitarbeiter anlegen (Supabase-Auth-Konto + Trigger legt public.users an)
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { isAdmin } from '@/lib/roles'

export const dynamic = 'force-dynamic'

export async function GET() {
  const currentUser = await getCurrentUser()
  if (!currentUser || !isAdmin(currentUser.role)) {
    return Response.json({ success: false, error: 'Nur für Admins' }, { status: 403 })
  }

  const supabase = createServerClient()
  const { data, error } = await supabase.from('users').select('*').order('name')

  if (error) {
    console.error('[GET /api/team] Fehler:', error)
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }

  return Response.json({ success: true, data: data ?? [] })
}

export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser()
  if (!currentUser || !isAdmin(currentUser.role)) {
    return Response.json({ success: false, error: 'Nur für Admins' }, { status: 403 })
  }

  const body = await request.json()
  const email = String(body.email || '').trim().toLowerCase()
  const name = String(body.name || '').trim()
  const role = String(body.role || 'mitarbeiter').trim()
  const password = String(body.password || '')

  if (!email || !name || !password) {
    return Response.json({ success: false, error: 'E-Mail, Name und Passwort erforderlich' }, { status: 400 })
  }
  if (password.length < 8) {
    return Response.json({ success: false, error: 'Passwort muss mindestens 8 Zeichen haben' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role },
  })

  if (error || !data.user) {
    console.error('[POST /api/team] Fehler:', error)
    return Response.json(
      { success: false, error: error?.message || 'Konto konnte nicht angelegt werden' },
      { status: 500 }
    )
  }

  return Response.json({ success: true, data: { id: data.user.id, email, name, role } }, { status: 201 })
}
