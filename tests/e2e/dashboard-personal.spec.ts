import { expect, test } from '@playwright/test'
import { applyTestCaseControl } from './support/test-control'

function json(body: unknown) {
  return { status: 200, contentType: 'application/json', body: JSON.stringify(body) }
}

test.describe('Persönliches Mitarbeiterdashboard', () => {
  applyTestCaseControl('E2E-022')

  test('zeigt den persönlichen Arbeitsvorrat und schaltet für Admins auf die Team-Sicht', async ({ page }) => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    const todayKey = today.toISOString().slice(0, 10)
    const yesterdayKey = yesterday.toISOString().slice(0, 10)

    await page.route('**/api/me', (route) => route.fulfill(json({
      success: true,
      data: { id: '00000000-0000-4000-8000-000000000022', name: 'Test Admin', email: 'admin@example.invalid', role: 'admin' },
    })))

    await page.route('**/api/kontakte?**', (route) => {
      const personal = route.request().url().includes('assigned_user_id=')
      const ownContacts = [
        { id: 'kontakt-eigen', first_name: '[TEST]', last_name: 'Dashboard Eigen', status: 'customer', pipeline_stage: 'sales_talk', created_at: '2026-08-10T09:00:00.000Z' },
        { id: 'kontakt-pipeline', first_name: '[TEST]', last_name: 'Dashboard Pipeline', status: 'qualified', pipeline_stage: 'data_gathering', created_at: '2026-08-09T09:00:00.000Z' },
      ]
      const teamContact = { id: 'kontakt-team', first_name: '[TEST]', last_name: 'Dashboard Team', status: 'new', pipeline_stage: 'lead_in', created_at: '2026-08-11T09:00:00.000Z' }
      return route.fulfill(json({ success: true, data: personal ? ownContacts : [...ownContacts, teamContact] }))
    })

    await page.route('**/api/aufgaben?**', (route) => route.fulfill(json({
      success: true,
      data: [
        { id: 'task-overdue', titel: '[TEST] Überfällige Dashboard-Aufgabe', status: 'offen', 'priorität': 'hoch', 'fällig': yesterdayKey, contact: null },
        { id: 'task-today', titel: '[TEST] Heutige Dashboard-Aufgabe', status: 'offen', 'priorität': 'mittel', 'fällig': todayKey, contact: null },
      ],
    })))

    await page.route('**/api/aktivitaeten?**', (route) => route.fulfill(json({ success: true, data: [] })))

    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { name: /Guten (Morgen|Tag|Abend), Test/ })).toBeVisible()
    await expect(page.getByText('[TEST] Überfällige Dashboard-Aufgabe')).toBeVisible()
    await expect(page.getByText('[TEST] Dashboard Eigen')).toBeVisible()
    await expect(page.getByRole('heading', { name: /Meine Pipeline/ })).toBeVisible()

    await page.getByRole('button', { name: 'Team', exact: true }).click()
    await expect(page.getByText('[TEST] Dashboard Team')).toBeVisible()
    await expect(page.getByRole('heading', { name: /Team-Pipeline/ })).toBeVisible()
  })
})
