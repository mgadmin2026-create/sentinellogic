import { createHmac } from 'node:crypto'
import { normalizeKlickTippEmailStatus, type KlickTippEmailStatus } from '@/lib/klicktipp-webhook'

const DEFAULT_KLICKTIPP_API_URL = 'https://api.klicktipp.com'
const DEFAULT_PARTNER_USERNAME = 'bosydadaq-api2'

interface KlickTippConfig {
  apiUrl: string
  auth:
    | { mode: 'session'; username: string; password: string }
    | { mode: 'partner'; partnerUsername: string; developerKey: string; customerKey: string }
}

export interface KlickTippContactData {
  id: string
  email: string
  first_name?: string | null
  last_name?: string | null
  company_name?: string | null
  street?: string | null
  postal_code?: string | null
  city?: string | null
  country?: string | null
  phone_mobile?: string | null
  website?: string | null
  geburtstag?: string | null
  geschlecht?: string | null
  tagIds?: number[]
  tagNames?: string[]
}

export interface KlickTippSyncResult {
  id: string
  tagIds: number[]
}

export interface KlickTippContactStatusResult {
  status: KlickTippEmailStatus
}

type JsonRecord = Record<string, unknown>

interface KlickTippSession {
  headers: Record<string, string>
  expiresAt: number
}

let cachedSession: KlickTippSession | null = null
let sessionLoginPromise: Promise<Record<string, string>> | null = null
let cachedGenderField: { key: string | null; expiresAt: number } | null = null

function getConfig(): KlickTippConfig {
  const apiUsername = process.env.KLICKTIPP_API_USERNAME?.trim()
  const apiPassword = process.env.KLICKTIPP_API_PASSWORD?.trim()
  const developerKey = process.env.KLICKTIPP_DEVELOPER_KEY?.trim()
  const customerKey = process.env.KLICKTIPP_CUSTOMER_KEY?.trim()
  const partnerUsername =
    process.env.KLICKTIPP_PARTNER_USERNAME?.trim() || DEFAULT_PARTNER_USERNAME
  const configuredApiUrl =
    process.env.KLICKTIPP_API_URL?.trim() || DEFAULT_KLICKTIPP_API_URL

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

  // Der dedizierte API User ist für die interne Einzelkonto-Integration der
  // direkteste Weg. Partner-Schlüssel bleiben als kompatibler Fallback erhalten.
  if (apiUsername && apiPassword) {
    return { apiUrl, auth: { mode: 'session', username: apiUsername, password: apiPassword } }
  }

  if (!developerKey || !customerKey) {
    throw new Error(
      'KlickTipp-Zugangsdaten fehlen: API-User/Passwort oder Developer-/Customer-Key sind erforderlich'
    )
  }

  if (!/^[a-fA-F0-9]+$/.test(developerKey) || developerKey.length % 2 !== 0) {
    throw new Error('KLICKTIPP_DEVELOPER_KEY hat nicht das erwartete Hexadezimalformat')
  }

  return {
    apiUrl,
    auth: { mode: 'partner', partnerUsername, developerKey, customerKey },
  }
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

function getPartnerAuthenticationHeaders(
  config: Extract<KlickTippConfig['auth'], { mode: 'partner' }>
): Record<string, string> {
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
    return `KlickTipp hat den API-Zugriff abgelehnt (HTTP ${status}). API-Benutzer, Rolle und Zugangsdaten prüfen.`
  }

  if (status === 406) {
    return 'KlickTipp hat die Kontaktdaten abgelehnt (HTTP 406). Opt-in-Status und Feldformate prüfen.'
  }

  return `KlickTipp API-Fehler ${status}`
}

function extractSessionAuthentication(
  response: unknown,
  setCookie: string | null
): Record<string, string> | null {
  if (!response || typeof response !== 'object') return null

  const record = response as JsonRecord
  const data = record.data && typeof record.data === 'object'
    ? record.data as JsonRecord
    : null
  const candidate = record.session_id ?? record.sessid ?? data?.session_id ?? data?.sessid
  if (typeof candidate !== 'string' || !candidate.trim()) return null

  const sessionId = candidate.trim()
  const headers: Record<string, string> = { 'X-Session-Id': sessionId }
  const sessionNameCandidate = record.session_name ?? data?.session_name
  const sessionName = typeof sessionNameCandidate === 'string'
    ? sessionNameCandidate.trim()
    : ''

  // Ältere Management-API-Versionen erwarten zusätzlich das Sitzungscookie.
  if (/^[A-Za-z0-9_-]+$/.test(sessionName) && !/[\r\n;]/.test(sessionId)) {
    headers.Cookie = `${sessionName}=${sessionId}`
  } else if (setCookie) {
    const cookie = setCookie.split(';', 1)[0]?.trim()
    if (cookie && !/[\r\n]/.test(cookie)) headers.Cookie = cookie
  }

  return headers
}

async function loginWithApiUser(
  config: KlickTippConfig,
  auth: Extract<KlickTippConfig['auth'], { mode: 'session' }>
): Promise<Record<string, string>> {
  if (cachedSession && cachedSession.expiresAt > Date.now()) return cachedSession.headers
  if (sessionLoginPromise) return sessionLoginPromise

  sessionLoginPromise = (async () => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)

    try {
      const response = await fetch(`${config.apiUrl}/account/login`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: auth.username, password: auth.password }),
        signal: controller.signal,
      })
      const responseBody = await readResponseBody(response)
      if (!response.ok) throw new Error(describeApiError(response.status, responseBody))

      const sessionHeaders = extractSessionAuthentication(
        responseBody,
        response.headers.get('set-cookie')
      )
      if (!sessionHeaders) throw new Error('KlickTipp hat keine Sitzungs-ID zurückgegeben')

      // Kurzer Cache vermeidet mehrere Logins innerhalb eines Sync-Ablaufs.
      cachedSession = { headers: sessionHeaders, expiresAt: Date.now() + 5 * 60_000 }
      return sessionHeaders
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('KlickTipp-Login hat nach 10 Sekunden nicht geantwortet')
      }
      throw error
    } finally {
      clearTimeout(timeout)
      sessionLoginPromise = null
    }
  })()

  return sessionLoginPromise
}

async function getAuthenticationHeaders(config: KlickTippConfig): Promise<Record<string, string>> {
  if (config.auth.mode === 'partner') {
    return getPartnerAuthenticationHeaders(config.auth)
  }

  return loginWithApiUser(config, config.auth)
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
        ...await getAuthenticationHeaders(config),
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
  if (contact.street) fields.fieldStreet1 = contact.street
  if (contact.postal_code) fields.fieldZip = contact.postal_code
  if (contact.city) fields.fieldCity = contact.city
  if (contact.country) fields.fieldCountry = contact.country
  if (contact.phone_mobile) fields.fieldMobilePhone = contact.phone_mobile
  if (contact.website) fields.fieldWebsite = contact.website

  const birthday = toBirthdayTimestamp(contact.geburtstag)
  if (birthday != null) fields.fieldBirthday = birthday

  return fields
}

/** KlickTipp erwartet Datumsfelder als Unix-Zeitstempel in Sekunden. */
function toBirthdayTimestamp(value?: string | null): number | null {
  if (!value) return null

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim())
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const milliseconds = Date.UTC(year, month - 1, day)
  const date = new Date(milliseconds)

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }

  return Math.floor(milliseconds / 1000)
}

function normalizeFieldLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function findGenderFieldKey(response: unknown): string | null {
  const visited = new Set<object>()
  const genderLabels = new Set(['geschlecht', 'gender', 'sex'])

  const inspect = (value: unknown, keyHint?: string, depth = 0): string | null => {
    if (depth > 5 || value == null) return null

    if (typeof value === 'string') {
      if (
        keyHint?.startsWith('field') &&
        genderLabels.has(normalizeFieldLabel(value))
      ) {
        return keyHint
      }
      return null
    }

    if (typeof value !== 'object' || visited.has(value)) return null
    visited.add(value)

    if (Array.isArray(value)) {
      for (const item of value) {
        const result = inspect(item, undefined, depth + 1)
        if (result) return result
      }
      return null
    }

    const record = value as JsonRecord
    const fieldKeyCandidate = record.key ?? record.field_key ?? record.fieldKey ?? record.id
    const labelCandidate = record.label ?? record.name ?? record.title ?? record.field_name
    if (
      typeof fieldKeyCandidate === 'string' &&
      fieldKeyCandidate.startsWith('field') &&
      typeof labelCandidate === 'string' &&
      genderLabels.has(normalizeFieldLabel(labelCandidate))
    ) {
      return fieldKeyCandidate
    }

    for (const [key, nested] of Object.entries(record)) {
      const result = inspect(nested, key, depth + 1)
      if (result) return result
    }
    return null
  }

  return inspect(response)
}

async function resolveGenderFieldKey(): Promise<string | null> {
  const configuredKey = process.env.KLICKTIPP_GENDER_FIELD_KEY?.trim()
  if (configuredKey) {
    if (!/^field[A-Za-z0-9_]+$/.test(configuredKey)) {
      throw new Error('KLICKTIPP_GENDER_FIELD_KEY hat kein gültiges KlickTipp-Feldformat')
    }
    return configuredKey
  }

  if (cachedGenderField && cachedGenderField.expiresAt > Date.now()) {
    return cachedGenderField.key
  }

  try {
    const response = await makeRequest<unknown>('GET', '/field.json')
    const key = findGenderFieldKey(response)
    cachedGenderField = { key, expiresAt: Date.now() + 15 * 60_000 }
    return key
  } catch {
    // Ein optionales Geschlechtsfeld darf den grundlegenden Kontaktsync nicht blockieren.
    console.warn('[KlickTipp] Optionales Datenfeld Geschlecht konnte nicht ermittelt werden')
    cachedGenderField = { key: null, expiresAt: Date.now() + 5 * 60_000 }
    return null
  }
}

function normalizeGender(value: string): string {
  const normalized = normalizeFieldLabel(value)
  if (['mannlich', 'male', 'm'].includes(normalized)) return 'männlich'
  if (['weiblich', 'female', 'w', 'f'].includes(normalized)) return 'weiblich'
  if (['divers', 'diverse', 'nonbinary'].includes(normalized)) return 'divers'
  return value.trim()
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

  const fields = buildContactFields(contact)
  if (contact.geschlecht?.trim()) {
    const genderFieldKey = await resolveGenderFieldKey()
    if (genderFieldKey) fields[genderFieldKey] = normalizeGender(contact.geschlecht)
  }

  const response = await makeRequest<unknown>('POST', '/subscriber.json', {
    email,
    fields,
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

let cachedTagMap: { expiresAt: number; value: Map<string, number> } | null = null

async function loadTagMap(forceRefresh = false): Promise<Map<string, number>> {
  if (!forceRefresh && cachedTagMap && cachedTagMap.expiresAt > Date.now()) {
    return cachedTagMap.value
  }
  const response = await makeRequest<unknown>('GET', '/tag.json')
  const tagMap = normalizeTagMap(response)
  cachedTagMap = { expiresAt: Date.now() + 5 * 60_000, value: tagMap }
  return tagMap
}

async function resolveTagIds(tagNames: string[]): Promise<number[]> {
  if (tagNames.length === 0) return []
  const tagMap = await loadTagMap()

  return tagNames
    .map((tagName) => tagMap.get(tagName.trim().toLowerCase()))
    .filter((tagId): tagId is number => tagId != null)
}

/** Legt ausschließlich ausdrücklich freigegebene, noch fehlende manuelle Tags an. */
export async function ensureKlickTippTags(tagNames: string[]): Promise<number[]> {
  const uniqueNames = Array.from(
    new Map(
      tagNames
        .map((name) => name.trim())
        .filter(Boolean)
        .map((name) => [name.toLowerCase(), name])
    ).values()
  )
  let tagMap = await loadTagMap()

  for (const tagName of uniqueNames) {
    if (tagMap.has(tagName.toLowerCase())) continue
    await makeRequest<unknown>('POST', '/tag.json', { name: tagName })
  }

  tagMap = await loadTagMap(true)
  const unresolved = uniqueNames.filter((name) => !tagMap.has(name.toLowerCase()))
  if (unresolved.length > 0) {
    throw new Error(`KlickTipp-Tag konnte nicht angelegt werden: ${unresolved.join(', ')}`)
  }
  return uniqueNames.map((name) => tagMap.get(name.toLowerCase()) as number)
}

/** Entfernt gezielt Tags; andere, nur in KlickTipp gepflegte Tags bleiben erhalten. */
export async function untagKlickTippContact(email: string, tagIds: number[]): Promise<void> {
  const uniqueTagIds = Array.from(new Set(tagIds.filter((id) => Number.isInteger(id) && id > 0)))
  if (uniqueTagIds.length === 0) return
  await makeRequest<unknown>('POST', '/subscriber/untag.json', {
    email: email.trim().toLowerCase(),
    tagids: uniqueTagIds,
  })
}

/** Ersetzt ausschließlich die bisher von Sentimental Logic verwalteten Tags. */
export async function replaceKlickTippContactTags(
  email: string,
  previousTagNames: string[],
  nextTagNames: string[]
): Promise<number[]> {
  const [previousIds, nextIds] = await Promise.all([
    resolveTagIds(previousTagNames),
    resolveTagIds(nextTagNames),
  ])
  if (nextIds.length !== new Set(nextTagNames.map((name) => name.trim().toLowerCase())).size) {
    throw new Error('Mindestens ein gewünschter KlickTipp-Tag wurde nicht gefunden')
  }
  const nextIdSet = new Set(nextIds)
  await untagKlickTippContact(email, previousIds.filter((id) => !nextIdSet.has(id)))
  await tagKlickTippContact(email, nextIds)
  return nextIds
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

/** Liest ausschließlich den aktuellen Versand-/Einwilligungsstatus eines Kontakts. */
export async function getKlickTippContactStatus(subscriberId: string): Promise<KlickTippContactStatusResult> {
  if (!subscriberId.trim()) throw new Error('KlickTipp-Kontakt-ID fehlt')
  const response = await makeRequest<unknown>('GET', `/subscriber/${encodeURIComponent(subscriberId.trim())}.json`)

  const findStatus = (value: unknown, depth = 0): KlickTippEmailStatus | null => {
    if (depth > 4 || !value || typeof value !== 'object') return null
    if (Array.isArray(value)) {
      for (const item of value) {
        const status = findStatus(item, depth + 1)
        if (status) return status
      }
      return null
    }
    const record = value as JsonRecord
    for (const key of ['status', 'email_status', 'emailStatus', 'subscription_status', 'subscriptionStatus']) {
      const status = normalizeKlickTippEmailStatus(record[key])
      if (status) return status
    }
    for (const nested of Object.values(record)) {
      const status = findStatus(nested, depth + 1)
      if (status) return status
    }
    return null
  }

  return { status: findStatus(response) ?? 'unknown' }
}
