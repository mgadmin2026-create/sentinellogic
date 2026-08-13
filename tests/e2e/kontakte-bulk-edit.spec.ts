import { expect, test } from '@playwright/test'
import { createPlaywrightTestContact, expectOk } from './support/test-data'
import { applyTestCaseControl } from './support/test-control'

test.describe('Kontakte: Mehrfachbearbeitung', () => {
  applyTestCaseControl('E2E-030')

  test('ändert mehrere ausgewählte Kontakte kontrolliert in einem Schritt', async ({ page, request }) => {
    const firstResponse = await request.post('/api/kontakte', {
      data: createPlaywrightTestContact('Mehrfachbearbeitung', 'eins'),
    })
    const secondResponse = await request.post('/api/kontakte', {
      data: createPlaywrightTestContact('Mehrfachbearbeitung', 'zwei'),
    })
    const { data: firstContact } = await expectOk(firstResponse, 'Ersten Testkontakt anlegen')
    const { data: secondContact } = await expectOk(secondResponse, 'Zweiten Testkontakt anlegen')

    await page.goto('/kontakte?search=Mehrfachbearbeitung')
    await page.getByTestId(`kontakt-auswahl-${firstContact.id}`).check()
    await page.getByTestId(`kontakt-auswahl-${secondContact.id}`).check()

    const actionBar = page.getByTestId('kontakte-sammelaktionen')
    await expect(actionBar).toContainText('2 Kontakte ausgewählt')
    await actionBar.getByRole('button', { name: 'Bearbeiten' }).click()

    const dialog = page.getByTestId('kontakte-sammelbearbeitung-dialog')
    await expect(dialog).toContainText('2 Kontakte ausgewählt')
    await dialog.getByTestId('sammelbearbeitung-feld').selectOption('status')
    await dialog.getByTestId('sammelbearbeitung-wert').selectOption('qualified')
    await dialog.getByRole('button', { name: 'Änderung prüfen' }).click()
    await expect(dialog).toContainText('Bitte bestätigen')
    await dialog.getByRole('button', { name: 'Jetzt anwenden' }).click()

    await expect(dialog.getByRole('heading', { name: 'Sammelbearbeitung abgeschlossen' })).toBeVisible()
    await expect(dialog).toContainText('Geändert')
    await expect(dialog).toContainText('2')
    await expect(dialog).toContainText('Fehler')

    const firstDetail = await expectOk(await request.get(`/api/kontakte/${firstContact.id}`), 'Ersten Kontakt prüfen')
    const secondDetail = await expectOk(await request.get(`/api/kontakte/${secondContact.id}`), 'Zweiten Kontakt prüfen')
    expect(firstDetail.data.status).toBe('qualified')
    expect(secondDetail.data.status).toBe('qualified')
  })
})
