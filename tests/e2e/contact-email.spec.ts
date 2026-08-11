import { expect, test } from '@playwright/test'
import { createPlaywrightTestContact, expectOk } from './support/test-data'
import { applyTestCaseControl } from './support/test-control'

test.describe('Kontakt-E-Mail mit Vorlage, Cc/Bcc und Anhang', () => {
  applyTestCaseControl('E2E-027')

  test('befüllt Platzhalter und übergibt Versanddaten samt Anhang kontrolliert an die Serverroute', async ({ page, request }) => {
    const contact = createPlaywrightTestContact(`KontaktEmail-${Date.now()}`)
    const createResponse = await request.post('/api/kontakte', { data: contact })
    const { data: created } = await expectOk(createResponse, 'Testkontakt anlegen')
    let sentMultipart = ''

    await page.route('**/api/mail-templates', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [{ id: 'template-027', name: '[TEST] Begrüßung', subject: 'Hallo {{vorname}} {{nachname}}', body: 'Guten Tag {{name}} von {{firma}}.' }],
      }),
    }))
    await page.route(`**/api/kontakte/${created.id}/email`, async (route) => {
      sentMultipart = route.request().postData() ?? ''
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) })
    })

    await page.goto(`/kontakte/${created.id}`)
    await page.getByRole('button', { name: '✉️ E-Mail' }).click()
    const emailDialog = page.getByRole('heading', { name: /E-Mail schreiben/ }).locator('..').locator('..')
    await emailDialog.getByRole('combobox').selectOption('template-027')
    await expect(emailDialog.getByPlaceholder('Betreff…')).toHaveValue(`Hallo ${contact.first_name} ${contact.last_name}`)
    await expect(emailDialog.getByPlaceholder('Nachricht…')).toHaveValue(
      `Guten Tag ${contact.first_name} ${contact.last_name} von ${contact.company_name}.`,
    )

    await emailDialog.getByRole('button', { name: 'Cc/Bcc' }).click()
    await emailDialog.getByPlaceholder('cc@example.com, weitere@…', { exact: true }).fill('cc@example.invalid')
    await emailDialog.getByPlaceholder('bcc@example.com, weitere@…', { exact: true }).fill('bcc@example.invalid')
    await page.locator('#email-attachment-input').setInputFiles({
      name: 'TEST-Anhang.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Technisch markierter Testanhang'),
    })
    await expect(page.getByText('TEST-Anhang.txt')).toBeVisible()
    await emailDialog.getByRole('button', { name: '📤 Senden' }).click()

    await expect.poll(() => sentMultipart).toContain('cc@example.invalid')
    expect(sentMultipart).toContain('bcc@example.invalid')
    expect(sentMultipart).toContain('TEST-Anhang.txt')
    expect(sentMultipart).toContain(`Hallo ${contact.first_name} ${contact.last_name}`)
  })
})
