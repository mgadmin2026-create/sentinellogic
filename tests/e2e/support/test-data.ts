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

/** Erzeugt ausschließlich synthetische, sofort erkennbare Kontaktdaten. */
export function createPlaywrightTestContact(
  scenario: string,
  suffix = 'contact'
): PlaywrightTestContact {
  const runId = process.env.PLAYWRIGHT_RUN_ID
  if (!runId) {
    throw new Error('PLAYWRIGHT_RUN_ID fehlt. globalSetup wurde nicht ausgeführt.')
  }

  const contactMarker = `${runId}.${normalizeMarker(suffix)}`
  return {
    first_name: TEST_FIRST_NAME,
    last_name: scenario,
    company_name: `${TEST_COMPANY_PREFIX} ${scenario}`,
    email: `pw+${contactMarker}@example.invalid`,
    source: 'manuell',
    automation_disabled: true,
  }
}
