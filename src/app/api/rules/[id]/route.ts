// API Route: Einzelne Regel bearbeiten / löschen
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient()
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, created_at, runs: _runs, ...updates } = await request.json()
    const { data, error } = await supabase
      .from('rules').update(updates).eq('id', params.id).select().single()
    if (error) throw new Error(error.message)
    return Response.json({ success: true, data })
  } catch (error) {
    console.error('[PATCH /api/rules/[id]]', error)
    return Response.json({ success: false, error: 'Regel konnte nicht aktualisiert werden' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient()
    const { error } = await supabase.from('rules').delete().eq('id', params.id)
    if (error) throw new Error(error.message)
    return Response.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/rules/[id]]', error)
    return Response.json({ success: false, error: 'Regel konnte nicht gelöscht werden' }, { status: 500 })
  }
}
