export const TEST_FIRST_NAME = '[TEST]'
export const TEST_COMPANY_PREFIX = '[TESTDATEN]'
export const TEST_EMAIL_DOMAIN = 'example.invalid'

const TEST_RUN_ID_PATTERN = /^[a-zA-Z0-9._:-]{1,80}$/

interface ContactTestMarkers {
  first_name?: unknown
  email?: unknown
  company_name?: unknown
}

export interface TestContactDetection {
  hasTestSignal: boolean
  isTestData: boolean
  testRunId: string | null
}

/**
 * Erkennt Testkontakte nur an der vollständigen, sichtbar eindeutigen Konvention.
 * Einzelne Marker reichen nicht, damit reale Kontakte nie versehentlich bereinigt werden.
 */
export function detectTestContact(input: ContactTestMarkers): TestContactDetection {
  const firstName = String(input.first_name ?? '').trim()
  const email = String(input.email ?? '').trim().toLowerCase()
  const companyName = String(input.company_name ?? '').trim()

  const hasTestFirstName = firstName === TEST_FIRST_NAME
  const hasTestCompany = companyName.startsWith(TEST_COMPANY_PREFIX)
  const emailMatch = email.match(/^pw\+([a-zA-Z0-9._:-]{1,80})@example\.invalid$/)
  const hasTestEmail = email.endsWith(`@${TEST_EMAIL_DOMAIN}`)
  const testRunId = emailMatch?.[1] ?? null
  const validRunId = Boolean(testRunId && TEST_RUN_ID_PATTERN.test(testRunId))

  return {
    hasTestSignal: hasTestFirstName || hasTestCompany || hasTestEmail,
    isTestData: hasTestFirstName && hasTestCompany && validRunId,
    testRunId: validRunId ? testRunId : null,
  }
}
