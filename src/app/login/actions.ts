'use server'
import { redirect } from 'next/navigation'
import { createSessionServerClient } from '@/lib/supabase/session'
import { createServerClient } from '@/lib/supabase/server'

export interface LoginState {
  error?: string
}

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') || '').trim()
  const password = String(formData.get('password') || '')
  const next = String(formData.get('next') || '/dashboard')

  if (!email || !password) {
    return { error: 'E-Mail und Passwort erforderlich' }
  }

  const sessionClient = createSessionServerClient()
  const { data, error } = await sessionClient.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    return { error: 'E-Mail oder Passwort falsch' }
  }

  // public.users hat keine RLS-Policies für den authenticated-Client (siehe
  // src/lib/auth.ts) — Aktiv-Check läuft daher über den Service-Role-Client.
  const supabase = createServerClient()
  const { data: profile } = await supabase
    .from('users')
    .select('active')
    .eq('id', data.user.id)
    .single()

  if (!profile || !profile.active) {
    await sessionClient.auth.signOut()
    return { error: 'Dieses Konto ist deaktiviert. Bitte an einen Admin wenden.' }
  }

  redirect(next)
}

export async function logout() {
  const supabase = createSessionServerClient()
  await supabase.auth.signOut()
  redirect('/login')
}
