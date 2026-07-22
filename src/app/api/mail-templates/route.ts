// API Route: E-Mail-Vorlagen für den Kontakt-Compose-Flow
// GET  /api/mail-templates — alle Vorlagen auflisten
// POST /api/mail-templates — neue Vorlage anlegen
import { NextRequest } from 'next/server'
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
    .from('mail_templates')
    .select('*')
    .order('name')

  if (error) {
    console.error('[GET /api/mail-templates] Fehler:', error)
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }

  return Response.json({ success: true, data: data ?? [] })
}

export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return Response.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 })
  }

  const body = await request.json()
  const name = String(body.name || '').trim()
  const subject = String(body.subject || '').trim()
  const templateBody = String(body.body || '').trim()

  if (!name || !subject || !templateBody) {
    return Response.json(
      { success: false, error: 'Felder erforderlich: name, subject, body' },
      { status: 400 }
    )
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('mail_templates')
    .insert({ name, subject, body: templateBody })
    .select()
    .single()

  if (error) {
    console.error('[POST /api/mail-templates] Fehler:', error)
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }

  return Response.json({ success: true, data }, { status: 201 })
}
