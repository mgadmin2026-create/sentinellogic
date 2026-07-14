// POST /api/kontakte/[id]/email — E-Mail an einen Kontakt senden (Resend)
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { sendContactEmail } from '@/lib/contact-email'
import { logActivity } from '@/lib/activities-logger'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()

    const to = typeof body.to === 'string' ? body.to.trim() : ''
    const subject = typeof body.subject === 'string' ? body.subject.trim() : ''
    const text = typeof body.body === 'string' ? body.body.trim() : ''

    if (!EMAIL_RE.test(to)) {
      return Response.json({ success: false, error: 'Ungültige Empfänger-Adresse' }, { status: 400 })
    }
    if (!subject) {
      return Response.json({ success: false, error: 'Betreff fehlt' }, { status: 400 })
    }
    if (!text) {
      return Response.json({ success: false, error: 'Nachricht fehlt' }, { status: 400 })
    }

    // Kontakt prüfen
    const supabase = createServerClient()
    const { data: contact, error: fetchError } = await supabase
      .from('contacts')
      .select('id, first_name, last_name')
      .eq('id', id)
      .single()

    if (fetchError || !contact) {
      return Response.json({ success: false, error: 'Kontakt nicht gefunden' }, { status: 404 })
    }

    const result = await sendContactEmail({ to, subject, body: text })

    if (!result.ok) {
      await logActivity(null, id, 'email_failed', `E-Mail an ${to} fehlgeschlagen: ${result.error || 'Unbekannter Fehler'}`, {
        to,
        subject,
      })
      return Response.json({ success: false, error: result.error || 'Versand fehlgeschlagen' }, { status: 500 })
    }

    await logActivity(null, id, 'email_sent', `E-Mail gesendet an ${to}: ${subject}`, {
      to,
      subject,
    })

    return Response.json({ success: true })
  } catch (err) {
    console.error('[POST /api/kontakte/[id]/email] Fehler:', err)
    return Response.json(
      { success: false, error: err instanceof Error ? err.message : 'Unbekannter Fehler' },
      { status: 500 }
    )
  }
}
