// Serverseitige Session-Auflösung ("wer ist eingeloggt"). Für die reine
// Rollen-Prüfung (auch aus Client Components sicher) siehe src/lib/roles.ts —
// dieses Modul importiert next/headers und darf nicht von Client Components
// importiert werden.
import { createSessionServerClient } from '@/lib/supabase/session'
import { createServerClient } from '@/lib/supabase/server'

export interface CurrentUser {
  id: string
  email: string
  name: string
  role: string
  active: boolean
}

/** Liefert null, wenn niemand eingeloggt ist oder das Profil fehlt. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const sessionClient = createSessionServerClient()
  const { data: { user } } = await sessionClient.auth.getUser()
  if (!user) return null

  // public.users hat (wie der Rest des Projekts) keine RLS-Policies für den
  // authenticated-Client — Profil-Lookup läuft daher über den Service-Role-
  // Client. Zugriffsschutz passiert auf App-Ebene (Middleware), nicht per RLS.
  const supabase = createServerClient()
  const { data: profile } = await supabase
    .from('users')
    .select('name, role, active')
    .eq('id', user.id)
    .single()

  if (!profile) return null

  return {
    id: user.id,
    email: user.email ?? '',
    name: profile.name,
    role: profile.role,
    active: profile.active,
  }
}
