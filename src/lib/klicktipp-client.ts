import { createHmac } from 'node:crypto'

const DEFAULT_KLICKTIPP_API_URL = 'https://api.klicktipp.com'
const DEFAULT_PARTNER_USERNAME = 'bosydadaq-api2'

interface KlickTippConfig {
  apiUrl: string
  partnerUsername: string
  developerKey: string
  customerKey: string
}

export interface KlickTippContactData {
  id: string
  email: string
  first_name?: string | null
  last_name?: string | null
  company_name?: string | null
  city?: string | null
  country?: string | null
  phone_mobile?: string | null
  website?: string | null
  tagIds?: number[]
  tagNames?: string[]
}

export interface KlickTippSyncResult {
  id: string
  tagIds: number[]
}

type JsonRecord = Record<string, unknown>

function getConfig(): KlickTippConfig {
  const developerKey = process.env.KLICKTIPP_DEVELOPER_KEY?.trim()
  const customerKey = process.env.KLICKTIPP_CUSTOMER_KEY?.trim()
  const partnerUsername =
    process.env.KLICKTIPP_PARTNER_USERNAME?.trim() || DEFAULT_PARTNER_USERNAME
  const configuredApiUrl =
    process.env.KLICKTIPP_API_URL?.trim() || DEFAULT_KLICKTIPP_API_URL

  if (!developerKey || !customerKey) {
    throw new Error(
      'KlickTipp-Zugangsdaten fehlen: KLICKTIPP_DEVELOPER_KEY und KLICKTIPP_CUSTOMER_KEY sind erforderlich'
    )
  }

  if (!/^[a-fA-F0-9]+$/.test(developerKey) || developerKey.length % 2 !== 0) {
    throw new Error('KLICKTIPP_DEVELOPER_KEY hat nicht das erwartete Hexadezimalformat')
  }

  let apiUrl: string
  try {
    const parsedUrl = new URL(configuredApiUrl)
    if (parsedUrl.protocol !== 'https:' || parsedUrl.hostname !== 'api.klicktipp.com') {
      throw new Error('Nicht erlaubte KlickTipp-API-URL')
    }
    apiUrl = parsedUrl.origin
  } catch {
    throw new Error('KLICKTIPP_API_URL muss https://api.klicktipp.com sein')
  }

  return { apiUrl, partnerUsername, developerKey, customerKey }
}

/**
 * KlickTipp erwartet für Partnerzugriffe einen HMAC-basierten X-Ci-Header.
 * Das Verfahren entspricht dem offiziellen KlickTipp-Partner-Connector.
 */
function createPartnerCiphertext(developerKey: string, customerKey: string): string {
  const hmac = createHmac('sha256', Buffer.from(developerKey, 'hex'))
    .update(customerKey, 'utf8')
    .digest()

  return Buffer.concat([hmac, Buffer.from(customerKey, 'utf8')]).toString('base64')
}

function getAuthenticationHeaders(config: KlickTippConfig): Record<string, string> {
  return {
    'X-Un': config.partnerUsername,
    'X-Ci': createPartnerCiphertext(config.developerKey, config.customerKey),
  }
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function describeApiError(status: number, body: unknown): string {
  if (status === 401 || status === 403) {
    return 'KlickTipp hat den API-Zugriff abgelehnt. Partner-Benutzer und API-Freigabe prüfen.'
  }

  if (status === 406) {
    return 'KlickTipp hat die Kontaktdaten abgelehnt (HTTP 406). Opt-in-Status und Feldformate prüfen.'
  }

  return `KlickTipp API-Fehler ${status}`
}

async function makeRequest<T>(
  method: 'GET' | 'POST' | 'PUT',
  endpoint: string,
  body?: JsonRecord
): Promise<T> {
  const config = getConfig()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)

  try {
    const response = await fetch(`${config.apiUrl}${endpoint}`, {
      method,
      headers: {
        ...getAuthenticationHeaders(config),
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })

    const responseBody = await readResponseBody(response)
    if (!response.ok) {
      throw new Error(describeApiError(response.status, responseBody))
    }

    return responseBody as T
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('KlickTipp API-Zeitüberschreitung nach 10 Sekunden')
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

function extractSubscriberId(response: unknown): string | null {
  if (typeof response === 'string' || typeof response === 'number') {
    return String(response)
  }

  if (!response || typeof response !== 'object') return null

  const record = response as JsonRecord
  const nestedData = record.data
  const candidates = [
    record.id,
    record.subscriber_id,
    record.subscriberId,
    nestedData && typeof nestedData === 'object'
      ? (nestedData as JsonRecord).id
      : undefined,
  ]

  const id = candidates.find(
    (candidate) => typeof candidate === 'string' || typeof candidate === 'number'
  )
  return id == null ? null : String(id)
}

function buildContactFields(contact: KlickTippContactData): JsonRecord {
  const fields: JsonRecord = {}

  if (contact.first_name) fields.fieldFirstName = contact.first_name
  if (contact.last_name) fields.fieldLastName = contact.last_name
  if (contact.company_name) fields.fieldCompanyName = contact.company_name
  if (contact.city) fields.fieldCity = contact.city
  if (contact.country) fields.fieldCountry = contact.country
  if (contact.phone_mobile) fields.fieldMobilePhone = contact.phone_mobile
  if (contact.website) fields.fieldWebsite = contact.website

  return fields
}

/**
 * Legt einen Kontakt anhand seiner E-Mail-Adresse an oder aktualisiert ihn.
 * Die Operation ist damit bei Wiederholungen duplikatsicher.
 */
export async function addOrUpdateKlickTippContact(
  contact: KlickTippContactData
): Promise<string> {
  const email = contact.email.trim().toLowerCase()
  if (!email) throw new Error('Für die KlickTipp-Übertragung ist eine E-Mail-Adresse erforderlich')

  const response = await makeRequest<unknown>('POST', '/subscriber.json', {
    email,
    fields: buildContactFields(contact),
  })

  const subscriberId = extractSubscriberId(response)
  if (!subscriberId) {
    throw new Error('KlickTipp hat keine Kontakt-ID zurückgegeben')
  }

  return subscriberId
}

/** Setzt alle von Sentimental Logic ermittelten Tags in einem API-Aufruf. */
export async function tagKlickTippContact(email: string, tagIds: number[]): Promise<void> {
  const uniqueTagIds = Array.from(
    new Set(tagIds.filter((tagId) => Number.isInteger(tagId) && tagId > 0))
  )
  if (uniqueTagIds.length === 0) return

  await makeRequest<unknown>('POST', '/subscriber/tag.json', {
    email: email.trim().toLowerCase(),
    tagids: uniqueTagIds,
  })
}

function normalizeTagMap(response: unknown): Map<string, number> {
  const tagsByName = new Map<string, number>()

  const addTag = (id: unknown, name: unknown) => {
    const numericId = Number(id)
    if (Number.isInteger(numericId) && numericId > 0 && typeof name === 'string') {
      tagsByName.set(name.trim().toLowerCase(), numericId)
    }
  }

  const parseCollection = (collection: unknown) => {
    if (Array.isArray(collection)) {
      for (const tag of collection) {
        if (tag && typeof tag === 'object') {
          const record = tag as JsonRecord
          addTag(record.id ?? record.tag_id, record.name ?? record.label ?? record.tag_name)
        }
      }
      return
    }

    if (collection && typeof collection === 'object') {
      for (const [id, value] of Object.entries(collection as JsonRecord)) {
        if (typeof value === 'string') addTag(id, value)
        else if (value && typeof value === 'object') {
          const record = value as JsonRecord
          addTag(record.id ?? record.tag_id ?? id, record.name ?? record.label ?? record.tag_name)
        }
      }
    }
  }

  if (response && typeof response === 'object' && !Array.isArray(response)) {
    const record = response as JsonRecord
    parseCollection(record.tags ?? record.data ?? response)
  } else {
    parseCollection(response)
  }

  return tagsByName
}

async function resolveTagIds(tagNames: string[]): Promise<number[]> {
  if (tagNames.length === 0) return []

  const response = await makeRequest<unknown>('GET', '/tag.json')
  const tagMap = normalizeTagMap(response)

  return tagNames
    .map((tagName) => tagMap.get(tagName.trim().toLowerCase()))
    .filter((tagId): tagId is number => tagId != null)
}

/** Überträgt die Stammdaten und anschließend die gewünschten KlickTipp-Tags. */
export async function syncContactToKlickTipp(
  contact: KlickTippContactData
): Promise<KlickTippSyncResult> {
  const subscriberId = await addOrUpdateKlickTippContact(contact)
  const resolvedTagIds = await resolveTagIds(contact.tagNames ?? [])
  const tagIds = Array.from(new Set([...(contact.tagIds ?? []), ...resolvedTagIds]))
  await tagKlickTippContact(contact.email, tagIds)

  return { id: subscriberId, tagIds }
}

/** Read-only-Verbindungstest ohne Übertragung von Kontaktdaten. */
export async function testKlickTippConnection(): Promise<void> {
  await makeRequest<unknown>('GET', '/tag.json')
}
