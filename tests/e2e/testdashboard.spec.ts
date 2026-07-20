import { expect, test } from '@playwright/test'

test.describe('Testdashboard', () => {
  test('zeigt Testfälle und den Live-sicheren Testbetrieb', async ({ page }) => {
    await page.goto('/testdashboard')

    await expect(page.getByRole('heading', { name: 'Testdashboard', level: 1 })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Test-Kennzahlen' })).toBeVisible()
    await expect(page.getByText('Testdashboard und Testbetrieb anzeigen')).toBeVisible()
    await expect(page.getByTestId('testcase-E2E-002-row').getByText('Noch nie durchgeführt')).toBeVisible()

    await page.getByTestId('testcase-E2E-001-toggle').click()
    await expect(page.getByRole('heading', { name: 'Testschritte' })).toBeVisible()
    await expect(page.getByText('Die Seite /testdashboard öffnen.')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Bisherige Durchführungen' })).toBeVisible()
    await expect(page.getByTestId('testcase-execution-history').getByRole('listitem')).not.toHaveCount(0)

    await page.getByTestId('testdashboard-tab-durchfuehrungen').click()
    await expect(page.getByTestId('testdashboard-tab-durchfuehrungen')).toHaveAttribute('aria-selected', 'true')
    const latestRunDetails = page.getByTestId('latest-test-run-details')
    await expect(latestRunDetails.getByRole('heading', { name: 'Einzeltests' })).toBeVisible()
    await expect(latestRunDetails.locator('[data-test-result-status]')).not.toHaveCount(0)

    await page.getByTestId('testdashboard-tab-umgebung').click()

    await expect(page.getByRole('heading', { name: 'Ablauf eines Live-sicheren Testlaufs' })).toBeVisible()
    await expect(page.getByText('Die Bereinigung verwendet niemals TRUNCATE.', { exact: false })).toBeVisible()
  })
})
