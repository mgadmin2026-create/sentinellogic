// API Route: Interne Kontakt-Tags
// GET  /api/kontakt-tags — alle Tags auflisten (optional ?search= für Autocomplete)
// POST /api/kontakt-tags — Tag anlegen oder bestehenden per Name zurückgeben (case-insensitiv)
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const url = new URL(request.url)
    const search = url.searchParams.get('search')

    let query = supabase.from('tags').select('*').order('name')
    if (search) {
      query = query.ilike('name', `%${search}%`)
    }

    const { data, error } = await query
    if (error) {
      console.error('[GET /api/kontakt-tags] Fehler:', error)
      return Response.json({ success: false, error: error.message }, { status: 500 })
    }

    return Response.json({ success: true, data: data ?? [] })
  } catch (err) {
    console.error('[GET /api/kontakt-tags] Fehler:', err)
    return Response.json({ success: false, error: 'Tags konnten nicht geladen werden' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const body = await request.json()
    const name = String(body.name ?? '').trim()

    if (!name) {
      return Response.json({ success: false, error: 'Name erforderlich' }, { status: 400 })
    }

    // Case-insensitiv nach bestehendem Tag suchen — verhindert Tippfehler-Duplikate
    const { data: existing } = await supabase
      .from('tags')
      .select('*')
      .ilike('name', name)
      .maybeSingle()

    if (existing) {
      return Response.json({ success: true, data: existing })
    }

    const { data, error } = await supabase
      .from('tags')
      .insert({ name })
      .select()
      .single()

    if (error) {
      console.error('[POST /api/kontakt-tags] Fehler:', error)
      return Response.json({ success: false, error: error.message }, { status: 500 })
    }

    return Response.json({ success: true, data }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/kontakt-tags] Fehler:', err)
    return Response.json({ success: false, error: 'Tag konnte nicht angelegt werden' }, { status: 500 })
  }
}
