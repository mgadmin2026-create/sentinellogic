// Admin-Alarm bei fehlgeschlagenem Google-Drive-Token-Refresh.
// Zweck: Ein normaler Mitarbeiter, der eine E-Mail mit Anhang sendet oder ein
// Dokument hochlädt, soll nicht der Erste sein, der von einer kaputten
// Drive-Verbindung erfährt — das ist Admin-Angelegenheit (Neuverbindung in
// Einstellungen → Dokumente). Cooldown verhindert Spam bei jedem Fehlversuch.
import { Resend } from 'resend'
import { createServerClient } from './supabase/server'

const FROM = 'Sentimental Logic <noreply@guen-versicherung.de>'
const COOLDOWN_HOURS = 6

export async function notifyAdminsOfDriveTokenFailure(errorMessage: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[Drive-Alert] RESEND_API_KEY nicht gesetzt — Admin-Alarm nicht gesendet')
    return
  }

  try {
    const supabase = createServerClient()

    const { data: tokenRow } = await supabase
      .from('google_drive_system_token')
      .select('last_failure_notified_at')
      .eq('id', 1)
      .maybeSingle()

    const lastNotified = tokenRow?.last_failure_notified_at ? new Date(tokenRow.last_failure_notified_at) : null
    const cooldownActive = lastNotified ? Date.now() - lastNotified.getTime() < COOLDOWN_HOURS * 60 * 60 * 1000 : false
    if (cooldownActive) return

    const { data: admins } = await supabase
      .from('users')
      .select('email')
      .eq('role', 'admin')
      .eq('active', true)

    const recipients = (admins ?? []).map((a) => a.email).filter(Boolean) as string[]
    if (recipients.length === 0) {
      console.warn('[Drive-Alert] Keine aktiven Admins gefunden — Alarm nicht gesendet')
      return
    }

    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: FROM,
      to: recipients,
      subject: '⚠️ Google Drive: Verbindung unterbrochen',
      html: `
        <div style="font-family:sans-serif;max-width:540px;margin:0 auto;padding:24px">
          <h2 style="color:#1A1A1A;margin-bottom:4px">Google Drive Verbindung unterbrochen</h2>
          <p style="color:#666;margin-top:0">Der Token-Refresh für das zentrale Google-Drive-System-Konto ist fehlgeschlagen. Dokument-Uploads und E-Mail-Anhang-Ablage funktionieren bis zur Neuverbindung nicht — der eigentliche Versand/die Anlage läuft aber normal weiter.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:16px 0"/>
          <p style="color:#333"><strong>Fehler:</strong> ${errorMessage}</p>
          <hr style="border:none;border-top:1px solid #eee;margin:16px 0"/>
          <p style="color:#666">Bitte in <strong>Einstellungen → Dokumente</strong> das Google-Drive-Konto erneut verbinden.</p>
          <p style="margin-top:20px;font-size:12px;color:#999">Diese Warnung wird höchstens alle ${COOLDOWN_HOURS} Stunden verschickt, bis die Verbindung wiederhergestellt ist.</p>
        </div>
      `,
      text: `Der Token-Refresh für das zentrale Google-Drive-System-Konto ist fehlgeschlagen.\n\nFehler: ${errorMessage}\n\nBitte in Einstellungen → Dokumente das Google-Drive-Konto erneut verbinden.`,
    })

    await supabase
      .from('google_drive_system_token')
      .update({ last_failure_notified_at: new Date().toISOString() })
      .eq('id', 1)

    console.log(`[Drive-Alert] Admin-Alarm gesendet an ${recipients.length} Empfänger`)
  } catch (err) {
    console.error('[Drive-Alert] Fehler beim Senden des Admin-Alarms:', err)
  }
}
