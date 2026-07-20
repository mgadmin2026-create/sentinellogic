// API Route: Einzelnes Tag
// PATCH  /api/kontakt-tags/[id] — Tag umbenennen (propagiert überall, da per tag_id referenziert)
// DELETE /api/kontakt-tags/[id] — Tag löschen (contact_tag_map kaskadiert)
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient()
    const { id } = params
    const body = await request.json()
    const name = String(body.name ?? '').trim()

    if (!name) {
      return Response.json({ success: false, error: 'Name erforderlich' }, { status: 400 })
    }

    // Case-insensitiv auf Kollision mit einem ANDEREN Tag prüfen
    const { data: collision } = await supabase
      .from('tags')
      .select('id')
      .ilike('name', name)
      .neq('id', id)
      .maybeSingle()

    if (collision) {
      return Response.json(
        { success: false, error: `Tag "${name}" existiert bereits` },
        { status: 409 }
      )
    }

    const { data, error } = await supabase
      .from('tags')
      .update({ name, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[PATCH /api/kontakt-tags/[id]] Fehler:', error)
      return Response.json({ success: false, error: error.message }, { status: 500 })
    }

    return Response.json({ success: true, data })
  } catch (err) {
    console.error('[PATCH /api/kontakt-tags/[id]] Fehler:', err)
    return Response.json({ success: false, error: 'Tag konnte nicht umbenannt werden' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient()
    const { id } = params

    const { error } = await supabase.from('tags').delete().eq('id', id)

    if (error) {
      console.error('[DELETE /api/kontakt-tags/[id]] Fehler:', error)
      return Response.json({ success: false, error: error.message }, { status: 500 })
    }

    return Response.json({ success: true, data: { deleted: true } })
  } catch (err) {
    console.error('[DELETE /api/kontakt-tags/[id]] Fehler:', err)
    return Response.json({ success: false, error: 'Tag konnte nicht gelöscht werden' }, { status: 500 })
  }
}
