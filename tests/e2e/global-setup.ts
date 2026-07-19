import { randomUUID } from 'crypto'
import type { FullConfig } from '@playwright/test'

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

  const runId = `pw-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${randomUUID().slice(0, 8)}`
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
}
