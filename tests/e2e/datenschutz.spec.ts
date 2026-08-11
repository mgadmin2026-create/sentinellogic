import { expect, test } from '@playwright/test'
import { applyTestCaseControl } from './support/test-control'

test.describe('Öffentliche Datenschutzerklärung', () => {
  applyTestCaseControl('E2E-026')

  test('ist ohne Anmeldung erreichbar und beschreibt Lead-Formulare sowie Betroffenenrechte', async ({ browser, baseURL }) => {
    const anonymousContext = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page = await anonymousContext.newPage()

    try {
      await page.goto(`${baseURL}/datenschutz`)
      await expect(page).toHaveURL(/\/datenschutz$/)
      await expect(page.getByRole('heading', { name: 'Datenschutzerklärung' })).toBeVisible()
      await expect(page.getByRole('heading', { name: '2. Erhebung über Facebook- und Instagram-Lead-Formulare' })).toBeVisible()
      await expect(page.getByRole('heading', { name: '6. Ihre Rechte' })).toBeVisible()
    } finally {
      await anonymousContext.close()
    }
  })
})
