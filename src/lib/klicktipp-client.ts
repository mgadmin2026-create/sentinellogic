/**
 * KlickTipp Management API Client
 * Handles contacts, tags, and opt-in processes
 */

const KLICKTIPP_API_URL = 'https://api.klicktipp.com'

interface KlickTippConfig {
  developerKey: string
  customerKey: string
}

interface SubscriberData {
  email: string
  fieldFirstName?: string
  fieldLastName?: string
  fieldCompanyName?: string
  fieldCity?: string
  fieldCountry?: string
  fieldMobilePhone?: string
  fieldWebsite?: string
  tagid?: number
  listid?: number
  fields?: Record<string, any>
}

interface TagResponse {
  id: number
  name: string
  system: boolean
  type: string
  [key: string]: any
}

interface SubscriberResponse {
  id: string
  email: string
  status: string
  tags: string[]
  [key: string]: any
}

/**
 * Get KlickTipp credentials from environment
 */
function getConfig(): KlickTippConfig {
  const developerKey = process.env.KLICKTIPP_DEVELOPER_KEY
  const customerKey = process.env.KLICKTIPP_CUSTOMER_KEY

  if (!developerKey || !customerKey) {
    throw new Error('Missing KlickTipp credentials: KLICKTIPP_DEVELOPER_KEY and KLICKTIPP_CUSTOMER_KEY required')
  }

  return { developerKey, customerKey }
}

/**
 * Build Authorization header for KlickTipp API
 */
function getAuthHeader(config: KlickTippConfig): string {
  const credentials = `${config.developerKey}:${config.customerKey}`
  const encoded = Buffer.from(credentials).toString('base64')
  return `Basic ${encoded}`
}

/**
 * Make authenticated request to KlickTipp API
 */
async function makeRequest<T>(
  method: string,
  endpoint: string,
  config: KlickTippConfig,
  body?: Record<string, any>
): Promise<T> {
  const url = `${KLICKTIPP_API_URL}${endpoint}`
  const headers: Record<string, string> = {
    Authorization: getAuthHeader(config),
    'Content-Type': 'application/json',
  }

  const options: RequestInit = {
    method,
    headers,
  }

  if (body) {
    options.body = JSON.stringify(body)
  }

  try {
    const response = await fetch(url, options)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[KlickTipp] ${method} ${endpoint} failed:`, {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      })

      if (response.status === 406) {
        throw new Error(`KlickTipp validation error: ${errorText}`)
      }

      throw new Error(`KlickTipp API error ${response.status}: ${errorText}`)
    }

    return await response.json() as T
  } catch (err) {
    console.error(`[KlickTipp] Request failed:`, err)
    throw err
  }
}

/**
 * List all tags and find by name
 */
export async function findTagByName(tagName: string): Promise<TagResponse | null> {
  try {
    const config = getConfig()
    const tags = await makeRequest<{ tags: TagResponse[] }>('GET', '/tag', config)

    if (!tags.tags || !Array.isArray(tags.tags)) {
      console.warn('[KlickTipp] No tags found in response')
      return null
    }

    const tag = tags.tags.find((t) => t.name.toLowerCase() === tagName.toLowerCase())
    return tag || null
  } catch (err) {
    console.error(`[KlickTipp] Failed to find tag "${tagName}":`, err)
    throw err
  }
}

/**
 * Add or update a subscriber contact
 * If email exists, updates; otherwise creates new
 */
export async function addOrUpdateSubscriber(data: SubscriberData): Promise<SubscriberResponse> {
  try {
    const config = getConfig()

    // Validate required fields
    if (!data.email) {
      throw new Error('Email is required for KlickTipp subscriber')
    }

    const payload: Record<string, any> = {
      email: data.email,
    }

    // Map optional fields
    if (data.fieldFirstName) payload.fieldFirstName = data.fieldFirstName
    if (data.fieldLastName) payload.fieldLastName = data.fieldLastName
    if (data.fieldCompanyName) payload.fieldCompanyName = data.fieldCompanyName
    if (data.fieldCity) payload.fieldCity = data.fieldCity
    if (data.fieldCountry) payload.fieldCountry = data.fieldCountry
    if (data.fieldMobilePhone) payload.fieldMobilePhone = data.fieldMobilePhone
    if (data.fieldWebsite) payload.fieldWebsite = data.fieldWebsite

    // Tag ID (optional, triggers automations)
    if (data.tagid) {
      payload.tagid = data.tagid
    }

    // Opt-in list ID (optional, defaults to double opt-in)
    if (data.listid) {
      payload.listid = data.listid
    }

    // Custom fields (optional)
    if (data.fields) {
      payload.fields = data.fields
    }

    console.log(`[KlickTipp] Adding/updating subscriber: ${data.email}`)

    const response = await makeRequest<SubscriberResponse>('POST', '/subscriber', config, payload)

    console.log(`✅ [KlickTipp] Subscriber ${data.email} synced (ID: ${response.id})`)

    return response
  } catch (err) {
    console.error(`[KlickTipp] Failed to add/update subscriber:`, err)
    throw err
  }
}

/**
 * Add one or more tags to a subscriber
 */
export async function tagSubscriber(email: string, tagIds: number[]): Promise<void> {
  try {
    if (!tagIds.length) {
      console.warn('[KlickTipp] No tag IDs provided for tagging')
      return
    }

    const config = getConfig()

    // KlickTipp expects a single tagid, so we call it for each tag
    // Or use the subscriber ID if available - but we'll use email for now
    for (const tagid of tagIds) {
      await makeRequest<void>('POST', `/subscriber/${email}/tag/${tagid}`, config)
    }

    console.log(`✅ [KlickTipp] Tagged ${email} with ${tagIds.length} tag(s)`)
  } catch (err) {
    console.error(`[KlickTipp] Failed to tag subscriber:`, err)
    throw err
  }
}

/**
 * Sync a Sentinel contact to KlickTipp
 * Handles finding tag by name and creating/updating subscriber
 */
export async function syncContactToKlickTipp(contact: {
  id: string
  email: string
  first_name?: string
  last_name?: string
  company_name?: string
  city?: string
  country?: string
  phone_mobile?: string
  website?: string
  tagName?: string // e.g., "Sentinel"
}): Promise<SubscriberResponse> {
  try {
    console.log(`[KlickTipp] Syncing contact: ${contact.email}`)

    // Find tag ID if tag name is provided
    let tagid: number | undefined
    if (contact.tagName) {
      const tag = await findTagByName(contact.tagName)
      if (tag) {
        tagid = tag.id
        console.log(`[KlickTipp] Found tag "${contact.tagName}" with ID ${tagid}`)
      } else {
        console.warn(`[KlickTipp] Tag "${contact.tagName}" not found - subscriber will be created without tag`)
      }
    }

    // Prepare subscriber data
    const subscriberData: SubscriberData = {
      email: contact.email,
      fieldFirstName: contact.first_name,
      fieldLastName: contact.last_name,
      fieldCompanyName: contact.company_name,
      fieldCity: contact.city,
      fieldCountry: contact.country,
      fieldMobilePhone: contact.phone_mobile,
      fieldWebsite: contact.website,
      tagid,
    }

    // Add or update subscriber
    return await addOrUpdateSubscriber(subscriberData)
  } catch (err) {
    console.error(`[KlickTipp] Failed to sync contact ${contact.email}:`, err)
    throw err
  }
}
