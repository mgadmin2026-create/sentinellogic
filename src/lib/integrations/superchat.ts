import { normalizePhoneNumber } from '@/lib/phone'

const DEFAULT_API_BASE_URL = 'https://api.superchat.com/v1.0'
const DEFAULT_TIMEOUT_MS = 8_000

export interface SuperchatContactInput {
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phoneMobile?: string | null
  phoneOffice?: string | null
  gender?: string | null
  companyName?: string | null
  street?: string | null
  houseNumber?: string | null
  postalCode?: string | null
  city?: string | null
  country?: string | null
  birthDate?: string | null
}

interface SuperchatHandle {
  id?: string
  type: 'mail' | 'phone'
  value: string
}

type SuperchatCustomAttributeType =
  | 'text'
  | 'dateonly'
  | 'number'
  | 'datetime'
  | 'single_select'
  | 'multi_select'

interface SuperchatCustomAttributeDefinition {
  id: string
  name: string
  type: SuperchatCustomAttributeType
}

interface SuperchatCustomAttributeValue {
  id: string
  value: string
}

interface DesiredCustomAttribute {
  name: string
  type: 'text' | 'dateonly'
  value: string
}

export interface SuperchatContactResult {
  id: string
}

export class SuperchatApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'SuperchatApiError'
    this.status = status
  }
}

function getApiBaseUrl(): string {
  const configured = process.env.SUPERCHAT_API_URL?.trim() || DEFAULT_API_BASE_URL
  const url = new URL(configured)

  // Verhindert, dass eine manipulierte Umgebungsvariable interne Ziele anspricht.
  if (url.protocol !== 'https:' || url.hostname !== 'api.superchat.com') {
    throw new SuperchatApiError('Die konfigurierte SuperChat-API-URL ist nicht zulässig')
  }

  return url.toString().replace(/\/$/, '')
}

function getApiKey(): string {
  const apiKey = process.env.SUPERCHAT_API_KEY?.trim()
  if (!apiKey) {
    throw new SuperchatApiError('SuperChat ist noch nicht vollständig konfiguriert')
  }
  return apiKey
}

function normalizeEmail(raw?: string | null): string | null {
  if (!raw) return null
  const email = raw.trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
}

function mapGender(raw?: string | null): 'female' | 'male' | 'diverse' | undefined {
  const normalized = raw?.trim().toLowerCase()
  if (['weiblich', 'female', 'frau', 'w'].includes(normalized || '')) return 'female'
  if (['männlich', 'maennlich', 'male', 'herr', 'm'].includes(normalized || '')) return 'male'
  if (['divers', 'diverse', 'non-binary'].includes(normalized || '')) return 'diverse'
  return undefined
}

function normalizeText(raw?: string | null): string | null {
  const value = raw?.trim()
  return value || null
}

function normalizeDateOnly(raw?: string | null): string | null {
  const value = raw?.trim()
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null

  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
    ? null
    : value
}

function buildAddress(contact: SuperchatContactInput): string | null {
  const streetLine = [normalizeText(contact.street), normalizeText(contact.houseNumber)]
    .filter(Boolean)
    .join(' ')
  const cityLine = [normalizeText(contact.postalCode), normalizeText(contact.city)]
    .filter(Boolean)
    .join(' ')

  return [streetLine, cityLine, normalizeText(contact.country)].filter(Boolean).join(', ') || null
}

function getDesiredCustomAttributes(
  contact: SuperchatContactInput
): DesiredCustomAttribute[] {
  const company = normalizeText(contact.companyName)
  const address = buildAddress(contact)
  const birthDate = normalizeDateOnly(contact.birthDate)
  const attributes: Array<DesiredCustomAttribute | null> = [
    company ? { name: 'Firma', type: 'text', value: company } : null,
    address ? { name: 'Adresse', type: 'text', value: address } : null,
    birthDate ? { name: 'Geburtsdatum', type: 'dateonly', value: birthDate } : null,
  ]

  return attributes.filter((attribute): attribute is DesiredCustomAttribute => Boolean(attribute))
}

function buildHandles(contact: SuperchatContactInput): SuperchatHandle[] {
  const handles: SuperchatHandle[] = []
  const seen = new Set<string>()

  const email = normalizeEmail(contact.email)
  if (email) {
    handles.push({ type: 'mail', value: email })
    seen.add(`mail:${email}`)
  }

  for (const rawPhone of [contact.phoneMobile, contact.phoneOffice]) {
    const phone = normalizePhoneNumber(rawPhone)
    if (phone && !seen.has(`phone:${phone}`)) {
      handles.push({ type: 'phone', value: phone })
      seen.add(`phone:${phone}`)
    }
  }

  if (handles.length === 0) {
    throw new SuperchatApiError(
      'Für die Übertragung wird eine gültige E-Mail-Adresse oder Telefonnummer benötigt'
    )
  }

  return handles
}

function readCustomAttributeDefinitions(body: unknown): SuperchatCustomAttributeDefinition[] {
  if (!body || typeof body !== 'object') return []
  const results = (body as Record<string, unknown>).results
  if (!Array.isArray(results)) return []

  return results.flatMap((raw): SuperchatCustomAttributeDefinition[] => {
    if (!raw || typeof raw !== 'object') return []
    const attribute = raw as Record<string, unknown>
    if (
      typeof attribute.id !== 'string' ||
      typeof attribute.name !== 'string' ||
      ![
        'text',
        'dateonly',
        'number',
        'datetime',
        'single_select',
        'multi_select',
      ].includes(String(attribute.type))
    ) {
      return []
    }
    return [{
      id: attribute.id,
      name: attribute.name,
      type: attribute.type as SuperchatCustomAttributeType,
    }]
  })
}

function readNextCustomAttributeCursor(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  const pagination = (body as Record<string, unknown>).pagination
  if (!pagination || typeof pagination !== 'object') return null
  const cursor = (pagination as Record<string, unknown>).next_cursor
  return typeof cursor === 'string' && cursor ? cursor : null
}

function readCustomAttributeDefinition(body: unknown): SuperchatCustomAttributeDefinition | null {
  if (!body || typeof body !== 'object') return null
  const attribute = body as Record<string, unknown>
  if (
    typeof attribute.id !== 'string' ||
    typeof attribute.name !== 'string' ||
    ![
      'text',
      'dateonly',
      'number',
      'datetime',
      'single_select',
      'multi_select',
    ].includes(String(attribute.type))
  ) {
    return null
  }
  return {
    id: attribute.id,
    name: attribute.name,
    type: attribute.type as SuperchatCustomAttributeType,
  }
}

function readContactId(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  const record = body as Record<string, unknown>
  if (typeof record.id === 'string' && record.id.trim()) return record.id

  for (const key of ['contact', 'data']) {
    const nested = record[key]
    if (nested && typeof nested === 'object') {
      const id = (nested as Record<string, unknown>).id
      if (typeof id === 'string' && id.trim()) return id
    }
  }

  return null
}

async function superchatRequest(
  path: string,
  method: 'GET' | 'POST' | 'PATCH',
  body?: Record<string, unknown>
): Promise<unknown> {
  if (!path.startsWith('/') || path.startsWith('//')) {
    throw new SuperchatApiError('Ungültiger SuperChat-API-Pfad')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      method,
      headers: {
        'X-API-KEY': getApiKey(),
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      signal: controller.signal,
    })

    const contentType = response.headers.get('content-type') || ''
    const responseBody = contentType.toLowerCase().includes('application/json')
      ? await response.json().catch(() => null)
      : null

    if (!response.ok) {
      const message =
        response.status === 401 || response.status === 403
          ? `SuperChat hat den API-Zugriff abgelehnt (HTTP ${response.status})`
          : response.status === 429
            ? `SuperChat-Anfragelimit erreicht (HTTP ${response.status}). Bitte später erneut versuchen`
            : `SuperChat-Anfrage fehlgeschlagen (HTTP ${response.status})`
      throw new SuperchatApiError(message, response.status)
    }

    return responseBody
  } catch (error) {
    if (error instanceof SuperchatApiError) throw error
    if (error instanceof Error && error.name === 'AbortError') {
      throw new SuperchatApiError('Zeitüberschreitung bei der SuperChat-Anfrage')
    }
    throw new SuperchatApiError('SuperChat ist derzeit nicht erreichbar')
  } finally {
    clearTimeout(timeout)
  }
}

async function listCustomAttributes(): Promise<SuperchatCustomAttributeDefinition[]> {
  const attributes: SuperchatCustomAttributeDefinition[] = []
  let cursor: string | null = null

  do {
    const query = cursor ? `?limit=100&after=${encodeURIComponent(cursor)}` : '?limit=100'
    const body = await superchatRequest(`/custom-attributes${query}`, 'GET')
    attributes.push(...readCustomAttributeDefinitions(body))
    cursor = readNextCustomAttributeCursor(body)
  } while (cursor)

  return attributes
}

async function createCustomAttribute(
  attribute: Pick<DesiredCustomAttribute, 'name' | 'type'>
): Promise<SuperchatCustomAttributeDefinition> {
  const body = await superchatRequest('/custom-attributes', 'POST', {
    name: attribute.name,
    resource: 'contact',
    type: attribute.type,
  })
  const created = readCustomAttributeDefinition(body)
  if (!created) {
    throw new SuperchatApiError(
      `SuperChat hat für das Kontaktfeld „${attribute.name}“ keine ID zurückgegeben`
    )
  }
  return created
}

async function buildCustomAttributeValues(
  contact: SuperchatContactInput
): Promise<SuperchatCustomAttributeValue[] | undefined> {
  const desiredAttributes = getDesiredCustomAttributes(contact)
  if (desiredAttributes.length === 0) return undefined

  const definitions = await listCustomAttributes()
  const values: SuperchatCustomAttributeValue[] = []

  for (const desired of desiredAttributes) {
    let definition = definitions.find(
      (candidate) => candidate.name.trim().toLowerCase() === desired.name.toLowerCase()
    )

    if (definition && definition.type !== desired.type) {
      throw new SuperchatApiError(
        `Das SuperChat-Kontaktfeld „${desired.name}“ hat nicht den erwarteten Feldtyp`
      )
    }
    if (!definition) {
      definition = await createCustomAttribute(desired)
      definitions.push(definition)
    }

    values.push({ id: definition.id, value: desired.value })
  }

  return values
}

function buildContactPayload(
  contact: SuperchatContactInput,
  handles?: SuperchatHandle[],
  customAttributes?: SuperchatCustomAttributeValue[]
): Record<string, unknown> {
  const gender = mapGender(contact.gender)
  return {
    first_name: contact.firstName?.trim() || null,
    last_name: contact.lastName?.trim() || null,
    ...(gender ? { gender } : {}),
    ...(handles ? { handles } : {}),
    ...(customAttributes ? { custom_attributes: customAttributes } : {}),
  }
}

function readContactRecord(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== 'object') return null
  const record = body as Record<string, unknown>

  for (const key of ['contact', 'data']) {
    const nested = record[key]
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      return nested as Record<string, unknown>
    }
  }

  return record
}

function readExistingHandles(body: unknown): SuperchatHandle[] {
  const record = readContactRecord(body)
  if (!record || !Array.isArray(record.handles)) return []

  return record.handles.flatMap((raw): SuperchatHandle[] => {
    if (!raw || typeof raw !== 'object') return []
    const handle = raw as Record<string, unknown>
    if (
      typeof handle.id !== 'string' ||
      (handle.type !== 'mail' && handle.type !== 'phone') ||
      typeof handle.value !== 'string'
    ) {
      return []
    }
    return [{ id: handle.id, type: handle.type, value: handle.value }]
  })
}

function mergeMissingHandles(
  existingHandles: SuperchatHandle[],
  desiredHandles: SuperchatHandle[]
): SuperchatHandle[] | undefined {
  const existingKeys = new Set(
    existingHandles.map((handle) => `${handle.type}:${handle.value.trim().toLowerCase()}`)
  )
  const missingHandles = desiredHandles.filter(
    (handle) => !existingKeys.has(`${handle.type}:${handle.value.trim().toLowerCase()}`)
  )

  // Ohne neue Kontaktwege bleibt das Handles-Feld vollständig aus dem PATCH.
  // So werden keine in SuperChat hinzugefügten Kanäle versehentlich verändert.
  return missingHandles.length > 0 ? [...existingHandles, ...missingHandles] : undefined
}

/** Erstellt einen Kontakt und liefert ausschließlich seine technische Provider-ID. */
export async function createSuperchatContact(
  contact: SuperchatContactInput
): Promise<SuperchatContactResult> {
  const customAttributes = await buildCustomAttributeValues(contact)
  const responseBody = await superchatRequest(
    '/contacts',
    'POST',
    buildContactPayload(contact, buildHandles(contact), customAttributes)
  )
  const id = readContactId(responseBody)
  if (!id) {
    throw new SuperchatApiError('SuperChat hat keine Kontakt-ID zurückgegeben')
  }
  return { id }
}

/** Aktualisiert den bereits verknüpften Kontakt; seine ID bleibt unverändert. */
export async function updateSuperchatContact(
  contactId: string,
  contact: SuperchatContactInput
): Promise<SuperchatContactResult> {
  if (!/^[A-Za-z0-9_-]+$/.test(contactId)) {
    throw new SuperchatApiError('Ungültige SuperChat-Kontakt-ID')
  }
  const [existingContact, customAttributes] = await Promise.all([
    superchatRequest(`/contacts/${encodeURIComponent(contactId)}`, 'GET'),
    buildCustomAttributeValues(contact),
  ])
  const handles = mergeMissingHandles(readExistingHandles(existingContact), buildHandles(contact))
  await superchatRequest(
    `/contacts/${encodeURIComponent(contactId)}`,
    'PATCH',
    buildContactPayload(contact, handles, customAttributes)
  )
  return { id: contactId }
}
