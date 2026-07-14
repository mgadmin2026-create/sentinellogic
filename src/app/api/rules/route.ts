// API Route: Automatisierungsregeln
// GET  /api/rules — alle Regeln laden
// POST /api/rules — neue Regel anlegen
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('rules')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) throw new Error(error.message)
    return Response.json({ success: true, data: data ?? [] })
  } catch (error) {
    console.error('[GET /api/rules]', error)
    return Response.json({ success: false, error: 'Regeln konnten nicht geladen werden' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const body = await request.json()
    const { name, condition_source, condition_sparte, actions } = body
    if (!name || !condition_source || !actions) {
      return Response.json({ success: false, error: 'name, condition_source und actions sind Pflicht' }, { status: 400 })
    }
    const { data, error } = await supabase
      .from('rules')
      .insert({
        name,
        condition_source,
        condition_sparte: condition_sparte || null,
        actions,
        active: body.active ?? true
      })
      .select().single()
    if (error) throw new Error(error.message)
    return Response.json({ success: true, data }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/rules]', error)
    return Response.json({ success: false, error: 'Regel konnte nicht angelegt werden' }, { status: 500 })
  }
}
