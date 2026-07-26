// API Route: einzelne Erwähnung als gelesen markieren
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

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('comment_mentions')
    .update({ read_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('mentioned_user_id', currentUser.id)
    .select()
    .single()

  if (error) {
    console.error('[PATCH /api/mentions/[id]] Fehler:', error)
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }

  return Response.json({ success: true, data })
}
