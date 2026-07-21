// API Route: Aktivitäten-Feed über mehrere Kontakte hinweg (Mitarbeiterdashboard)
// GET /api/aktivitaeten — neueste Aktivitäten, optional gefiltert auf Kontakte
// eines bestimmten Verantwortlichen (assigned_user_id)
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return Response.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 })
  }

  const supabase = createServerClient()
  const url = new URL(request.url)
  const limit = parseInt(url.searchParams.get('limit') ?? '10', 10)
  const assignedUserId = url.searchParams.get('assigned_user_id')

  let query = supabase
    .from('activities')
    .select(assignedUserId
      ? '*, contact:lead_id!inner(id, first_name, last_name, company_name, assigned_user_id), user:user_id(name)'
      : '*, contact:lead_id(id, first_name, last_name, company_name, assigned_user_id), user:user_id(name)'
    )
    .order('created_at', { ascending: false })

  if (assignedUserId) {
    query = query.eq('contact.assigned_user_id', assignedUserId)
  }

  const { data, error } = await query.limit(limit)

  if (error) {
    console.error('[GET /api/aktivitaeten] Fehler:', error)
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }

  return Response.json({ success: true, data: data ?? [] })
}
