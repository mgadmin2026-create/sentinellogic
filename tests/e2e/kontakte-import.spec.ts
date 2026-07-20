import { expect, test } from '@playwright/test'
import { createPlaywrightTestContact } from './support/test-data'

test.describe('Kontakte: Import erweitert', () => {
  test('Import-Button ist auf /kontakte sichtbar und übernimmt erweiterte Felder', async ({ page, request }) => {
    const contact = createPlaywrightTestContact('ImportTest')
    const csv = [
      'Vorname,Nachname,E-Mail,Firma,Sparte',
      `${contact.first_name},${contact.last_name},${contact.email},${contact.company_name},PKV`,
    ].join('\n')

    await page.goto('/kontakte')
    await expect(page.getByRole('button', { name: 'Importieren' })).toBeVisible()
    await page.getByRole('button', { name: 'Importieren' }).click()

    await expect(page.getByText('Kontakte importieren (CSV)')).toBeVisible()
    await page.setInputFiles('input[type="file"]', {
      name: 'import-test.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv, 'utf-8'),
    })

    // Spalten-Mapping: "Sparte" muss automatisch auf das Feld sparte gemappt sein
    // (Beweis, dass die Feldliste über die ursprünglichen 16 Basisfelder hinausgeht)
    await expect(page.getByText('Spalten zuordnen')).toBeVisible()

    await page.getByRole('button', { name: /Leads importieren/ }).click()
    await expect(page.getByText(/Leads importiert/)).toBeVisible()

    const res = await request.get(`/api/kontakte?search=${encodeURIComponent(contact.last_name)}`)
    const json = await res.json()
    expect(json.data[0]?.sparte).toBe('PKV')
  })
})
