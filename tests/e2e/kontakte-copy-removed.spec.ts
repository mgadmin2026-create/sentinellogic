import { expect, test } from '@playwright/test'

test.describe('Kontakte: Kopieren entfernt', () => {
  test('zeigt keinen Kopieren-Button mehr in der Kontaktliste', async ({ page }) => {
    await page.goto('/kontakte')
    await expect(page.getByTitle('Kopieren')).toHaveCount(0)
    await expect(page.getByLabel('Kopieren')).toHaveCount(0)
  })
})
