// API Route: leichte Team-Liste für Zuweisungs-Dropdowns (Verantwortlicher)
// GET /api/users — für jeden eingeloggten User, keine Admin-Beschränkung wie
// bei /api/team. Liefert bewusst nur {id, name} — keine E-Mail/Rolle/Aktiv-
// Status an Mitarbeiter durchreichen.
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
    .from('users')
    .select('id, name')
    .eq('active', true)
    .order('name')

  if (error) {
    console.error('[GET /api/users] Fehler:', error)
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }

  return Response.json({ success: true, data: data ?? [] })
}
