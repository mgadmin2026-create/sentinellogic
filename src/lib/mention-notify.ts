// E-Mail-Benachrichtigung bei @-Erwähnung in einem Kommentar (Aufgabe/Kontakt).
// Eine Mail pro erwähnter Person und Kommentar — keine Drosselung, da jede
// Erwähnung für die betroffene Person einzeln relevant ist (anders als der
// Drive-Token-Alarm, der einen Systemfehler meldet).
import { Resend } from 'resend'

const FROM = 'Sentimental Logic <noreply@guen-versicherung.de>'

export async function notifyMention(params: {
  to: string
  mentionedByName: string
  entityLabel: string
  entityUrl: string
  commentExcerpt: string
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[Mention-Notify] RESEND_API_KEY nicht gesetzt — Benachrichtigung nicht gesendet')
    return
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ''
    const fullUrl = siteUrl ? `${siteUrl.replace(/\/$/, '')}${params.entityUrl}` : params.entityUrl

    await resend.emails.send({
      from: FROM,
      to: params.to,
      subject: `${params.mentionedByName} hat dich erwähnt — ${params.entityLabel}`,
      html: `
        <div style="font-family:sans-serif;max-width:540px;margin:0 auto;padding:24px">
          <h2 style="color:#1A1A1A;margin-bottom:4px">Du wurdest erwähnt</h2>
          <p style="color:#666;margin-top:0"><strong>${params.mentionedByName}</strong> hat dich in einem Kommentar erwähnt: <strong>${params.entityLabel}</strong></p>
          <hr style="border:none;border-top:1px solid #eee;margin:16px 0"/>
          <p style="color:#333;white-space:pre-wrap">${params.commentExcerpt}</p>
          <hr style="border:none;border-top:1px solid #eee;margin:16px 0"/>
          <p><a href="${fullUrl}" style="color:#0066B3">Zum Kommentar →</a></p>
        </div>
      `,
      text: `${params.mentionedByName} hat dich in einem Kommentar erwähnt: ${params.entityLabel}\n\n${params.commentExcerpt}\n\n${fullUrl}`,
    })
  } catch (err) {
    console.error('[Mention-Notify] Fehler beim Senden:', err)
  }
}
