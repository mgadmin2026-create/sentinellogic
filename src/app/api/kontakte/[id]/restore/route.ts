// API Route: Archivierten Kontakt wiederherstellen
// POST /api/kontakte/[id]/restore
import { NextRequest } from 'next/server'
import { logContactRestored } from '@/lib/activities-logger'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient()
    const { id } = params
    const { restoreTasks = false } = await request.json().catch(() => ({ restoreTasks: false }))

    const { data: kontakt } = await supabase
      .from('contacts')
      .select('first_name, last_name')
      .eq('id', id)
      .single()

    if (!kontakt) {
      return Response.json({ success: false, error: 'Kontakt nicht gefunden' }, { status: 404 })
    }

    const { error } = await supabase
      .from('contacts')
      .update({ archived_at: null })
      .eq('id', id)

    if (error) {
      console.error('[POST /api/kontakte/[id]/restore] Fehler:', error)
      return Response.json({ success: false, error: error.message }, { status: 500 })
    }

    if (restoreTasks === true) {
      const { error: taskError } = await supabase
        .from('tasks')
        .update({ archived_at: null })
        .eq('contact_id', id)
        .not('archived_at', 'is', null)

      if (taskError) {
        console.warn('[POST /api/kontakte/[id]/restore] Aufgaben-Wiederherstellung fehlgeschlagen:', taskError)
      }
    }

    await logContactRestored(id, `${kontakt.first_name} ${kontakt.last_name}`)

    return Response.json({ success: true, data: { restored: true, tasksRestored: restoreTasks === true } })
  } catch (err) {
    console.error('[POST /api/kontakte/[id]/restore] Fehler:', err)
    return Response.json({ success: false, error: 'Kontakt konnte nicht wiederhergestellt werden' }, { status: 500 })
  }
}
