import { expect, test } from '@playwright/test'
import { createPlaywrightTestContact, expectOk } from './support/test-data'
import { applyTestCaseControl } from './support/test-control'

test.describe('Kontakte: Neuanlage', () => {
  applyTestCaseControl('E2E-002')

  test('legt einen markierten Kontakt an und findet ihn über die Suche', async ({ page, request }) => {
    const contact = createPlaywrightTestContact('CreateTest')
    const fullName = `${contact.first_name} ${contact.last_name}`

    await page.goto('/kontakte')
    await page.getByRole('button', { name: 'Neu', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Neuer Kontakt' })).toBeVisible()

    await page.getByPlaceholder('Max').fill(contact.first_name)
    await page.getByPlaceholder('Mustermann').fill(contact.last_name)
    await page.getByPlaceholder('max@example.com').fill(contact.email)
    await page.getByPlaceholder('Beispiel GmbH').fill(contact.company_name)
    await page.getByRole('button', { name: 'Kontakt erstellen' }).click()

    await expect(page.getByRole('heading', { name: 'Neuer Kontakt' })).not.toBeVisible()
    await page.getByPlaceholder('Nach Name, E-Mail oder Firma suchen…').fill(contact.email)
    const tabelle = page.getByTestId('kontakte-tabelle')
    await expect(tabelle.getByText(fullName)).toBeVisible()
    await expect(tabelle.getByText(contact.email)).toBeVisible()
    await expect(tabelle.getByText('Testdaten', { exact: true })).toBeVisible()

    const searchRes = await request.get(`/api/kontakte?search=${encodeURIComponent(contact.email)}`)
    const searchJson = await expectOk(searchRes, 'Angelegten Testkontakt suchen')
    expect(searchJson.data).toEqual(expect.arrayContaining([
      expect.objectContaining({
        first_name: contact.first_name,
        last_name: contact.last_name,
        email: contact.email,
        company_name: contact.company_name,
        is_test_data: true,
      }),
    ]))
  })
})
