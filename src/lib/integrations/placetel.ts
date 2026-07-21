import type { PlacetelApiCall } from '@/types/placetel'

const DEFAULT_API_BASE_URL = 'https://api.placetel.de/v2'
const DEFAULT_TIMEOUT_MS = 8_000

interface PlacetelRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  timeoutMs?: number
}

interface InitiateCallInput {
  sipuid: string
  target: string
  fromName?: string
}

interface PlacetelMe {
  id?: number
  name?: string
  company?: string
  email?: string
  primary_sip_user_id?: number
  platform?: string
  [key: string]: unknown
}

interface PlacetelSipUser {
  id?: number
  sipuid?: string
  name?: string
  description?: string
  did?: number
  callerid?: string
  type?: string
  online?: boolean
  [key: string]: unknown
}

export class PlacetelApiError extends Error {
  readonly status: number | null
  readonly retryAfterSeconds: number | null

  constructor(message: string, status: number | null = null, retryAfterSeconds: number | null = null) {
    super(message)
    this.name = 'PlacetelApiError'
    this.status = status
    this.retryAfterSeconds = retryAfterSeconds
  }
}

function getApiBaseUrl(): string {
  const configured = process.env.PLACETEL_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL
  const url = new URL(configured)

  if (url.protocol !== 'https:' || url.hostname !== 'api.placetel.de') {
    throw new PlacetelApiError('Die konfigurierte Placetel-API-URL ist nicht zulässig')
  }

  return url.toString().replace(/\/$/, '')
}

function getApiToken(): string {
  const token = process.env.PLACETEL_API_TOKEN?.trim()
  if (!token) throw new PlacetelApiError('Placetel ist noch nicht vollständig konfiguriert')
  return token
}

async function readJsonResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.toLowerCase().includes('application/json')) return null

  try {
    return await response.json()
  } catch {
    return null
  }
}

export async function placetelRequest<T>(
  path: string,
  options: PlacetelRequestOptions = {}
): Promise<T> {
  if (!path.startsWith('/') || path.startsWith('//')) {
    throw new PlacetelApiError('Ungültiger Placetel-API-Pfad')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS)

  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${getApiToken()}`,
        Accept: 'application/json',
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: 'no-store',
      signal: controller.signal,
    })

    const responseBody = await readJsonResponse(response)
    if (!response.ok) {
      const retryAfter = Number.parseInt(response.headers.get('retry-after') || '', 10)
      throw new PlacetelApiError(
        response.status === 429
          ? 'Placetel-Anfragelimit erreicht. Bitte später erneut versuchen.'
          : `Placetel-Anfrage fehlgeschlagen (HTTP ${response.status})`,
        response.status,
        Number.isFinite(retryAfter) ? retryAfter : null
      )
    }

    return responseBody as T
  } catch (error) {
    if (error instanceof PlacetelApiError) throw error
    if (error instanceof Error && error.name === 'AbortError') {
      throw new PlacetelApiError('Zeitüberschreitung bei der Placetel-Anfrage')
    }
    throw new PlacetelApiError('Placetel ist derzeit nicht erreichbar')
  } finally {
    clearTimeout(timeout)
  }
}

/** Initiiert den in Swagger 2.0 dokumentierten Callback-Anruf. */
export async function initiatePlacetelCall(input: InitiateCallInput): Promise<PlacetelApiCall> {
  return placetelRequest<PlacetelApiCall>('/calls', {
    method: 'POST',
    body: {
      sipuid: input.sipuid,
      target: input.target,
      ...(input.fromName ? { from_name: input.fromName } : {}),
    },
  })
}

export async function getPlacetelAccount(): Promise<PlacetelMe> {
  return placetelRequest<PlacetelMe>('/me')
}

export async function listPlacetelSipUsers(): Promise<PlacetelSipUser[]> {
  return placetelRequest<PlacetelSipUser[]>('/sip_users?per_page=100')
}

/** Reduziert Provider-Antworten auf die für den technischen Abgleich nötigen Felder. */
export function sanitizePlacetelCall(call: PlacetelApiCall): Record<string, unknown> {
  return {
    id: call.id ?? null,
    type: call.type ?? null,
    duration: typeof call.duration === 'number' ? call.duration : null,
    received_at: typeof call.received_at === 'string' ? call.received_at : null,
  }
}
