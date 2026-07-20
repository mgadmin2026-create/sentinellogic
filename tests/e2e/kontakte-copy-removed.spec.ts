import { expect, test } from '@playwright/test'
import { applyTestCaseControl } from './support/test-control'

test.describe('Kontakte: Kopieren entfernt', () => {
  applyTestCaseControl('E2E-007')

  test('zeigt keinen Kopieren-Button mehr in der Kontaktliste', async ({ page }) => {
    await page.goto('/kontakte')
    await expect(page.getByTitle('Kopieren')).toHaveCount(0)
    await expect(page.getByLabel('Kopieren')).toHaveCount(0)
  })
})
