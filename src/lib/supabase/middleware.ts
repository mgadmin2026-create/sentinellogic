// Session-Erneuerung für middleware.ts — eigenes Cookie-Handling, da
// Request/Response-Objekte in Middleware anders funktionieren als in
// Server Components (siehe src/lib/supabase/session.ts).
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase Umgebungsvariablen fehlen: NEXT_PUBLIC_SUPABASE_URL oder NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  // WICHTIG: getUser() (nicht getSession()) validiert den Token gegen Supabase,
  // statt nur dem Cookie zu vertrauen — verhindert gefälschte Session-Cookies.
  const { data: { user } } = await supabase.auth.getUser()

  return { response, user }
}
