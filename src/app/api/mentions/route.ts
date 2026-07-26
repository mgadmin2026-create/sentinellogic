// API Route: eigene Erwähnungen (Sidebar-Badge + /erwaehnungen-Seite)
// GET /api/mentions — alle Erwähnungen des aktuellen Users, neueste zuerst
//     (?unread=true filtert auf ungelesene)
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return Response.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 })
  }

  const url = new URL(request.url)
  const unreadOnly = url.searchParams.get('unread') === 'true'

  const supabase = createServerClient()
  let query = supabase
    .from('comment_mentions')
    .select('id, read_at, created_at, comment:comment_id(id, entity_type, entity_id, body, created_at, author:author_user_id(name))')
    .eq('mentioned_user_id', currentUser.id)
    .order('created_at', { ascending: false })

  if (unreadOnly) {
    query = query.is('read_at', null)
  }

  const { data: mentions, error } = await query.limit(200)

  if (error) {
    console.error('[GET /api/mentions] Fehler:', error)
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }

  const rows = mentions ?? []
  const taskIds = Array.from(new Set(rows.filter((m: any) => m.comment?.entity_type === 'task').map((m: any) => m.comment.entity_id)))
  const contactIds = Array.from(new Set(rows.filter((m: any) => m.comment?.entity_type === 'contact').map((m: any) => m.comment.entity_id)))

  const [{ data: tasks }, { data: contacts }] = await Promise.all([
    taskIds.length > 0
      ? supabase.from('tasks').select('id, titel, contact_id').in('id', taskIds)
      : Promise.resolve({ data: [] as any[] }),
    contactIds.length > 0
      ? supabase.from('contacts').select('id, first_name, last_name').in('id', contactIds)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const taskById = new Map((tasks ?? []).map((t: any) => [t.id, t]))
  const contactById = new Map((contacts ?? []).map((c: any) => [c.id, c]))

  const data = rows.map((m: any) => {
    const entityType = m.comment?.entity_type
    const entityId = m.comment?.entity_id
    let entityLabel = 'Unbekannt'
    let entityUrl = '/kontakte'

    if (entityType === 'contact') {
      const c = contactById.get(entityId)
      entityLabel = c ? `${c.first_name} ${c.last_name}`.trim() : 'Kontakt'
      entityUrl = `/kontakte/${entityId}`
    } else if (entityType === 'task') {
      const t = taskById.get(entityId)
      entityLabel = t ? `Aufgabe: ${t.titel}` : 'Aufgabe'
      entityUrl = t?.contact_id ? `/kontakte/${t.contact_id}` : '/aufgaben'
    }

    return {
      id: m.id,
      read_at: m.read_at,
      created_at: m.created_at,
      authorName: m.comment?.author?.name ?? 'Unbekannt',
      body: m.comment?.body ?? '',
      entityType,
      entityLabel,
      entityUrl,
    }
  })

  return Response.json({ success: true, data, unreadCount: data.filter((d) => !d.read_at).length })
}
