// Dialfire API Integration — Callcenter und Lead-Anlage
// Dokumentation: https://www.dialfire.com/api-docs
import type { DialfireContact, DialfireCreateResponse } from '@/types'

const DIALFIRE_API_URL = process.env.DIALFIRE_API_URL ?? 'https://api.dialfire.com'
const DIALFIRE_API_KEY = process.env.DIALFIRE_API_KEY

function getAuthHeaders(): HeadersInit {
  if (!DIALFIRE_API_KEY) {
    throw new Error('DIALFIRE_API_KEY fehlt in den Umgebungsvariablen')
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${DIALFIRE_API_KEY}`,
  }
}

// Lead in Dialfire Kampagne anlegen
export async function createDialfireContact(
  contact: DialfireContact,
  campaignId: string
): Promise<DialfireCreateResponse> {
  try {
    const response = await fetch(`${DIALFIRE_API_URL}/campaigns/${campaignId}/contacts`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        first_name: contact.first_name,
        last_name: contact.last_name,
        phone: contact.phone,
        email: contact.email ?? '',
        company: contact.company ?? '',
        notes: contact.notes ?? '',
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Dialfire API Fehler ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    return { id: data.id }
  } catch (error) {
    console.error('[Dialfire] createContact Fehler:', error)
    throw error
  }
}

// Kontakt-Status in Dialfire abrufen
export async function getDialfireContact(
  campaignId: string,
  contactId: string
): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(
      `${DIALFIRE_API_URL}/campaigns/${campaignId}/contacts/${contactId}`,
      {
        method: 'GET',
        headers: getAuthHeaders(),
      }
    )

    if (response.status === 404) return null

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Dialfire API Fehler ${response.status}: ${errorText}`)
    }

    return await response.json()
  } catch (error) {
    console.error('[Dialfire] getContact Fehler:', error)
    throw error
  }
}

// Kontakt in Dialfire aktualisieren (z.B. Status nach Gespräch)
export async function updateDialfireContact(
  campaignId: string,
  contactId: string,
  updates: Partial<DialfireContact>
): Promise<void> {
  try {
    const response = await fetch(
      `${DIALFIRE_API_URL}/campaigns/${campaignId}/contacts/${contactId}`,
      {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Dialfire Update Fehler ${response.status}: ${errorText}`)
    }
  } catch (error) {
    console.error('[Dialfire] updateContact Fehler:', error)
    throw error
  }
}
