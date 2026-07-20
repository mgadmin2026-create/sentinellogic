// API Route: Tags eines Kontakts
// PUT /api/kontakte/[id]/tags — kompletten Tag-Satz ersetzen (Body: { tagIds: string[] })
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient()
    const { id } = params
    const body = await request.json()
    const tagIds: string[] = Array.isArray(body.tagIds) ? body.tagIds : []

    const { error: deleteError } = await supabase
      .from('contact_tag_map')
      .delete()
      .eq('contact_id', id)

    if (deleteError) {
      console.error('[PUT /api/kontakte/[id]/tags] Fehler beim Zurücksetzen:', deleteError)
      return Response.json({ success: false, error: deleteError.message }, { status: 500 })
    }

    if (tagIds.length > 0) {
      const rows = tagIds.map((tagId) => ({ contact_id: id, tag_id: tagId }))
      const { error: insertError } = await supabase.from('contact_tag_map').insert(rows)

      if (insertError) {
        console.error('[PUT /api/kontakte/[id]/tags] Fehler beim Setzen:', insertError)
        return Response.json({ success: false, error: insertError.message }, { status: 500 })
      }
    }

    const { data: tagRows } = await supabase
      .from('contact_tag_map')
      .select('tag:tag_id(id, name)')
      .eq('contact_id', id)

    return Response.json({ success: true, data: { tags: (tagRows ?? []).map((r: any) => r.tag) } })
  } catch (err) {
    console.error('[PUT /api/kontakte/[id]/tags] Fehler:', err)
    return Response.json({ success: false, error: 'Tags konnten nicht gespeichert werden' }, { status: 500 })
  }
}
