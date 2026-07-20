import { expect, test } from '@playwright/test'
import { applyTestCaseControl } from './support/test-control'

test.describe('Profil: Eigene Daten und Passwort', () => {
  applyTestCaseControl('E2E-013')

  test('ändert den eigenen Namen, lehnt ein falsches aktuelles Passwort ab und ändert das Passwort erfolgreich', async ({ page }) => {
    const adminPassword = process.env.PLAYWRIGHT_TEST_PASSWORD
    if (!adminPassword) {
      test.skip(true, 'PLAYWRIGHT_TEST_PASSWORD ist nicht gesetzt.')
      return
    }

    // page.request statt der eigenständigen request-Fixture: Passwortänderungen
    // rotieren die Session-Cookies der Seite, eine separate Fixture würde mit
    // dem alten (dann ungültigen) Cookie weiterarbeiten.
    const meRes = await page.request.get('/api/me')
    const meJson = await meRes.json()
    expect(meJson.success).toBe(true)
    const originalName: string = meJson.data.name
    const originalEmail: string = meJson.data.email
    const tempPassword = `Temp-${Date.now()}-Aa1!`

    await page.goto('/profil')
    await expect(page.getByRole('heading', { name: 'Mein Profil' })).toBeVisible()

    // Name ändern und über die API persistiert prüfen, danach zurücksetzen
    const changedName = `${originalName} [E2E]`
    await page.locator('input[name="name"]').fill(changedName)
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Gespeichert.')).toBeVisible()

    const afterChangeRes = await page.request.get('/api/me')
    const afterChangeJson = await afterChangeRes.json()
    expect(afterChangeJson.data.name).toBe(changedName)

    await page.locator('input[name="name"]').fill(originalName)
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Gespeichert.')).toBeVisible()

    const revertedRes = await page.request.get('/api/me')
    const revertedJson = await revertedRes.json()
    expect(revertedJson.data.name).toBe(originalName)

    // Falsches aktuelles Passwort wird abgelehnt
    await page.locator('input[name="currentPassword"]').fill('ganz-sicher-falsch-123')
    await page.locator('input[name="newPassword"]').fill(tempPassword)
    await page.getByRole('button', { name: 'Passwort ändern' }).click()
    await expect(page.getByText('Aktuelles Passwort ist falsch')).toBeVisible()

    // Erfolgreiche Passwortänderung — und sofort zurücksetzen, damit der
    // nächste Testlauf (global-setup Login) mit dem Original-Passwort
    // weiter funktioniert.
    await page.locator('input[name="currentPassword"]').fill(adminPassword)
    await page.locator('input[name="newPassword"]').fill(tempPassword)
    await page.getByRole('button', { name: 'Passwort ändern' }).click()
    await expect(page.getByText('Passwort geändert.')).toBeVisible()

    await page.locator('input[name="currentPassword"]').fill(tempPassword)
    await page.locator('input[name="newPassword"]').fill(adminPassword)
    await page.getByRole('button', { name: 'Passwort ändern' }).click()
    await expect(page.getByText('Passwort geändert.')).toBeVisible()

    const finalRes = await page.request.get('/api/me')
    const finalJson = await finalRes.json()
    expect(finalJson.data.email).toBe(originalEmail)
  })
})
