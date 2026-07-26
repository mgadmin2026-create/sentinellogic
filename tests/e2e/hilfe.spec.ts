import { expect, test } from '@playwright/test'
import { createPlaywrightTestContact, expectOk } from './support/test-data'
import { applyTestCaseControl } from './support/test-control'

// Rein lesende Tests für das Hilfe-System — keine Testdaten-Bereinigung nötig
// (der Testkontakt dient nur als stabile Zielseite für die kachel-genaue Hilfe).

test.describe('Kontextsensitive Hilfe', () => {
  applyTestCaseControl('E2E-017')

  test('öffnet die kachel-spezifische Hilfe per Symbol und die Seiten-Standardhilfe per Taste "?"', async ({ page, request }) => {
    const contact = createPlaywrightTestContact('HilfeSystem')
    const createRes = await request.post('/api/kontakte', { data: contact })
    const { data: created } = await expectOk(createRes, 'Testkontakt anlegen')

    await page.goto(`/kontakte/${created.id}`)

    await page.getByRole('button', { name: 'Hilfe: Vertriebsprozess (12 Schritte)' }).click()
    await expect(page.getByRole('dialog', { name: /Vertriebsprozess \(12 Schritte\)/ })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).not.toBeVisible()

    await page.locator('body').click({ position: { x: 10, y: 10 } })
    await page.keyboard.press('?')
    await expect(page.getByRole('dialog', { name: /Kontaktdetail — Überblick/ })).toBeVisible()
  })

  test('öffnet keine Hilfe, wenn "?" in einem Textfeld getippt wird', async ({ page, request }) => {
    const contact = createPlaywrightTestContact('HilfeSystemInput')
    const createRes = await request.post('/api/kontakte', { data: contact })
    const { data: created } = await expectOk(createRes, 'Testkontakt anlegen')

    await page.goto(`/kontakte/${created.id}`)

    const tagInput = page.getByPlaceholder('Tag hinzufügen…')
    await tagInput.click()
    await tagInput.pressSequentially('?')
    await expect(tagInput).toHaveValue('?')
    await expect(page.getByRole('dialog')).not.toBeVisible()
  })

  test('durchsucht die Hilfe-Seite und filtert Artikel', async ({ page }) => {
    await page.goto('/hilfe')
    await expect(page.getByRole('heading', { name: 'Kontaktdetail', exact: true })).toBeVisible()

    await page.getByPlaceholder('Hilfe durchsuchen…').fill('Placetel')
    await expect(page.getByRole('heading', { name: 'Kachel „Telefonie & Sync"' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Kachel „Dokumente"' })).not.toBeVisible()
  })
})
