import { expect, test } from '@playwright/test'
import { applyTestCaseControl } from './support/test-control'
import { createPlaywrightTestContact, expectOk } from './support/test-data'

test.describe('Kontaktübersicht: Ansichten und Rücksprung', () => {
  applyTestCaseControl('E2E-028')

  test('behält Ansicht, Suche und Sortierung beim Rücksprung aus dem Kontakt', async ({ page, request }) => {
    const contact = createPlaywrightTestContact('FilterReturn')
    const createResponse = await request.post('/api/kontakte', { data: contact })
    const { data: created } = await expectOk(createResponse, 'Testkontakt anlegen')

    await page.goto(`/kontakte?view=leads&search=${encodeURIComponent(contact.email)}&sort=status&order=desc`)
    const leadsView = page.getByRole('button', { name: /Leads \(\d+\)/ })
    await expect(leadsView).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByPlaceholder('Nach Name, E-Mail oder Firma suchen…')).toHaveValue(contact.email)

    const row = page.getByTestId(`kontakt-row-${created.id}`)
    await expect(row).toBeVisible()
    await expect(row).toHaveClass(/bg-gray-50/)
    await row.click()
    await page.getByRole('link', { name: '← Zurück zur Übersicht' }).click()

    await expect(page).toHaveURL(/view=leads/)
    await expect(page).toHaveURL(/sort=status/)
    await expect(page).toHaveURL(/order=desc/)
    await expect(leadsView).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByPlaceholder('Nach Name, E-Mail oder Firma suchen…')).toHaveValue(contact.email)
  })

  test('zeigt vier Ansichtsbuttons, die reduzierte Filterleiste und die neue Standardansicht', async ({ page, request }) => {
    const olderContact = createPlaywrightTestContact('DefaultSort', 'older')
    const newerContact = createPlaywrightTestContact('DefaultSort', 'newer')
    const commonCompany = `TESTFIRMA ${olderContact.email.split('@')[0]}`
    olderContact.company_name = commonCompany
    newerContact.company_name = commonCompany
    const olderResponse = await request.post('/api/kontakte', { data: olderContact })
    const { data: olderCreated } = await expectOk(olderResponse, 'Älteren Testkontakt anlegen')
    const newerResponse = await request.post('/api/kontakte', { data: newerContact })
    const { data: newerCreated } = await expectOk(newerResponse, 'Neueren Testkontakt anlegen')

    await page.addInitScript(() => {
      localStorage.removeItem('kontakte-columns')
      localStorage.removeItem('kontakte-column-order')
      localStorage.removeItem('kontakte-sort-by')
      localStorage.removeItem('kontakte-sort-order')
    })
    await page.goto('/kontakte')

    const views = page.getByTestId('kontakte-ansichten')
    await expect(views.getByRole('button')).toHaveText([
      /Alle Kontakte \(\d+\)/,
      /Leads \(\d+\)/,
      /Kunden \(\d+\)/,
      /Nicht interessierte \(\d+\)/,
    ])
    await expect(views.getByRole('button', { name: /Alle Kontakte/ })).toHaveAttribute('aria-pressed', 'true')

    const filters = page.getByTestId('kontakte-filterleiste')
    await expect(filters.getByRole('textbox')).toHaveCount(1)
    await expect(filters.getByRole('combobox')).toHaveCount(1)
    await expect(filters.getByRole('combobox')).toHaveValue('all')

    const table = page.getByTestId('kontakte-tabelle')
    await expect(table.getByRole('columnheader')).toHaveText([
      /Vorname/,
      /Nachname/,
      /Firma/,
      /Status/,
      /Quelle/,
      /Erstellt ▼/,
      /Aktionen/,
    ])

    await filters.getByRole('textbox').fill(commonCompany)
    await expect(table.locator('tbody tr').nth(0)).toHaveAttribute('data-testid', `kontakt-row-${newerCreated.id}`)
    await expect(table.locator('tbody tr').nth(1)).toHaveAttribute('data-testid', `kontakt-row-${olderCreated.id}`)

    const headerActions = page.getByTestId('kontakte-header-actions')
    await expect(headerActions.getByRole('button')).toHaveText([
      /Importieren/,
      /Exportieren/,
      /Spalten/,
      /Neu/,
    ])

    await expect(page.getByTitle('Nach Status filtern')).toHaveCount(0)
    await expect(page.getByTitle('Nach Quelle filtern')).toHaveCount(0)
    await expect(page.getByTitle('Nach Kontakt-Typ filtern')).toHaveCount(0)
    await expect(page.getByTitle('Nach Prozessschritt filtern')).toHaveCount(0)
    await expect(page.getByTitle('Nach Prüfgrund filtern')).toHaveCount(0)
    await expect(page.getByText('Archivierte anzeigen', { exact: true })).toHaveCount(0)
  })
})

test.describe('Kontaktdetail: reduzierte Arbeitsfläche und Erstgespräch-PDF', () => {
  applyTestCaseControl('E2E-029')

  test('öffnet Prozess und Kommentare über das Menü und exportiert Erstgesprächsfelder', async ({ page, request }) => {
    const contact = createPlaywrightTestContact('ErstgespraechPdf')
    const createResponse = await request.post('/api/kontakte', { data: contact })
    const { data: created } = await expectOk(createResponse, 'Testkontakt anlegen')

    await page.goto(`/kontakte/${created.id}`)
    await expect(page.getByText(/Schritt \d+\/12:/)).toHaveCount(0)
    await expect(page.getByRole('heading', { name: '💬 Kommentare' })).toHaveCount(0)

    await page.getByTitle('Weitere Aktionen').click()
    await page.getByRole('button', { name: '🎯 Prozess' }).click()
    await expect(page.getByRole('dialog').getByText('Vertriebsprozess', { exact: true })).toBeVisible()
    await page.getByRole('dialog').getByRole('button', { name: 'Schließen' }).click()

    await page.getByRole('button', { name: 'Erstgespräch bearbeiten' }).click()
    await expect(page.getByText('Leere Felder im PDF ausgeben')).toBeVisible()
    const pdfResponse = await request.get(`/api/kontakte/${created.id}/erstgespraech/pdf?includeEmpty=true`)
    expect(pdfResponse.ok()).toBeTruthy()
    expect(pdfResponse.headers()['content-type']).toContain('application/pdf')
  })
})
