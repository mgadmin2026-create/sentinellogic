import { randomUUID } from 'crypto'
import { chromium, type FullConfig } from '@playwright/test'

export const ADMIN_STORAGE_STATE = 'tests/e2e/.auth/admin-state.json'

function getBaseUrl(config: FullConfig): string {
  const configuredUrl = config.projects[0]?.use?.baseURL
  if (typeof configuredUrl !== 'string') {
    throw new Error('Playwright-Testziel ist nicht konfiguriert.')
  }

  const url = new URL(configuredUrl)
  const isLocal = ['localhost', '127.0.0.1', '::1'].includes(url.hostname)
  if (!isLocal && url.protocol !== 'https:') {
    throw new Error('Externe Playwright-Testziele müssen HTTPS verwenden.')
  }

  return url.origin
}

/** Bereinigt vor jedem Lauf ausschließlich technisch markierte Testdaten. */
export default async function globalSetup(config: FullConfig) {
  const baseUrl = getBaseUrl(config)
  const cleanupToken = process.env.TEST_DATA_CLEANUP_TOKEN

  if (!cleanupToken || cleanupToken.length < 32) {
    throw new Error('TEST_DATA_CLEANUP_TOKEN fehlt oder ist zu kurz.')
  }

  const configuredRunId = process.env.PLAYWRIGHT_RUN_ID
  const runId = configuredRunId && /^[a-zA-Z0-9._:-]{1,100}$/.test(configuredRunId)
    ? configuredRunId
    : `pw-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${randomUUID().slice(0, 8)}`
  const response = await fetch(`${baseUrl}/api/test-environment`, {
    method: 'POST',
    headers: {
      'x-test-cleanup-token': cleanupToken,
      'x-test-run-id': runId,
    },
  })

  if (!response.ok) {
    throw new Error(`Testdaten-Bereinigung wurde blockiert (HTTP ${response.status}).`)
  }

  process.env.PLAYWRIGHT_RUN_ID = runId

  await loginAsTestAdmin(baseUrl)
}

/**
 * Die App verlangt seit der Benutzerkonten-Einführung eine Session für so
 * gut wie jede Seite/API. Statt jeden Test einen eigenen Login-Flow
 * durchspielen zu lassen, meldet sich global-setup einmalig über den echten
 * Login-Formular-Flow an und speichert die Session (Cookies) als
 * storageState — playwright.config.ts lädt diese Datei für alle Tests.
 */
async function loginAsTestAdmin(baseUrl: string) {
  const email = process.env.PLAYWRIGHT_TEST_EMAIL
  const password = process.env.PLAYWRIGHT_TEST_PASSWORD

  if (!email || !password) {
    throw new Error('PLAYWRIGHT_TEST_EMAIL / PLAYWRIGHT_TEST_PASSWORD fehlen — für Logins in der Testsuite erforderlich.')
  }

  const browser = await chromium.launch()
  try {
    const context = await browser.newContext()
    const page = await context.newPage()

    await page.goto(`${baseUrl}/login`)
    await page.locator('input[name="email"]').fill(email)
    await page.locator('input[name="password"]').fill(password)
    await page.getByRole('button', { name: 'Anmelden' }).click()

    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 })

    await context.storageState({ path: ADMIN_STORAGE_STATE })
  } finally {
    await browser.close()
  }
}
