// E-Mail an einen Kontakt senden (Resend)
import { Resend } from 'resend'

// Absender-Anzeigename "Allianz Generalvertretung Gün".
// E-Mail-Adresse auf der eigenen, in Resend verifizierten Domain guen-versicherung.de
// (@allianz.de ist technisch nicht möglich – Domain gehört Allianz, nicht verifizierbar).
const FROM = 'Allianz Generalvertretung Gün <noreply@guen-versicherung.de>'
const ALLIANZ_URL = 'https://vertretung.allianz.de/melih.guen/'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildHtml(body: string): string {
  const safeBody = escapeHtml(body).replace(/\n/g, '<br>')
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:8px;color:#1A1A1A;font-size:15px;line-height:1.5">
      <div>${safeBody}</div>
      <hr style="border:none;border-top:1px solid #eee;margin:20px 0"/>
      <div style="font-size:13px;color:#555">
        <strong>Allianz Generalvertretung Gün</strong><br>
        <a href="${ALLIANZ_URL}" style="color:#0066B3;text-decoration:none">${ALLIANZ_URL}</a>
      </div>
    </div>
  `
}

function buildText(body: string): string {
  return `${body}\n\n—\nAllianz Generalvertretung Gün\n${ALLIANZ_URL}`
}

export interface SendContactEmailResult {
  ok: boolean
  error?: string
}

/**
 * Sendet eine E-Mail an einen Kontakt über Resend.
 * Absender: "Allianz Generalvertretung Gün" <noreply@guen-versicherung.de>, Signatur mit Allianz-URL.
 */
export async function sendContactEmail(params: {
  to: string
  subject: string
  body: string
}): Promise<SendContactEmailResult> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[Contact-Email] RESEND_API_KEY nicht gesetzt — E-Mail nicht gesendet')
    return { ok: false, error: 'RESEND_API_KEY nicht konfiguriert' }
  }

  const resend = new Resend(process.env.RESEND_API_KEY)

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: params.to,
      subject: params.subject,
      html: buildHtml(params.body),
      text: buildText(params.body),
    })

    if (error) {
      console.error('[Contact-Email] Resend-Fehler:', error)
      return { ok: false, error: typeof error === 'string' ? error : (error.message || 'Resend-Fehler') }
    }

    return { ok: true }
  } catch (err) {
    console.error('[Contact-Email] Fehler beim Senden:', err)
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
