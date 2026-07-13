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
    case "6X42NJWGH4YA6HC7":
      return {
        api_key: Deno.env.get("DIALFIRE_API_KEY_PKV") || "",
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
  "Haus_Nr_"?: string
  Tätigkeit?: string
  Herkunft?: string
  "Genaue_Tätigkeit"?: string
  Mitarbeiter?: number | string
  Jahresumsatz?: string
  // Personal Info (PKV)
  Anrede?: string
  Geburtstag?: string
  Jahreseinkommen?: number | string
  Größe?: number
  Gewicht?: number
  "Gesundheitszustand_"?: string
  "seit_wann_selbstständig"?: string
  "Dienstverhältnis_"?: string
  "Was_ist_zu_prüfen_"?: string
  "aktuelle_Kranken_versichert_"?: string
  "Aktuelle_Situation"?: string
  // Insurance Records (1-5)
  Versicherungsgesellschaft?: string
  Leistungen?: string
  "aktueller_Beitrag"?: number | string
  Kontoinhaber?: string
  IBAN?: string
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
      throw new Error(`Missing API key for campaign ${campaignId}. Check environment variables: DIALFIRE_API_KEY or DIALFIRE_API_KEY_FACEBOOK or DIALFIRE_API_KEY_PKV`)
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
      "Haus_Nr_": contact.hausnummer,
      Tätigkeit: contact.position,
      Herkunft: contact.source,
      "Genaue_Tätigkeit": contact.industry,
      Mitarbeiter: contact.mitarbeitanzahl,
      Jahresumsatz: contact.jahresumsatz,

      // Personal Information (PKV Campaign)
      Anrede: contact.anrede,
      Geburtstag: contact.geburtstag,
      Jahreseinkommen: contact.jahreseinkommen,
      Größe: contact.groesse,
      Gewicht: contact.gewicht,
      "Gesundheitszustand_": contact.gesundheitszustand,
      "seit_wann_selbstständig": contact.seit_wann_selbststaendig,
      "Dienstverhältnis_": contact.dienstverhaltnis,
      "Was_ist_zu_prüfen_": contact.prüfung_grund,
      "aktuelle_Kranken_versichert_": contact.krankenversicherung_status,
      "Aktuelle_Situation": contact.situation,

      // Insurance Records (Support for 5 Insurance Records)
      // Insurance 1
      Versicherungsgesellschaft: contact.versicherungsgesellschaft_1,
      Leistungen: contact.leistungen_1,
      "aktueller_Beitrag": contact.aktueller_beitrag_1,
      Kontoinhaber: contact.kontoinhaber_1,
      IBAN: contact.iban_1,

      // Insurance 2-5 (dynamic fields)
      "Versicherungsgesellschaft_2": contact.versicherungsgesellschaft_2,
      "Leistungen_2": contact.leistungen_2,
      "aktueller_Beitrag_2": contact.aktueller_beitrag_2,
      "Kontoinhaber_2": contact.kontoinhaber_2,
      "IBAN_2": contact.iban_2,

      "Versicherungsgesellschaft_3": contact.versicherungsgesellschaft_3,
      "Leistungen_3": contact.leistungen_3,
      "aktueller_Beitrag_3": contact.aktueller_beitrag_3,
      "Kontoinhaber_3": contact.kontoinhaber_3,
      "IBAN_3": contact.iban_3,

      "Versicherungsgesellschaft_4": contact.versicherungsgesellschaft_4,
      "Leistungen_4": contact.leistungen_4,
      "aktueller_Beitrag_4": contact.aktueller_beitrag_4,
      "Kontoinhaber_4": contact.kontoinhaber_4,
      "IBAN_4": contact.iban_4,

      "Versicherungsgesellschaft_5": contact.versicherungsgesellschaft_5,
      "Leistungen_5": contact.leistungen_5,
      "aktueller_Beitrag_5": contact.aktueller_beitrag_5,
      "Kontoinhaber_5": contact.kontoinhaber_5,
      "IBAN_5": contact.iban_5,

      // Additional Notes
      "Notizen2": contact.notizen_2,
    }

    // Task-Name: bevorzugt der per Regel gesetzte Wert, sonst Kampagnen-Default
    const taskName = contact.dialfire_task_name_field || config.task_name

    const result = await createDialfireContact(payload, campaignId, config.api_key, taskName)

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
