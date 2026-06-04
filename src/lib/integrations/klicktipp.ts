// KlickTipp API Integration — Session-basierte Authentifizierung
// KlickTipp REST API nutzt Login → Session-ID → alle weiteren Calls
// Dokumentation: https://www.klicktipp.com/de/support/api/

const KLICKTIPP_API_URL = (process.env.KLICKTIPP_API_URL ?? 'https://api.klicktipp.com').replace(/\/$/, '')

// ── Session-Management ───────────────────────────────────────

interface KlicktippSession {
  name: string    // Cookie-Name der Session
  id: string      // Session-ID
  expires: number // Unix-Timestamp Ablauf (30 Min)
}

// In-Memory Cache für Session (pro Server-Instanz)
let cachedSession: KlicktippSession | null = null

async function getSession(): Promise<KlicktippSession> {
  // Gecachte Session nutzen wenn noch gültig (mit 5 Min Puffer)
  if (cachedSession && Date.now() < cachedSession.expires - 5 * 60 * 1000) {
    return cachedSession
  }

  const username = process.env.KLICKTIPP_USERNAME
  const password = process.env.KLICKTIPP_PASSWORD

  if (!username || !password) {
    throw new Error(
      'KLICKTIPP_USERNAME und KLICKTIPP_PASSWORD fehlen in .env.local — ' +
      'KlickTipp REST API benötigt Login-Zugangsdaten (nicht den API-Key)'
    )
  }

  const response = await fetch(`${KLICKTIPP_API_URL}/account/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`KlickTipp Login fehlgeschlagen (${response.status}): ${err}`)
  }

  const data = await response.json()
  // Antwort: { session_name: "...", sessid: "..." }
  // oder Array: ["session_name", "session_id"]
  let sessionName: string
  let sessionId: string

  if (Array.isArray(data)) {
    [sessionName, sessionId] = data
  } else {
    sessionName = data.session_name ?? data.sessid_name ?? 'PHPSESSID'
    sessionId = data.sessid ?? data.session_id ?? data.id
  }

  if (!sessionId) throw new Error('KlickTipp Login: Keine Session-ID in der Antwort')

  cachedSession = {
    name: sessionName,
    id: sessionId,
    expires: Date.now() + 30 * 60 * 1000, // 30 Min TTL
  }

  return cachedSession
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const session = await getSession()
  return {
    'Content-Type': 'application/json',
    'Cookie': `${session.name}=${session.id}`,
  }
}

// Session bei Fehler invalidieren
function invalidateSession() {
  cachedSession = null
}

// Hilfsfunktion: Request mit auto-retry bei Session-Ablauf
async function apiRequest(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<unknown> {
  const headers = await getAuthHeaders()
  const response = await fetch(`${KLICKTIPP_API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (response.status === 403) {
    // Session abgelaufen → neu einloggen und einmal wiederholen
    invalidateSession()
    const freshHeaders = await getAuthHeaders()
    const retry = await fetch(`${KLICKTIPP_API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: freshHeaders,
      body: options.body ? JSON.stringify(options.body) : undefined,
    })
    if (!retry.ok) {
      const err = await retry.text()
      throw new Error(`${options.method ?? 'GET'} ${path} fehlgeschlagen (${retry.status}): ${err}`)
    }
    return retry.json()
  }

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`${options.method ?? 'GET'} ${path} fehlgeschlagen (${response.status}): ${err}`)
  }

  return response.json()
}

// ── Typen ────────────────────────────────────────────────────

export interface KlicktippTag {
  id: string
  name: string
}

export interface KlicktippSyncResult {
  success: boolean
  subscriberId?: string
  tagId?: string
  message: string
}

export interface LeadSyncData {
  email: string
  first_name?: string | null
  last_name?: string | null
  phone_mobile?: string | null
}

// ── Tags ─────────────────────────────────────────────────────

export async function getAllTags(): Promise<KlicktippTag[]> {
  const data = await apiRequest('/tag')
  if (Array.isArray(data)) return data as KlicktippTag[]
  // Objekt-Format: { "123": "fb-lead", ... }
  return Object.entries(data as Record<string, string>).map(([id, name]) => ({ id, name }))
}

export async function getOrCreateTagByName(name: string): Promise<string> {
  const tags = await getAllTags()
  const existing = tags.find((t) => t.name.toLowerCase() === name.toLowerCase())
  if (existing) return existing.id

  const created = await apiRequest('/tag', {
    method: 'POST',
    body: { name },
  })
  const tagId = Array.isArray(created) ? created[0] : (created as Record<string, unknown>).id ?? created
  return String(tagId)
}

// ── Subscriber ───────────────────────────────────────────────

export async function getSubscriberByEmail(email: string): Promise<Record<string, unknown> | null> {
  try {
    const encoded = encodeURIComponent(email)
    const data = await apiRequest(`/subscriber/${encoded}`)
    return data as Record<string, unknown>
  } catch (err) {
    if (String(err).includes('404')) return null
    return null
  }
}

export async function addTagToSubscriber(email: string, tagId: string): Promise<void> {
  await apiRequest('/subscriber/tag', {
    method: 'POST',
    body: { email, tagid: tagId },
  })
}

export async function createSubscriber(
  lead: LeadSyncData,
  tagIds: string[],
  listId?: string
): Promise<string> {
  const body: Record<string, unknown> = {
    email: lead.email,
    fields: {
      fieldFirstName: lead.first_name ?? '',
      fieldLastName: lead.last_name ?? '',
      fieldPhone: lead.phone_mobile ?? '',
    },
    tagids: tagIds,
  }
  if (listId) body.listid = listId

  const data = await apiRequest('/subscriber', { method: 'POST', body })
  const id = Array.isArray(data) ? data[0] : (data as Record<string, unknown>).id ?? data
  return String(id)
}

// ── Haupt-Funktion ────────────────────────────────────────────

export async function syncLeadToKlicktipp(
  lead: LeadSyncData,
  tagName: string,
  listId?: string
): Promise<KlicktippSyncResult> {
  if (!process.env.KLICKTIPP_USERNAME || !process.env.KLICKTIPP_PASSWORD) {
    return {
      success: false,
      message: 'KLICKTIPP_USERNAME / KLICKTIPP_PASSWORD nicht in .env.local konfiguriert',
    }
  }

  try {
    // 1. Tag-ID finden oder anlegen
    let tagId: string
    try {
      tagId = await getOrCreateTagByName(tagName)
    } catch (tagError) {
      const errMsg = tagError instanceof Error ? tagError.message : String(tagError)
      // Klare Fehlermeldung bei 403 (API-Zugang nicht freigeschaltet)
      if (errMsg.includes('403') || errMsg.includes('access denied')) {
        return {
          success: false,
          message: `KlickTipp REST API nicht erreichbar (403). Bitte REST API-Zugang in KlickTipp aktivieren oder Support kontaktieren (Account #92061776).`,
        }
      }
      return {
        success: false,
        message: `Tag "${tagName}" Fehler: ${errMsg}`,
      }
    }

    // 2. Subscriber anlegen oder Tag hinzufügen
    const existing = await getSubscriberByEmail(lead.email)

    let subscriberId: string
    if (existing) {
      const existingId = existing.id ?? existing.subscriberid
      subscriberId = String(existingId ?? lead.email)
      await addTagToSubscriber(lead.email, tagId)
    } else {
      subscriberId = await createSubscriber(lead, [tagId], listId)
    }

    return {
      success: true,
      subscriberId,
      tagId,
      message: existing
        ? `Bestehender Kontakt, Tag "${tagName}" hinzugefügt`
        : `Kontakt angelegt, Tag "${tagName}" gesetzt`,
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
    }
  }
}

// ── Legacy-Funktionen (Rückwärtskompatibilität) ───────────────

export async function subscribeContact(
  contact: { email: string; first_name?: string; last_name?: string; phone?: string; tags?: string[] },
  listId: string
): Promise<{ id?: string; error?: string }> {
  try {
    const id = await createSubscriber(
      { email: contact.email, first_name: contact.first_name, last_name: contact.last_name, phone_mobile: contact.phone },
      contact.tags ?? [],
      listId
    )
    return { id }
  } catch (error) {
    return { error: String(error) }
  }
}

export async function addTagToContact(email: string, tagId: string): Promise<void> {
  return addTagToSubscriber(email, tagId)
}

export async function getContactByEmail(email: string): Promise<Record<string, unknown> | null> {
  return getSubscriberByEmail(email)
}
