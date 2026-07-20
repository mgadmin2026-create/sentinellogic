import { expect, test } from '@playwright/test'
import { createPlaywrightTestContact, expectOk } from './support/test-data'
import { applyTestCaseControl } from './support/test-control'

test.describe('Kontakte: Export', () => {
  applyTestCaseControl('E2E-009')

  test('CSV-Export enthält die gefilterten Kontaktdaten', async ({ page, request }) => {
    const contact = createPlaywrightTestContact('ExportTest')
    const createRes = await request.post('/api/kontakte', { data: contact })
    await expectOk(createRes, 'Testkontakt anlegen')

    await page.goto('/kontakte')
    await page.getByPlaceholder('Nach Name, E-Mail oder Firma suchen…').fill(contact.last_name)
    await expect(page.getByTestId('kontakte-tabelle').getByText(`${contact.first_name} ${contact.last_name}`)).toBeVisible()

    await page.getByRole('button', { name: /Exportieren/ }).click()
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Als CSV' }).click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/\.csv$/)
    const stream = await download.createReadStream()
    const chunks: Buffer[] = []
    for await (const chunk of stream) chunks.push(chunk as Buffer)
    const content = Buffer.concat(chunks).toString('utf-8')
    expect(content).toContain(contact.email)
  })

  test('Excel- und PDF-Export liefern herunterladbare Dateien', async ({ page, request }) => {
    const contact = createPlaywrightTestContact('ExportSmokeTest')
    const createRes = await request.post('/api/kontakte', { data: contact })
    await expectOk(createRes, 'Testkontakt anlegen')

    await page.goto('/kontakte')
    await page.getByPlaceholder('Nach Name, E-Mail oder Firma suchen…').fill(contact.last_name)
    await expect(page.getByTestId('kontakte-tabelle').getByText(`${contact.first_name} ${contact.last_name}`)).toBeVisible()

    for (const [label, ext] of [['Als XLSX', 'xlsx'], ['Als PDF', 'pdf']] as const) {
      await page.getByRole('button', { name: /Exportieren/ }).click()
      const downloadPromise = page.waitForEvent('download')
      await page.getByRole('button', { name: label }).click()
      const download = await downloadPromise
      expect(download.suggestedFilename()).toMatch(new RegExp(`\\.${ext}$`))
    }
  })
})
