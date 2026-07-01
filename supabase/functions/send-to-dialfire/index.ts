import { serve } from "https://deno.land/std@0.208.0/http/server.ts"

const DIALFIRE_API_URL = Deno.env.get("DIALFIRE_API_URL") || "https://api.dialfire.com"

// Kampagnen-Mapping: Campaign-ID → API-Key + Task-Name
function getCampaignConfig(campaignId: string): { api_key: string; task_name: string } | null {
  switch (campaignId) {
    case "GENS85UE5SU4SSC7":
      return {
        api_key: Deno.env.get("DIALFIRE_API_KEY") || "",
        task_name: Deno.env.get("DIALFIRE_TASK_NAME") || "call",
      }
    case "SFU6DSEG4RU2Z6HX":
      return {
        api_key: Deno.env.get("DIALFIRE_API_KEY_FACEBOOK") || "",
        task_name: "anrufen_stufe",
      }
    default:
      return null
  }
}

interface DialfireContactPayload {
  $ref: string
  $phone?: string
  first_name?: string
  last_name?: string
  email?: string
  company_name?: string
  strasse?: string
  plz?: string
  ort?: string
  Tätigkeit?: string
  Mitarbeiter?: number | string
  Jahresumsatz?: string
  [key: string]: any
}

async function createDialfireContact(
  payload: DialfireContactPayload,
  campaignId: string,
  apiKey: string,
  taskName: string
) {
  const url = `${DIALFIRE_API_URL}/api/campaigns/${campaignId}/tasks/${taskName}/contacts/create`

  console.log(`[Dialfire] Calling: ${campaignId} / task: ${taskName}`)

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const text = await res.text()

    if (res.status === 409) {
      console.log(`[Dialfire] Contact exists (409): ${text}`)
      const match = text.match(/contacts\/([A-Z0-9]+)/)
      if (match) {
        return { id: match[1] }
      }
      throw new Error(`Dialfire 409 but could not extract ID: ${text}`)
    }

    throw new Error(`Dialfire API ${res.status}: ${text}`)
  }

  return await res.json()
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 })
  }

  try {
    const { contact } = await req.json()

    if (!contact?.id) {
      return new Response("Missing contact data", { status: 400 })
    }

    if (!contact.dialfire_campaign_id) {
      return new Response("Missing dialfire_campaign_id in contact data", { status: 400 })
    }

    // Hole Kampagnen-Konfiguration
    const campaignId = contact.dialfire_campaign_id
    const config = getCampaignConfig(campaignId)

    if (!config) {
      throw new Error(`No configuration found for campaign: ${campaignId}`)
    }

    if (!config.api_key) {
      console.error(`[Dialfire] Missing API key for campaign: ${campaignId}`)
      throw new Error(`Missing API key for campaign ${campaignId}. Check environment variables: DIALFIRE_API_KEY or DIALFIRE_API_KEY_FACEBOOK`)
    }

    const payload: DialfireContactPayload = {
      $ref: contact.id,
      $phone: contact.phone_mobile,
      first_name: contact.first_name,
      vorname: contact.first_name,
      last_name: contact.last_name,
      nachname: contact.last_name,
      email: contact.email,
      company_name: contact.company_name,
      Firmenname: contact.company_name,
      Firma: contact.company_name,
      strasse: contact.street,
      plz: contact.postal_code,
      ort: contact.city,
      Tätigkeit: contact.position,
      Herkunft: contact.source,
      "Genaue_Tätigkeit": contact.industry,
      Mitarbeiter: contact.mitarbeitanzahl,
      Jahresumsatz: contact.jahresumsatz,
    }

    const result = await createDialfireContact(payload, campaignId, config.api_key, config.task_name)

    const dialfireId = result.data?.$id || result.id || result.$id

    if (!dialfireId) {
      throw new Error(`Could not extract Dialfire ID from response: ${JSON.stringify(result)}`)
    }

    console.log(`✅ Contact ${contact.email} created in Dialfire (Campaign: ${campaignId}, ID: ${dialfireId})`)

    return new Response(
      JSON.stringify({ success: true, dialfire_id: dialfireId }),
      { headers: { "Content-Type": "application/json" } }
    )
  } catch (err) {
    console.error("Error:", err)
    return new Response(
      JSON.stringify({ error: String(err), success: false }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})
