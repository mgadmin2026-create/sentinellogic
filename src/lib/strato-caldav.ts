// CalDAV-Client für die STRATO-Synchronisation (Open-Xchange Webmail).
// Beidseitig: fetchStratoEvents() liest, pushStratoEvent()/deleteStratoEvent()
// schreiben. Zugangsdaten ausschließlich über Umgebungsvariablen — nie im
// Code oder in der Datenbank.
import ical from 'node-ical'
import type { VEvent } from 'node-ical'
import { XMLParser } from 'fast-xml-parser'
import { toDateKey } from '@/lib/kalender-helpers'

export interface StratoTeilnehmer {
  email: string
  name?: string
}

export interface StratoEvent {
  uid: string
  href: string
  etag: string
  titel: string
  beschreibung?: string
  ort?: string
  start: Date
  end: Date
  ganztaegig: boolean
  teilnehmer: StratoTeilnehmer[]
}

export interface StratoConfig {
  url: string
  user: string
  password: string
}

export function getStratoConfig(): StratoConfig | null {
  const url = process.env.STRATO_CALDAV_URL
  const user = process.env.STRATO_CALDAV_USER
  const password = process.env.STRATO_CALDAV_PASSWORD
  if (!url || !user || !password) return null
  return { url: url.replace(/\/$/, ''), user, password }
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function authHeader(cfg: StratoConfig): string {
  return 'Basic ' + Buffer.from(`${cfg.user}:${cfg.password}`).toString('base64')
}

// Holt alle VEVENTs im Kalender per CalDAV REPORT (calendar-query).
export async function fetchStratoEvents(cfg: StratoConfig): Promise<StratoEvent[]> {
  const body = `<?xml version="1.0" encoding="utf-8" ?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:getetag/>
    <C:calendar-data/>
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT"/>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>`

  const res = await fetch(cfg.url, {
    method: 'REPORT',
    headers: {
      Authorization: authHeader(cfg),
      'Content-Type': 'application/xml; charset=utf-8',
      Depth: '1',
    },
    body,
  })

  if (!res.ok) {
    throw new Error(`STRATO CalDAV REPORT fehlgeschlagen: ${res.status} ${res.statusText}`)
  }

  const xml = await res.text()
  const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true })
  const parsed = parser.parse(xml)

  const responses = normalizeArray(parsed?.multistatus?.response)
  const ereignisse: StratoEvent[] = []

  const serverOrigin = new URL(cfg.url).origin

  for (const r of responses) {
    // STRATO liefert relative Pfade (z.B. "/caldav/…") statt vollständiger
    // URLs. Node.js' fetch() kennt anders als ein Browser keine implizite
    // Basis-URL — ohne Normalisierung würde ein späterer PUT/DELETE mit
    // diesem href fehlschlagen.
    const rohHref: string | undefined = r?.href
    const href = rohHref
      ? (rohHref.startsWith('http') ? rohHref : `${serverOrigin}${rohHref.startsWith('/') ? '' : '/'}${rohHref}`)
      : undefined
    const propstat = normalizeArray(r?.propstat)[0]
    const etag: string | undefined = propstat?.prop?.getetag
    const calendarData: string | undefined = propstat?.prop?.['calendar-data']
    if (!href || !calendarData) continue

    try {
      const geparst = ical.parseICS(calendarData)
      for (const key of Object.keys(geparst)) {
        const roh = geparst[key]
        if (!roh || roh.type !== 'VEVENT') continue
        const eintrag = roh as VEvent
        const ganztaegig = eintrag.datetype === 'date'
        ereignisse.push({
          uid: String(eintrag.uid),
          href,
          etag: String(etag ?? ''),
          titel: eintrag.summary ? String(eintrag.summary) : '(ohne Titel)',
          beschreibung: eintrag.description ? String(eintrag.description) : undefined,
          ort: eintrag.location ? String(eintrag.location) : undefined,
          start: new Date(eintrag.start),
          end: new Date(eintrag.end ?? eintrag.start),
          ganztaegig,
          teilnehmer: parseAttendees(eintrag.attendee),
        })
      }
    } catch (err) {
      console.error('[strato-caldav] ICS konnte nicht geparst werden:', err)
    }
  }

  return ereignisse
}

function normalizeArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return []
  return Array.isArray(value) ? value : [value]
}

// ATTENDEE-Werte von node-ical sind entweder ein roher String
// ("mailto:foo@bar.de") oder ein Objekt { val, params: { CN } } mit Anzeigename.
function parseAttendees(attendee: VEvent['attendee']): StratoTeilnehmer[] {
  if (!attendee) return []
  const liste = Array.isArray(attendee) ? attendee : [attendee]
  const ergebnis: StratoTeilnehmer[] = []
  for (const eintrag of liste) {
    const wert = typeof eintrag === 'string' ? eintrag : eintrag?.val
    const name = typeof eintrag === 'string' ? undefined : eintrag?.params?.CN
    if (!wert) continue
    const email = wert.replace(/^mailto:/i, '').trim()
    if (!email) continue
    ergebnis.push({ email, name: name || undefined })
  }
  return ergebnis
}

function toIcsDate(d: Date, ganztaegig: boolean): string {
  if (ganztaegig) {
    // Lokales Kalenderdatum, nicht UTC — sonst verschiebt sich ein
    // ganztägiger Termin je nach Zeitzone/Uhrzeit um einen Tag.
    return toDateKey(d).replace(/-/g, '')
  }
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

function escapeIcsText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function buildIcs(termin: {
  uid: string
  titel: string
  beschreibung?: string | null
  ort?: string | null
  start: Date
  end: Date
  ganztaegig: boolean
  teilnehmer?: StratoTeilnehmer[]
  organizerEmail?: string
}): string {
  const dtType = termin.ganztaegig ? ';VALUE=DATE' : ''
  const zeilen = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Sentimental Logic//Kalender//DE',
    'BEGIN:VEVENT',
    `UID:${termin.uid}`,
    `DTSTAMP:${toIcsDate(new Date(), false)}`,
    `DTSTART${dtType}:${toIcsDate(termin.start, termin.ganztaegig)}`,
    `DTEND${dtType}:${toIcsDate(termin.end, termin.ganztaegig)}`,
    `SUMMARY:${escapeIcsText(termin.titel)}`,
  ]
  if (termin.beschreibung) zeilen.push(`DESCRIPTION:${escapeIcsText(termin.beschreibung)}`)
  if (termin.ort) zeilen.push(`LOCATION:${escapeIcsText(termin.ort)}`)
  // ORGANIZER nur, wenn Teilnehmer eingeladen sind — ohne ATTENDEE-Zeilen
  // erwartet kein CalDAV-Server einen Organizer, und ohne ihn zeigt STRATO
  // eingeladene Teilnehmer trotzdem korrekt an.
  if (termin.teilnehmer?.length && termin.organizerEmail) {
    zeilen.push(`ORGANIZER:mailto:${termin.organizerEmail}`)
  }
  for (const t of termin.teilnehmer ?? []) {
    const cn = t.name ? `;CN=${escapeIcsText(t.name)}` : ''
    zeilen.push(`ATTENDEE${cn};RSVP=TRUE:mailto:${t.email}`)
  }
  zeilen.push('END:VEVENT', 'END:VCALENDAR')
  return zeilen.join('\r\n')
}

// Legt einen Termin auf STRATO neu an oder aktualisiert ihn (falls href
// bekannt). Gibt die neue href + ETag zurück, damit sie lokal gespeichert
// werden — nur so erkennt der nächste Pull denselben Termin wieder, statt
// ihn zu duplizieren.
export async function pushStratoEvent(
  cfg: StratoConfig,
  termin: {
    uid?: string | null
    href?: string | null
    titel: string
    beschreibung?: string | null
    ort?: string | null
    start: Date
    end: Date
    ganztaegig: boolean
    teilnehmer?: StratoTeilnehmer[]
  }
): Promise<{ uid: string; href: string; etag: string }> {
  const uid = termin.uid || `${crypto.randomUUID()}@sentinellogic`
  const href = termin.href || `${cfg.url}/${uid}.ics`
  const organizerEmail = EMAIL_REGEX.test(cfg.user) ? cfg.user : undefined
  const ics = buildIcs({ ...termin, uid, organizerEmail })

  const res = await fetch(href, {
    method: 'PUT',
    headers: {
      Authorization: authHeader(cfg),
      'Content-Type': 'text/calendar; charset=utf-8',
    },
    body: ics,
  })

  if (!res.ok) {
    throw new Error(`STRATO CalDAV PUT fehlgeschlagen: ${res.status} ${res.statusText}`)
  }

  const etag = res.headers.get('ETag') ?? ''
  return { uid, href, etag }
}

export async function deleteStratoEvent(cfg: StratoConfig, href: string): Promise<void> {
  const res = await fetch(href, {
    method: 'DELETE',
    headers: { Authorization: authHeader(cfg) },
  })
  // 404 = auf STRATO-Seite bereits weg — kein Fehler, Ziel ist ohnehin erreicht.
  if (!res.ok && res.status !== 404) {
    throw new Error(`STRATO CalDAV DELETE fehlgeschlagen: ${res.status} ${res.statusText}`)
  }
}
