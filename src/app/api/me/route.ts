// API Route: aktuell eingeloggter User (für Client Components, die die
// Rolle für UI-Entscheidungen brauchen, z.B. "Team"-Karte nur für Admins)
// GET   — aktuelle Profildaten
// PATCH — eigenes Profil ändern (Name, E-Mail, Passwort) — kein Admin-Recht nötig
import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import { createSessionServerClient } from '@/lib/supabase/session'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return Response.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 })
  }
  return Response.json({ success: true, data: user })
}

export async function PATCH(request: NextRequest) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return Response.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 })
  }

  const body = await request.json()
  const supabase = createServerClient()
  const sessionClient = createSessionServerClient()

  if (body.name !== undefined) {
    const name = String(body.name).trim()
    if (!name) {
      return Response.json({ success: false, error: 'Name darf nicht leer sein' }, { status: 400 })
    }
    const { error } = await supabase.from('users').update({ name }).eq('id', currentUser.id)
    if (error) {
      console.error('[PATCH /api/me] Name-Fehler:', error)
      return Response.json({ success: false, error: error.message }, { status: 500 })
    }
  }

  if (body.email !== undefined) {
    const email = String(body.email).trim().toLowerCase()
    if (!email) {
      return Response.json({ success: false, error: 'E-Mail darf nicht leer sein' }, { status: 400 })
    }
    if (email !== currentUser.email) {
      const { error } = await sessionClient.auth.updateUser({ email })
      if (error) {
        console.error('[PATCH /api/me] E-Mail-Fehler:', error)
        return Response.json({ success: false, error: error.message }, { status: 500 })
      }
    }
  }

  if (body.newPassword !== undefined) {
    const currentPassword = String(body.currentPassword || '')
    const newPassword = String(body.newPassword)
    if (!currentPassword) {
      return Response.json({ success: false, error: 'Aktuelles Passwort erforderlich' }, { status: 400 })
    }
    if (newPassword.length < 8) {
      return Response.json({ success: false, error: 'Neues Passwort muss mindestens 8 Zeichen haben' }, { status: 400 })
    }

    // Verifiziert das aktuelle Passwort, bevor die Änderung zugelassen wird —
    // verhindert, dass eine offene, unbeaufsichtigte Session missbraucht wird.
    const { error: reauthError } = await sessionClient.auth.signInWithPassword({
      email: currentUser.email,
      password: currentPassword,
    })
    if (reauthError) {
      return Response.json({ success: false, error: 'Aktuelles Passwort ist falsch' }, { status: 400 })
    }

    const { error } = await sessionClient.auth.updateUser({ password: newPassword })
    if (error) {
      console.error('[PATCH /api/me] Passwort-Fehler:', error)
      return Response.json({ success: false, error: error.message }, { status: 500 })
    }
  }

  return Response.json({ success: true })
}
