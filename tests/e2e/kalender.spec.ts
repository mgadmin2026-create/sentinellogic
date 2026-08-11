import { expect, test } from '@playwright/test'
import { applyTestCaseControl } from './support/test-control'

test.describe('Kalender und Terminverwaltung', () => {
  applyTestCaseControl('E2E-024')

  test('wechselt Kalenderansichten und legt einen Termin über die Kontaktsuche an', async ({ page }) => {
    let createdPayload: Record<string, unknown> | null = null
    let termine: Array<Record<string, unknown>> = []

    await page.route('**/api/termine**', async (route) => {
      if (route.request().method() === 'POST') {
        createdPayload = route.request().postDataJSON()
        termine = [{ ...createdPayload, id: 'termin-test-024', contact: { id: 'kontakt-test-024', first_name: '[TEST]', last_name: 'Kalenderkontakt' } }]
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ success: true, data: termine[0] }) })
        return
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: termine }) })
    })
    await page.route('**/api/aufgaben?**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) }))
    await page.route('**/api/kontakte?**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [{ id: 'kontakt-test-024', first_name: '[TEST]', last_name: 'Kalenderkontakt', email: 'kalender@example.invalid' }] }),
    }))
    await page.route('**/api/users', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [{ id: 'user-test-024', name: 'Test Admin' }] }),
    }))

    await page.goto('/kalender')
    await expect(page.getByRole('heading', { name: 'Kalender' })).toBeVisible()
    await expect(page.getByText('Meine Kalender')).toBeVisible()

    const viewSelect = page.getByRole('combobox')
    await expect(viewSelect).toHaveCount(1)
    await viewSelect.selectOption('monat')
    await expect(viewSelect).toHaveValue('monat')
    await viewSelect.selectOption('jahr')
    await expect(viewSelect).toHaveValue('jahr')

    await page.getByRole('button', { name: 'Neuer Termin' }).click()
    const appointmentDialog = page.getByTestId('termin-edit-modal')
    await appointmentDialog.getByPlaceholder('z.B. Beratungstermin').fill('[TEST] Beratungstermin')
    const contactInput = appointmentDialog.getByTestId('termin-contact-select').getByPlaceholder('Kontakt suchen…')
    await contactInput.fill('Kalenderkontakt')
    await page.getByRole('button', { name: '[TEST] Kalenderkontakt' }).click()
    await expect(appointmentDialog.getByPlaceholder('Name oder E-Mail-Adresse')).toHaveValue('kalender@example.invalid')
    await appointmentDialog.getByRole('button', { name: 'Hinzufügen' }).click()
    await appointmentDialog.getByRole('button', { name: 'Termin erstellen' }).click()

    await expect.poll(() => createdPayload).not.toBeNull()
    expect(createdPayload).toMatchObject({
      titel: '[TEST] Beratungstermin',
      contact_id: 'kontakt-test-024',
    })
    expect((createdPayload?.teilnehmer as Array<{ email: string }>).some((item) => item.email === 'kalender@example.invalid')).toBeTruthy()
  })
})
