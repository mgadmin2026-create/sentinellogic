// E-Mail-Benachrichtigungen fuer Automatisierungsregeln (Resend)
import { Resend } from 'resend'

const FROM = 'Sentimental Logic <noreply@guen-versicherung.de>'

export interface RuleNotificationActions {
  klicktipp_tag?: string
  dialfire_campaign?: string
  set_status?: string
}

function actionsToText(actions: RuleNotificationActions): string {
  return [
    actions.klicktipp_tag ? `• KlickTipp Tag: "${actions.klicktipp_tag}"` : null,
    actions.dialfire_campaign ? `• Dialfire Kampagne: "${actions.dialfire_campaign}"` : null,
    actions.set_status ? `• Status gesetzt: ${actions.set_status}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[Rule-Notification] RESEND_API_KEY nicht gesetzt — E-Mail nicht gesendet')
    return null
  }
  return new Resend(process.env.RESEND_API_KEY)
}

/**
 * Benachrichtigung fuer EINEN Kontakt (z.B. neuer Lead, Regel automatisch ausgeloest).
 * Gibt true zurueck, wenn versendet.
 */
export async function sendRuleNotification(params: {
  to: string
  contactName: string
  contactEmail?: string | null
  ruleName: string
  actions: RuleNotificationActions
}): Promise<boolean> {
  const resend = getResend()
  if (!resend) return false

  try {
    await resend.emails.send({
      from: FROM,
      to: params.to,
      subject: `🔔 Neuer Kontakt: ${params.contactName}`,
      html: `
        <div style="font-family:sans-serif;max-width:540px;margin:0 auto;padding:24px">
          <h2 style="color:#1A1A1A;margin-bottom:4px">Neuer Kontakt angelegt</h2>
          <p style="color:#666;margin-top:0">Regel: <strong>${params.ruleName}</strong></p>
          <hr style="border:none;border-top:1px solid #eee;margin:16px 0"/>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:6px 0;color:#666;width:120px">Name</td><td style="font-weight:600">${params.contactName}</td></tr>
            ${params.contactEmail ? `<tr><td style="padding:6px 0;color:#666">E-Mail</td><td>${params.contactEmail}</td></tr>` : ''}
          </table>
          <hr style="border:none;border-top:1px solid #eee;margin:16px 0"/>
          <p style="color:#666;margin-bottom:6px"><strong>Ausgeführte Aktionen:</strong></p>
          <pre style="background:#f9f9f9;padding:12px;border-radius:8px;font-size:13px;color:#333">${actionsToText(params.actions) || '—'}</pre>
          <p style="margin-top:20px;font-size:12px;color:#999">Sentimental Logic — Automatisierungssystem</p>
        </div>
      `,
    })
    return true
  } catch (err) {
    console.error('[Rule-Notification] E-Mail-Fehler:', err)
    return false
  }
}

/**
 * Zusammenfassende Benachrichtigung fuer eine MANUELLE Batch-Ausfuehrung.
 * Eine Mail pro Lauf (kein Spam pro Kontakt).
 */
export async function sendRuleBatchNotification(params: {
  to: string
  ruleName: string
  appliedCount: number
  actions: RuleNotificationActions
}): Promise<boolean> {
  const resend = getResend()
  if (!resend) return false

  try {
    await resend.emails.send({
      from: FROM,
      to: params.to,
      subject: `🔔 Regel manuell ausgeführt: ${params.ruleName}`,
      html: `
        <div style="font-family:sans-serif;max-width:540px;margin:0 auto;padding:24px">
          <h2 style="color:#1A1A1A;margin-bottom:4px">Regel manuell angewendet</h2>
          <p style="color:#666;margin-top:0">Regel: <strong>${params.ruleName}</strong></p>
          <hr style="border:none;border-top:1px solid #eee;margin:16px 0"/>
          <p style="color:#333">Auf <strong>${params.appliedCount}</strong> Kontakt(e) angewendet.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:16px 0"/>
          <p style="color:#666;margin-bottom:6px"><strong>Aktionen:</strong></p>
          <pre style="background:#f9f9f9;padding:12px;border-radius:8px;font-size:13px;color:#333">${actionsToText(params.actions) || '—'}</pre>
          <p style="margin-top:20px;font-size:12px;color:#999">Sentimental Logic — Automatisierungssystem</p>
        </div>
      `,
    })
    return true
  } catch (err) {
    console.error('[Rule-Notification] Batch-E-Mail-Fehler:', err)
    return false
  }
}
