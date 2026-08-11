import { expect, test } from '@playwright/test'
import { applyTestCaseControl } from './support/test-control'

test.describe('Automatisierungs- und Sync-Control-Center', () => {
  applyTestCaseControl('E2E-025')

  test('zeigt Integrationszustände, Batch-Details sowie Retry- und Pause-Aktionen', async ({ page }) => {
    const actions: string[] = []
    const config = { enabled: true, interval_type: '15min', daily_hour: 8, weekly_day: 1, weekly_hour: 8, last_sync_at: null, next_sync_at: null }

    await page.route('**/api/sync-config', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(config) }))
    await page.route('**/api/dialfire-sync-config', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(config) }))
    await page.route('**/api/sync-runs/summary', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          facebook: { total: 2, success: 2, failed: 0, retrying: 0, lastRun: '2026-08-11T08:00:00.000Z', lastStatus: 'success' },
          klicktipp: { total: 2, success: 1, failed: 1, retrying: 1, lastRun: '2026-08-11T08:15:00.000Z', lastStatus: 'retrying' },
        },
      }),
    }))
    await page.route('**/api/sync-runs/run-batch/detail', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { summary: '2 Kontakte verarbeitet', items: [{ id: 'item-1', label: '[TEST] Importkontakt', status: 'success', attemptCount: 1, maxAttempts: 3 }] } }),
    }))
    await page.route('**/api/sync-runs/run-retry/retry', async (route) => {
      actions.push('retry')
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) })
    })
    await page.route('**/api/sync-runs/run-retry/pause', async (route) => {
      actions.push('pause')
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) })
    })
    await page.route('**/api/sync-runs?**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          runs: [
            { id: 'run-batch', run_kind: 'batch', integration: 'csv_import', trigger_type: 'manual', status: 'success', attempt_count: 1, max_attempts: 3, error_class: null, error_detail: null, started_at: '2026-08-11T08:00:00.000Z', finished_at: '2026-08-11T08:01:00.000Z', next_retry_at: null, contact: null },
            { id: 'run-retry', run_kind: 'item', integration: 'klicktipp', trigger_type: 'rule', status: 'retrying', attempt_count: 1, max_attempts: 3, error_class: 'rate_limit', error_detail: 'Sicher simulierter Testfehler', started_at: '2026-08-11T08:15:00.000Z', finished_at: null, next_retry_at: '2026-08-11T08:30:00.000Z', contact: { id: 'kontakt-retry', first_name: '[TEST]', last_name: 'Retrykontakt' } },
          ],
        },
      }),
    }))

    await page.goto('/sync')
    await expect(page.getByRole('heading', { name: 'Synchronisation' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Automatisierungs-Läufe' })).toBeVisible()

    const batchRow = page.getByRole('row').filter({ hasText: 'CSV-Import' })
    await expect(batchRow).toHaveCount(1)
    await batchRow.click()
    await expect(page.getByText('2 Kontakte verarbeitet')).toBeVisible()
    await expect(page.getByText('[TEST] Importkontakt')).toBeVisible()

    await page.getByRole('button', { name: 'Retry jetzt' }).click()
    await expect.poll(() => actions).toContain('retry')
    await page.getByRole('button', { name: 'Pause' }).click()
    await expect.poll(() => actions).toContain('pause')
  })
})
