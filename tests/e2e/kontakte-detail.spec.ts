import { expect, test } from '@playwright/test'
import { createPlaywrightTestContact, expectOk } from './support/test-data'
import { applyTestCaseControl } from './support/test-control'

test.describe('Kontaktdetail: Stammdaten bearbeiten', () => {
  applyTestCaseControl('E2E-003')

  test('bearbeitet Stammdaten und Status dauerhaft in der Kontaktdetailseite', async ({ page, request }) => {
    const contact = createPlaywrightTestContact('EditTest')
    const createRes = await request.post('/api/kontakte', { data: contact })
    const { data: created } = await expectOk(createRes, 'Testkontakt anlegen')
    const changedLastName = `${contact.last_name}-Geaendert`

    await page.goto(`/kontakte/${created.id}`)
    // "Bearbeiten" öffnet den Drawer mit allen Feldern
    await page.getByTestId('contact-edit-toggle').click()
    await page.getByTestId('contact-field-last_name').locator('input').fill(changedLastName)
    await page.getByTestId('contact-field-status').locator('select').selectOption('qualified')
    await page.getByRole('button', { name: 'Speichern', exact: true }).click()

    await expect(page.getByRole('heading', { name: `${contact.first_name} ${changedLastName}` })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { name: `${contact.first_name} ${changedLastName}` })).toBeVisible()
    // Status-Badge in der Kopfzeile + persistierter Wert im Edit-Drawer
    await expect(page.getByText('Qualifiziert', { exact: true })).toBeVisible()
    await page.getByTestId('contact-edit-toggle').click()
    await expect(page.getByTestId('contact-field-status').locator('select')).toHaveValue('qualified')

    const detailRes = await request.get(`/api/kontakte/${created.id}`)
    const detailJson = await expectOk(detailRes, 'Geänderten Testkontakt laden')
    expect(detailJson.data).toMatchObject({ last_name: changedLastName, status: 'qualified' })
  })
})

test.describe('Kontaktverwaltung: Detailnavigation', () => {
  applyTestCaseControl('E2E-011')

  test('öffnet einen Suchtreffer und zeigt die zentralen Kontaktdetails', async ({ page, request }) => {
    const contact = createPlaywrightTestContact('DetailNavigation')
    const createRes = await request.post('/api/kontakte', { data: contact })
    const { data: created } = await expectOk(createRes, 'Testkontakt anlegen')

    await page.goto('/kontakte')
    await page.getByPlaceholder('Nach Name, E-Mail oder Firma suchen…').fill(contact.email)
    const contactRow = page.getByTestId('kontakte-tabelle').getByTestId(`kontakt-row-${created.id}`)
    await expect(contactRow).toBeVisible()
    await contactRow.click()

    await expect(page).toHaveURL(`/kontakte/${created.id}`)
    await expect(page.getByRole('heading', { name: `${contact.first_name} ${contact.last_name}` })).toBeVisible()
    // Firma erscheint in der Kopfzeilen-Meta
    await expect(page.getByText(contact.company_name).first()).toBeVisible()
    await expect(page.getByTitle(`E-Mail an ${contact.email}`)).toBeVisible()
    // Zentrale Kacheln sichtbar
    await expect(page.getByText('✓ Nächste Aufgabe')).toBeVisible()
    await expect(page.getByText('📝 Aktivitäten')).toBeVisible()
    await expect(page.getByText('🛡️ Versicherung & Verträge')).toBeVisible()
  })
})

test.describe('Kontaktdetail: Aufgaben', () => {
  applyTestCaseControl('E2E-012')

  test('legt eine Aufgabe direkt in der Kontaktdetailseite an', async ({ page, request }) => {
    const contact = createPlaywrightTestContact('DetailTask')
    const createRes = await request.post('/api/kontakte', { data: contact })
    const { data: created } = await expectOk(createRes, 'Testkontakt anlegen')
    const taskTitle = `[TEST] Rückruf ${process.env.PLAYWRIGHT_RUN_ID}`

    await page.goto(`/kontakte/${created.id}`)
    await page.getByRole('button', { name: '+ Neue Aufgabe' }).click()
    await page.getByTestId('task-title').fill(taskTitle)
    await page.getByTestId('task-description').fill('Automatisch erzeugte Testaufgabe für die Kontaktdetailseite.')
    await page.getByTestId('task-due-date').fill('2026-12-31')
    await page.getByTestId('task-priority').selectOption('hoch')
    await page.getByTestId('task-assigned-user').selectOption({ index: 1 })
    await page.getByRole('button', { name: 'Aufgabe erstellen' }).click()

    // Neue Aufgabe erscheint in der "Nächste Aufgabe"-Kachel
    await expect(page.getByText(taskTitle, { exact: true })).toBeVisible()

    // Komplette Historie im Aufgaben-Drawer inkl. Priorität
    await page.getByRole('button', { name: /Historie \(/ }).click()
    await expect(page.getByRole('dialog').getByText(taskTitle)).toBeVisible()
    await expect(page.getByRole('dialog').getByText('Hoch')).toBeVisible()

    const detailRes = await request.get(`/api/kontakte/${created.id}`)
    const detailJson = await expectOk(detailRes, 'Kontakt mit Aufgabe laden')
    expect(detailJson.data.tasks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        contact_id: created.id,
        titel: taskTitle,
        priorität: 'hoch',
        status: 'offen',
      }),
    ]))
  })
})
