// Cookie-gebundener Supabase-Client für Server Components, Route Handlers und
// Server Actions — nutzt den Anon-Key + die Session des eingeloggten Users.
// Für privilegierte Service-Role-Operationen weiterhin createServerClient()
// aus src/lib/supabase/server.ts verwenden, NICHT diesen Client.
import { createServerClient as createSupabaseSsrClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createSessionServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase Umgebungsvariablen fehlen: NEXT_PUBLIC_SUPABASE_URL oder NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  const cookieStore = cookies()

  return createSupabaseSsrClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Wird in Server Components (nicht Actions/Route Handlers) geworfen,
          // wo Cookies nicht gesetzt werden dürfen. Middleware erneuert die
          // Session ohnehin bei jedem Request, daher ignorierbar.
        }
      },
    },
  })
}
