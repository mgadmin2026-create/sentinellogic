import { expect, test } from '@playwright/test'
import { createPlaywrightTestContact, expectOk } from './support/test-data'

test.describe('Kontakte: Archivieren', () => {
  test('archiviert einen Kontakt inkl. Aufgabe und stellt ihn wieder her', async ({ page, request }) => {
    const contact = createPlaywrightTestContact('ArchivTest')
    const fullName = `${contact.first_name} ${contact.last_name}`

    const createRes = await request.post('/api/kontakte', { data: contact })
    const { data: created } = await expectOk(createRes, 'Testkontakt anlegen')

    const taskRes = await request.post('/api/aufgaben', {
      data: { contact_id: created.id, titel: '[TEST] Aufgabe', 'fällig': '2026-12-31' },
    })
    await expectOk(taskRes, 'Testaufgabe anlegen')

    await page.goto('/kontakte')
    const tabelle = page.getByTestId('kontakte-tabelle')
    await page.getByPlaceholder('Nach Name, E-Mail oder Firma suchen…').fill(contact.last_name)
    await expect(tabelle.getByText(fullName)).toBeVisible()

    await page.getByTitle('Archivieren').click()
    await expect(page.getByText('Kontakt archivieren?')).toBeVisible()
    await page.getByText('Zugehörige Aufgaben ebenfalls archivieren').click()
    await page.getByRole('button', { name: 'Ja, archivieren' }).click()

    // Standardansicht: Kontakt verschwindet aus der Liste
    await expect(tabelle.getByText(fullName)).not.toBeVisible()

    // "Archivierte anzeigen" -> Kontakt erscheint wieder, mit Badge
    await page.getByText('Archivierte anzeigen').click()
    await expect(tabelle.getByText(fullName)).toBeVisible()
    await expect(tabelle.getByText('Archiviert', { exact: true })).toBeVisible()

    // Verknüpfte Aufgabe wurde mitarchiviert
    const detailRes = await request.get(`/api/kontakte/${created.id}`)
    const detailJson = await detailRes.json()
    expect(detailJson.data.tasks[0].archived_at).toBeTruthy()

    // Wiederherstellen
    await page.getByTitle('Wiederherstellen').click()
    await page.getByText('Archivierte anzeigen').click()
    await expect(tabelle.getByText(fullName)).toBeVisible()

    const restoredRes = await request.get(`/api/kontakte/${created.id}`)
    const restoredJson = await restoredRes.json()
    expect(restoredJson.data.archived_at).toBeNull()
  })
})
