// KlickTipp Integration über Make.com Webhook
// ─────────────────────────────────────────────────────────────
// KlickTipp blockiert direkte REST-API-Calls für dieses Konto (403).
// Lösung: Make.com hat ein natives KlickTipp-Modul und übernimmt die
// Authentifizierung. Sentinel sendet die Lead-Daten an einen Make.com-
// Webhook, das Szenario trägt den Kontakt in KlickTipp ein und setzt den Tag.
//
// Vorteile: läuft zuverlässig auf Vercel (nur ein ausgehender HTTP-Call),
// kein Browser, keine Timeouts, KlickTipp-Auth komplett bei Make.com.

export interface LeadSyncData {
  email: string
  first_name?: string | null
  last_name?: string | null
  phone_mobile?: string | null
}

export interface KlicktippSyncResult {
  success: boolean
  message: string
  subscriberId?: string
}

// Lead an Make.com-Webhook senden → Make.com trägt ihn in KlickTipp ein
export async function syncLeadToKlicktipp(
  lead: LeadSyncData,
  tagName: string,
  listId?: string
): Promise<KlicktippSyncResult> {
  const webhookUrl = process.env.MAKE_WEBHOOK_URL

  // Kein Webhook konfiguriert → still überspringen
  if (!webhookUrl) {
    return {
      success: false,
      message: 'MAKE_WEBHOOK_URL nicht konfiguriert — Make.com-Szenario für KlickTipp fehlt',
    }
  }

  // KlickTipp benötigt eine E-Mail-Adresse
  if (!lead.email) {
    return { success: false, message: 'Kein E-Mail beim Lead — KlickTipp übersprungen' }
  }

  try {
    // Payload für das Make.com-Szenario
    const payload = {
      email: lead.email,
      first_name: lead.first_name ?? '',
      last_name: lead.last_name ?? '',
      phone: lead.phone_mobile ?? '',
      tag: tagName,
      list_id: listId ?? '',
    }

    // Timeout-Schutz (Make.com Webhooks antworten in <1s, 8s ist großzügig)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      return {
        success: false,
        message: `Make.com Webhook Fehler (${response.status}): ${text.slice(0, 120)}`,
      }
    }

    return {
      success: true,
      message: `Kontakt an Make.com übermittelt, Tag "${tagName}" wird in KlickTipp gesetzt`,
    }
  } catch (error) {
    const msg =
      error instanceof Error && error.name === 'AbortError'
        ? 'Make.com Webhook Timeout (8s) — Szenario nicht erreichbar'
        : error instanceof Error
          ? error.message
          : String(error)
    return { success: false, message: msg }
  }
}
