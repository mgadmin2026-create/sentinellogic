import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activities-logger'
import {
  listInbox,
  sendStratoMail,
  StratoMailConfigurationError,
} from '@/lib/strato-mail'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function safeError(error: unknown): { message: string; status: number; configured: boolean } {
  if (error instanceof StratoMailConfigurationError) {
    return { message: error.message, status: 503, configured: false }
  }
  return {
    message: 'Das STRATO-Postfach konnte nicht erreicht werden. Bitte Verbindung und Zugangsdaten prüfen.',
    status: 502,
    configured: true,
  }
}

export async function GET(request: NextRequest) {
  try {
    const page = Number(request.nextUrl.searchParams.get('page') || 1)
    const data = await listInbox(page)
    return Response.json({ success: true, configured: true, data })
  } catch (error) {
    console.error('[Postfach] Posteingang konnte nicht geladen werden:', error instanceof Error ? error.name : 'Unbekannter Fehler')
    const safe = safeError(error)
    return Response.json({ success: false, configured: safe.configured, error: safe.message }, { status: safe.status })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      to?: string
      subject?: string
      text?: string
      inReplyTo?: string
      references?: string[]
    }
    const to = body.to?.trim() || ''
    const subject = body.subject?.trim() || ''
    const text = body.text?.trim() || ''

    if (!EMAIL_RE.test(to)) return Response.json({ success: false, error: 'Ungültige Empfänger-Adresse' }, { status: 400 })
    if (!subject) return Response.json({ success: false, error: 'Betreff fehlt' }, { status: 400 })
    if (!text) return Response.json({ success: false, error: 'Nachricht fehlt' }, { status: 400 })

    await sendStratoMail({
      to,
      subject,
      text,
      inReplyTo: body.inReplyTo,
      references: body.references,
    })

    // Nur bei eindeutigem E-Mail-Treffer protokollieren. Inhalt wird nicht gespeichert.
    const supabase = createServerClient()
    const { data: contact } = await supabase.from('contacts').select('id').eq('email', to.toLowerCase()).maybeSingle()
    if (contact) {
      await logActivity(null, contact.id, 'email_sent', `E-Mail aus dem STRATO-Postfach gesendet: ${subject}`, {
        subject,
        channel: 'strato_smtp',
      })
    }

    return Response.json({ success: true })
  } catch (error) {
    console.error('[Postfach] E-Mail konnte nicht gesendet werden:', error instanceof Error ? error.name : 'Unbekannter Fehler')
    const safe = safeError(error)
    return Response.json({ success: false, configured: safe.configured, error: safe.message }, { status: safe.status })
  }
}
