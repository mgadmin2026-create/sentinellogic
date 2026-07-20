import { expect, type APIResponse } from '@playwright/test'
import { TEST_COMPANY_PREFIX, TEST_FIRST_NAME } from '@/lib/test-data'

export interface PlaywrightTestContact {
  first_name: string
  last_name: string
  company_name: string
  email: string
  source: 'manuell'
  automation_disabled: true
}

function normalizeMarker(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)
}

/**
 * Erzeugt ausschließlich synthetische, sofort erkennbare Kontaktdaten.
 *
 * Der Szenarioname fließt immer in die E-Mail-Adresse ein, damit mehrere
 * Testszenarien innerhalb desselben Laufs (gleiche PLAYWRIGHT_RUN_ID) nicht
 * kollidieren. Ohne das würden alle Aufrufe ohne eigenes `suffix` dieselbe
 * E-Mail erzeugen und sich gegenseitig als Duplikat blockieren. `suffix` ist
 * nur für den Fall gedacht, dass ein einzelnes Szenario mehrere eigene
 * Testkontakte braucht.
 */
export function createPlaywrightTestContact(
  scenario: string,
  suffix?: string
): PlaywrightTestContact {
  const runId = process.env.PLAYWRIGHT_RUN_ID
  if (!runId) {
    throw new Error('PLAYWRIGHT_RUN_ID fehlt. globalSetup wurde nicht ausgeführt.')
  }

  const markerParts = [normalizeMarker(scenario)]
  if (suffix) markerParts.push(normalizeMarker(suffix))
  const contactMarker = `${runId}.${markerParts.join('.')}`
  return {
    first_name: TEST_FIRST_NAME,
    last_name: scenario,
    company_name: `${TEST_COMPANY_PREFIX} ${scenario}`,
    email: `pw+${contactMarker}@example.invalid`,
    source: 'manuell',
    automation_disabled: true,
  }
}

/**
 * Prüft eine API-Antwort und liefert im Fehlerfall Statuscode + Fehlermeldung
 * direkt in der Testausgabe, statt nur "expected true, received false". Damit
 * ist sofort erkennbar, ob z.B. ein 409-Duplikat die Testvorbereitung blockiert
 * hat, statt dass ein späterer, inhaltlich unabhängiger Schritt fehlschlägt.
 */
export async function expectOk(response: APIResponse, label: string): Promise<any> {
  const body = await response.json().catch(() => null)
  expect(
    response.ok(),
    `${label} fehlgeschlagen (HTTP ${response.status()}): ${body ? JSON.stringify(body).slice(0, 300) : 'kein JSON-Body'}`
  ).toBeTruthy()
  return body
}
