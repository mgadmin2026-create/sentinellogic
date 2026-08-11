import { expect, test } from '@playwright/test'
import { applyTestCaseControl } from './support/test-control'

test.describe('Zugriffsschutz ohne Anmeldung', () => {
  applyTestCaseControl('E2E-004')

  test('leitet geschützte Seiten zum Login um und blockiert geschützte APIs', async ({ browser, baseURL }) => {
    const anonymousContext = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page = await anonymousContext.newPage()

    try {
      await page.goto(`${baseURL}/dashboard`)
      await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/)
      await expect(page.getByRole('button', { name: 'Anmelden' })).toBeVisible()

      const apiResponse = await anonymousContext.request.get(`${baseURL}/api/kontakte`)
      expect(apiResponse.status()).toBe(401)
      await expect(apiResponse.json()).resolves.toMatchObject({ success: false, error: 'Nicht angemeldet' })
    } finally {
      await anonymousContext.close()
    }
  })
})
