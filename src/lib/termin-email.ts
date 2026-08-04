// Termin-Benachrichtigungen per E-Mail an Teilnehmer: Einladung (neuer
// Termin), Aktualisierung (verschoben/Ort geändert/Inhalt geändert) und
// Absage (storniert). Nutzt dieselbe STRATO-Postfach/Resend-Infrastruktur
// wie contact-email.ts, ergänzt um einen echten iTIP-Kalenderanhang
// (METHOD:REQUEST/CANCEL), damit Outlook/Gmail/Apple Kalender die Mail als
// Einladung mit Annehmen/Ablehnen-Buttons darstellen statt als normale Mail.
import 'server-only'
import { Resend } from 'resend'
import { isStratoMailboxConfigured, sendStratoMail } from '@/lib/strato-mail'
import { toDateKey } from '@/lib/kalender-helpers'

const ALLIANZ_URL = 'https://vertretung.allianz.de/melih.guen/'
const RESEND_FROM = 'Allianz Generalvertretung Gün <noreply@guen-versicherung.de>'

export type TerminBenachrichtigungsArt = 'einladung' | 'aktualisierung' | 'absage'

export interface TerminFuerBenachrichtigung {
  id: string
  titel: string
  beschreibung?: string | null
  ort?: string | null
  start_zeit: string
  end_zeit: string
  ganztaegig: boolean
}

interface Teilnehmer {
  email: string
  name?: string
}

function icsUid(terminId: string): string {
  return `termin-${terminId}@sentinellogic.de`
}

function escapeIcsText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function toIcsDate(d: Date, ganztaegig: boolean): string {
  if (ganztaegig) return toDateKey(d).replace(/-/g, '')
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

function buildIcs(
  termin: TerminFuerBenachrichtigung,
  art: TerminBenachrichtigungsArt,
  sequence: number,
  organizerEmail: string,
  teilnehmer: Teilnehmer[]
): string {
  const method = art === 'absage' ? 'CANCEL' : 'REQUEST'
  const status = art === 'absage' ? 'CANCELLED' : 'CONFIRMED'
  const dtType = termin.ganztaegig ? ';VALUE=DATE' : ''
  const zeilen = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `METHOD:${method}`,
    'PRODID:-//Sentimental Logic//Kalender//DE',
    'BEGIN:VEVENT',
    `UID:${icsUid(termin.id)}`,
    `SEQUENCE:${sequence}`,
    `STATUS:${status}`,
    `DTSTAMP:${toIcsDate(new Date(), false)}`,
    `DTSTART${dtType}:${toIcsDate(new Date(termin.start_zeit), termin.ganztaegig)}`,
    `DTEND${dtType}:${toIcsDate(new Date(termin.end_zeit), termin.ganztaegig)}`,
    `SUMMARY:${escapeIcsText(termin.titel)}`,
    `ORGANIZER:mailto:${organizerEmail}`,
  ]
  if (termin.beschreibung) zeilen.push(`DESCRIPTION:${escapeIcsText(termin.beschreibung)}`)
  if (termin.ort) zeilen.push(`LOCATION:${escapeIcsText(termin.ort)}`)
  for (const t of teilnehmer) {
    const cn = t.name ? `;CN=${escapeIcsText(t.name)}` : ''
    zeilen.push(`ATTENDEE${cn};RSVP=TRUE:mailto:${t.email}`)
  }
  zeilen.push('END:VEVENT', 'END:VCALENDAR')
  return zeilen.join('\r\n')
}

function formatZeitraum(start: Date, end: Date, ganztaegig: boolean): string {
  const tag = (d: Date) => d.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
  const zeit = (d: Date) => d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  if (ganztaegig) {
    return toDateKey(start) === toDateKey(end) ? `Ganztägig, ${tag(start)}` : `Ganztägig, ${tag(start)} – ${tag(end)}`
  }
  if (toDateKey(start) === toDateKey(end)) return `${tag(start)}, ${zeit(start)}–${zeit(end)} Uhr`
  return `${tag(start)} ${zeit(start)} Uhr – ${tag(end)} ${zeit(end)} Uhr`
}

// Menschenlesbare Zusammenfassung, was sich zwischen zwei Terminständen
// geändert hat — für die "Aktualisierung"-Mail an weiterhin eingeladene
// Teilnehmer (verschoben/Ort/Titel/Beschreibung).
export function buildAenderungen(alt: TerminFuerBenachrichtigung, neu: TerminFuerBenachrichtigung): string[] {
  const changes: string[] = []
  const altStart = new Date(alt.start_zeit)
  const altEnd = new Date(alt.end_zeit)
  const neuStart = new Date(neu.start_zeit)
  const neuEnd = new Date(neu.end_zeit)

  if (alt.ganztaegig !== neu.ganztaegig || altStart.getTime() !== neuStart.getTime() || altEnd.getTime() !== neuEnd.getTime()) {
    changes.push(`Termin verschoben auf: ${formatZeitraum(neuStart, neuEnd, neu.ganztaegig)}`)
  }
  if ((alt.ort ?? null) !== (neu.ort ?? null)) {
    changes.push(neu.ort ? `Ort geändert zu: ${neu.ort}` : 'Ort entfernt')
  }
  if (alt.titel !== neu.titel) {
    changes.push(`Titel geändert zu: „${neu.titel}"`)
  }
  if ((alt.beschreibung ?? null) !== (neu.beschreibung ?? null)) {
    changes.push('Beschreibung aktualisiert')
  }
  return changes
}

function buildBetreffUndText(
  art: TerminBenachrichtigungsArt,
  termin: TerminFuerBenachrichtigung,
  changes: string[]
): { subject: string; body: string } {
  const zeitraum = formatZeitraum(new Date(termin.start_zeit), new Date(termin.end_zeit), termin.ganztaegig)
  const ortZeile = termin.ort ? `\nOrt: ${termin.ort}` : ''

  if (art === 'absage') {
    return {
      subject: `Termin abgesagt: ${termin.titel}`,
      body: `Der folgende Termin wurde abgesagt:\n\n${termin.titel}\n${zeitraum}${ortZeile}`,
    }
  }
  if (art === 'einladung') {
    const beschreibungZeile = termin.beschreibung ? `\n\n${termin.beschreibung}` : ''
    return {
      subject: `Termin-Einladung: ${termin.titel}`,
      body: `Sie wurden zu folgendem Termin eingeladen:\n\n${termin.titel}\n${zeitraum}${ortZeile}${beschreibungZeile}`,
    }
  }
  const changesText = changes.length ? `\n\nÄnderungen:\n${changes.map((c) => `- ${c}`).join('\n')}` : ''
  return {
    subject: `Termin aktualisiert: ${termin.titel}`,
    body: `Der folgende Termin wurde aktualisiert:\n\n${termin.titel}\n${zeitraum}${ortZeile}${changesText}`,
  }
}

function buildHtml(body: string): string {
  const safeBody = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
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

function organizerAdresse(): string | undefined {
  return process.env.STRATO_MAIL_USER?.trim() || process.env.STRATO_CALDAV_USER?.trim() || undefined
}

// Best effort, wie der bestehende STRATO-CalDAV-Push: schlägt der Versand
// fehl (z.B. Mailversand nicht konfiguriert), bleibt der Termin trotzdem im
// CRM gespeichert — nur die Benachrichtigung fehlt dann.
export async function sendTerminBenachrichtigung(params: {
  termin: TerminFuerBenachrichtigung
  teilnehmer: Teilnehmer[]
  art: TerminBenachrichtigungsArt
  sequence: number
  changes?: string[]
}): Promise<void> {
  const { termin, teilnehmer, art, sequence, changes = [] } = params
  if (teilnehmer.length === 0) return

  const organizerEmail = organizerAdresse()
  if (!organizerEmail) {
    console.warn('[termin-email] Kein Absender konfiguriert (STRATO_MAIL_USER) — Benachrichtigung wird nicht gesendet')
    return
  }

  const ics = buildIcs(termin, art, sequence, organizerEmail, teilnehmer)
  const { subject, body } = buildBetreffUndText(art, termin, changes)
  const to = teilnehmer.map((t) => t.email)
  const method = art === 'absage' ? 'CANCEL' : 'REQUEST'

  if (isStratoMailboxConfigured()) {
    try {
      await sendStratoMail({ to, subject, text: body, html: buildHtml(body), icalEvent: { method, content: ics } })
      return
    } catch (err) {
      console.error('[termin-email] STRATO-Versand fehlgeschlagen:', err instanceof Error ? err.name : 'Unbekannter Fehler')
    }
  }

  if (!process.env.RESEND_API_KEY) {
    console.warn('[termin-email] Kein Mailversand konfiguriert (weder STRATO-Postfach noch RESEND_API_KEY)')
    return
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: RESEND_FROM,
      to,
      subject,
      text: body,
      html: buildHtml(body),
      attachments: [
        {
          filename: 'termin.ics',
          content: Buffer.from(ics),
          contentType: `text/calendar; method=${method}; charset=utf-8`,
        },
      ],
    })
    if (error) console.error('[termin-email] Resend-Fehler:', error)
  } catch (err) {
    console.error('[termin-email] Fehler beim Senden:', err instanceof Error ? err.name : 'Unbekannter Fehler')
  }
}
