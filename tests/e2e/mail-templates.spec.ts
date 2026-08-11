import { expect, test } from '@playwright/test'
import { applyTestCaseControl } from './support/test-control'

interface Template {
  id: string
  name: string
  subject: string
  body: string
  created_at: string
  updated_at: string
}

test.describe('E-Mail-Vorlagenverwaltung', () => {
  applyTestCaseControl('E2E-023')

  test('legt eine Vorlage an, bearbeitet sie und löscht sie wieder', async ({ page }) => {
    let templates: Template[] = []

    await page.route('**/api/mail-templates**', async (route) => {
      const request = route.request()
      const method = request.method()
      const id = new URL(request.url()).pathname.split('/').at(-1)

      if (method === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: templates }) })
        return
      }

      if (method === 'POST') {
        const payload = request.postDataJSON() as Pick<Template, 'name' | 'subject' | 'body'>
        const created = { ...payload, id: 'template-test-023', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
        templates = [created]
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ success: true, data: created }) })
        return
      }

      if (method === 'PATCH') {
        const payload = request.postDataJSON() as Pick<Template, 'name' | 'subject' | 'body'>
        templates = templates.map((template) => template.id === id ? { ...template, ...payload, updated_at: new Date().toISOString() } : template)
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: templates[0] }) })
        return
      }

      templates = templates.filter((template) => template.id !== id)
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) })
    })

    await page.goto('/einstellungen/mail-vorlagen')
    await page.getByRole('button', { name: '+ Neue Vorlage' }).click()
    let templateDialog = page.getByRole('heading', { name: 'Neue Vorlage' }).locator('..')
    await templateDialog.getByPlaceholder('z.B. Datenanfrage').fill('[TEST] Datenanfrage')
    await templateDialog.getByRole('textbox').nth(1).fill('Unterlagen für {{vorname}}')
    await templateDialog.getByRole('textbox').nth(2).fill('Hallo {{vorname}}, bitte senden Sie die Unterlagen.')
    await templateDialog.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('[TEST] Datenanfrage')).toBeVisible()

    await page.getByTitle('Bearbeiten').click()
    templateDialog = page.getByRole('heading', { name: 'Vorlage bearbeiten' }).locator('..')
    await templateDialog.getByPlaceholder('z.B. Datenanfrage').fill('[TEST] Datenanfrage aktualisiert')
    await templateDialog.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('[TEST] Datenanfrage aktualisiert')).toBeVisible()

    page.once('dialog', (dialog) => dialog.accept())
    await page.getByTitle('Löschen').click()
    await expect(page.getByText('Noch keine Vorlagen angelegt.')).toBeVisible()
  })
})
