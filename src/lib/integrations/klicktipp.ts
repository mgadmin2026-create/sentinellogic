// Klicktipp API Integration — E-Mail-Marketing und Tag-Synchronisation
// Dokumentation: https://www.klicktipp.com/en/support/api/
import type { KlicktippContact, KlicktippSubscribeResponse } from '@/types'

const KLICKTIPP_API_URL = process.env.KLICKTIPP_API_URL ?? 'https://api.klicktipp.com'
const KLICKTIPP_API_KEY = process.env.KLICKTIPP_API_KEY

function getAuthHeaders(): HeadersInit {
  if (!KLICKTIPP_API_KEY) {
    throw new Error('KLICKTIPP_API_KEY fehlt in den Umgebungsvariablen')
  }
  return {
    'Content-Type': 'application/json',
    'X-API-Key': KLICKTIPP_API_KEY,
  }
}

// Kontakt in Klicktipp anlegen oder aktualisieren
export async function subscribeContact(
  contact: KlicktippContact,
  listId: string
): Promise<KlicktippSubscribeResponse> {
  try {
    const response = await fetch(`${KLICKTIPP_API_URL}/subscriber`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        email: contact.email,
        fields: {
          fieldFirstName: contact.first_name ?? '',
          fieldLastName: contact.last_name ?? '',
          fieldPhone: contact.phone ?? '',
          ...contact.fields,
        },
        listid: listId,
        tagids: contact.tags ?? [],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Klicktipp API Fehler ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    return { id: data.id }
  } catch (error) {
    console.error('[Klicktipp] subscribeContact Fehler:', error)
    throw error
  }
}

// Tag zu einem Kontakt hinzufügen
export async function addTagToContact(
  email: string,
  tagId: string
): Promise<void> {
  try {
    const response = await fetch(`${KLICKTIPP_API_URL}/subscriber/tag`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ email, tagid: tagId }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Klicktipp Tag-Fehler ${response.status}: ${errorText}`)
    }
  } catch (error) {
    console.error('[Klicktipp] addTagToContact Fehler:', error)
    throw error
  }
}

// Kontakt anhand E-Mail-Adresse abrufen
export async function getContactByEmail(email: string): Promise<Record<string, unknown> | null> {
  try {
    const encodedEmail = encodeURIComponent(email)
    const response = await fetch(`${KLICKTIPP_API_URL}/subscriber/${encodedEmail}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    })

    if (response.status === 404) return null

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Klicktipp API Fehler ${response.status}: ${errorText}`)
    }

    return await response.json()
  } catch (error) {
    console.error('[Klicktipp] getContactByEmail Fehler:', error)
    throw error
  }
}
