import { expect, test } from '@playwright/test'
import { createPlaywrightTestContact, expectOk } from './support/test-data'
import { applyTestCaseControl } from './support/test-control'

test.describe('Kontaktdetail: Beitragsübersicht', () => {
  applyTestCaseControl('E2E-018')

  test('berechnet Differenz und Summen live und speichert die Beitragsübersicht dauerhaft', async ({ page, request }) => {
    const contact = createPlaywrightTestContact('Beitragsuebersicht')
    const createRes = await request.post('/api/kontakte', { data: { ...contact, kontakt_typ: 'privat' } })
    const { data: created } = await expectOk(createRes, 'Testkontakt anlegen')

    await page.goto(`/kontakte/${created.id}`)
    await expect(page.getByText('Noch keine Beitragsübersicht angelegt.')).toBeVisible()
    await page.getByRole('button', { name: 'Bearbeiten →' }).click()

    const dialog = page.getByRole('dialog', { name: '📊 Beitragsübersicht bearbeiten' })
    const firstRow = dialog.locator('tbody tr').first()
    // Beim ersten Öffnen mit den Privat-Sparten vorbelegt (SPARTEN_PRIVAT[0])
    await expect(firstRow.locator('input[type="text"]').first()).toHaveValue('Privathaftpflicht')
    await firstRow.locator('input[type="number"]').nth(0).fill('98')
    await firstRow.locator('input[type="number"]').nth(1).fill('79')
    // Differenz wird live berechnet, nie händisch eingetragen
    await expect(firstRow.getByText('+19 €')).toBeVisible()

    await dialog.getByRole('button', { name: 'Speichern', exact: true }).click()
    await expect(dialog).toBeHidden()

    await expect(page.getByText('98 €', { exact: true })).toBeVisible()
    await expect(page.getByText('79 €', { exact: true })).toBeVisible()
    await expect(page.getByText('Ersparnis 19 € / Jahr', { exact: false })).toBeVisible()

    // Eine laufende Übersicht pro Kontakt: Reload bestätigt Persistenz ohne Versionierung
    await page.reload()
    await expect(page.getByText('98 €', { exact: true })).toBeVisible()
    await expect(page.getByText('79 €', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Bearbeiten →' }).click()
    const dialogAfterReload = page.getByRole('dialog', { name: '📊 Beitragsübersicht bearbeiten' })
    const firstRowAfterReload = dialogAfterReload.locator('tbody tr').first()
    await expect(firstRowAfterReload.locator('input[type="number"]').nth(0)).toHaveValue('98')
    await expect(firstRowAfterReload.locator('input[type="number"]').nth(1)).toHaveValue('79')

    const pdfRes = await request.get(`/api/kontakte/${created.id}/beitragsuebersicht/pdf`)
    expect(pdfRes.ok(), `PDF-Download fehlgeschlagen (HTTP ${pdfRes.status()})`).toBeTruthy()
    expect(pdfRes.headers()['content-type']).toBe('application/pdf')
  })
})
