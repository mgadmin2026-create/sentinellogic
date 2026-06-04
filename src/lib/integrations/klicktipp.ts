// KlickTipp API Integration — E-Mail-Marketing und Tag-Synchronisation
// Auth: X-API-Key Header (moderner API-Key aus KlickTipp → Einstellungen → API)
// Dokumentation: https://www.klicktipp.com/de/support/api/

const KLICKTIPP_API_URL = (process.env.KLICKTIPP_API_URL ?? 'https://api.klicktipp.com').replace(/\/$/, '')

function getApiKey(): string | null {
  return process.env.KLICKTIPP_API_KEY || null
}

function getAuthHeaders(): HeadersInit {
  const key = getApiKey()
  if (!key) throw new Error('KLICKTIPP_API_KEY fehlt in den Umgebungsvariablen')
  return {
    'Content-Type': 'application/json',
    'X-API-Key': key,
  }
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

// Alle Tags aus KlickTipp laden → [{id, name}]
export async function getAllTags(): Promise<KlicktippTag[]> {
  try {
    const response = await fetch(`${KLICKTIPP_API_URL}/tag`, {
      method: 'GET',
      headers: getAuthHeaders(),
    })
    if (!response.ok) {
      const err = await response.text()
      throw new Error(`GET /tag fehlgeschlagen (${response.status}): ${err}`)
    }
    const data = await response.json()
    // KlickTipp gibt ein Objekt zurück: {tagId: tagName, ...} oder Array je nach Version
    if (Array.isArray(data)) return data
    // Objekt-Format: { "123": "fb-lead", ... }
    return Object.entries(data as Record<string, string>).map(([id, name]) => ({ id, name }))
  } catch (error) {
    console.error('[KlickTipp] getAllTags Fehler:', error)
    throw error
  }
}

// Tag per Name suchen — wenn nicht vorhanden, neu anlegen → Tag-ID
export async function getOrCreateTagByName(name: string): Promise<string> {
  // Vorhandene Tags laden und Namen vergleichen
  const tags = await getAllTags()
  const existing = tags.find((t) => t.name.toLowerCase() === name.toLowerCase())
  if (existing) return existing.id

  // Nicht gefunden → Tag anlegen
  const response = await fetch(`${KLICKTIPP_API_URL}/tag`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ name }),
  })
  if (!response.ok) {
    const err = await response.text()
    throw new Error(`POST /tag fehlgeschlagen (${response.status}): ${err}`)
  }
  const created = await response.json()
  // Antwort kann Array-Eintrag [tagId] oder Objekt {id} sein
  const tagId = Array.isArray(created) ? created[0] : (created.id ?? created)
  return String(tagId)
}

// ── Subscriber ───────────────────────────────────────────────

// Prüfen ob Subscriber bereits in KlickTipp existiert
export async function getSubscriberByEmail(email: string): Promise<Record<string, unknown> | null> {
  try {
    const encoded = encodeURIComponent(email)
    const response = await fetch(`${KLICKTIPP_API_URL}/subscriber/${encoded}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    })
    if (response.status === 404) return null
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

// Tag zu bestehendem Subscriber hinzufügen
export async function addTagToSubscriber(email: string, tagId: string): Promise<void> {
  const response = await fetch(`${KLICKTIPP_API_URL}/subscriber/tag`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ email, tagid: tagId }),
  })
  if (!response.ok) {
    const err = await response.text()
    throw new Error(`POST /subscriber/tag fehlgeschlagen (${response.status}): ${err}`)
  }
}

// Neuen Subscriber anlegen mit Tag und optionalem Verteiler
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

  const response = await fetch(`${KLICKTIPP_API_URL}/subscriber`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const err = await response.text()
    throw new Error(`POST /subscriber fehlgeschlagen (${response.status}): ${err}`)
  }
  const data = await response.json()
  // Antwort: [subscriberId] (Array) oder {id: subscriberId}
  const id = Array.isArray(data) ? data[0] : (data.id ?? data)
  return String(id)
}

// ── Haupt-Funktion für Rule-Execution ────────────────────────

/**
 * Lead in KlickTipp anlegen/aktualisieren und Tag setzen.
 * Wird von executeRules aufgerufen wenn eine Regel klicktipp_tag enthält.
 *
 * Ablauf:
 * 1. API-Key prüfen
 * 2. Tag-ID per getOrCreateTagByName holen
 * 3. Subscriber prüfen: neu anlegen ODER nur Tag hinzufügen
 * 4. Subscriber-ID zurückgeben
 */
export async function syncLeadToKlicktipp(
  lead: LeadSyncData,
  tagName: string,
  listId?: string
): Promise<KlicktippSyncResult> {
  // API-Key-Check
  if (!getApiKey()) {
    return { success: false, message: 'KLICKTIPP_API_KEY nicht konfiguriert' }
  }

  try {
    // 1. Tag-ID finden oder anlegen
    let tagId: string
    try {
      tagId = await getOrCreateTagByName(tagName)
    } catch (tagError) {
      console.error('[KlickTipp] Tag-Fehler:', tagError)
      return {
        success: false,
        message: `Tag "${tagName}" konnte nicht gefunden/angelegt werden: ${tagError instanceof Error ? tagError.message : 'Unbekannt'}`,
      }
    }

    // 2. Subscriber bereits vorhanden?
    const existing = await getSubscriberByEmail(lead.email)

    let subscriberId: string

    if (existing) {
      // Subscriber existiert → nur Tag hinzufügen
      const existingId = existing.id ?? existing.subscriberid ?? existing.subscriber_id
      subscriberId = String(existingId ?? lead.email)
      await addTagToSubscriber(lead.email, tagId)
    } else {
      // Neuen Subscriber anlegen
      subscriberId = await createSubscriber(lead, [tagId], listId)
    }

    return {
      success: true,
      subscriberId,
      tagId,
      message: existing
        ? `Bestehender Kontakt gefunden, Tag "${tagName}" hinzugefügt`
        : `Kontakt angelegt, Tag "${tagName}" gesetzt`,
    }
  } catch (error) {
    console.error('[KlickTipp] syncLeadToKlicktipp Fehler:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unbekannter Fehler',
    }
  }
}

// ── Legacy-Funktionen (Rückwärtskompatibilität) ───────────────

export interface KlicktippContact {
  email: string
  first_name?: string
  last_name?: string
  phone?: string
  tags?: string[]
  fields?: Record<string, string>
}

export async function subscribeContact(
  contact: KlicktippContact,
  listId: string
): Promise<{ id?: string; error?: string }> {
  try {
    const id = await createSubscriber(
      {
        email: contact.email,
        first_name: contact.first_name,
        last_name: contact.last_name,
        phone_mobile: contact.phone,
      },
      contact.tags ?? [],
      listId
    )
    return { id }
  } catch (error) {
    console.error('[KlickTipp] subscribeContact Fehler:', error)
    return { error: String(error) }
  }
}

export async function addTagToContact(email: string, tagId: string): Promise<void> {
  return addTagToSubscriber(email, tagId)
}

export async function getContactByEmail(email: string): Promise<Record<string, unknown> | null> {
  return getSubscriberByEmail(email)
}
