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
    const passwordChanges: Array<{ currentPassword: string; newPassword: string }> = []

    // Der Regressionstest läuft gegen die Live-Umgebung. Ein echter Passwortwechsel
    // entwertet die gemeinsame Testsitzung und lässt alle nachfolgenden Tests ausfallen.
    // Deshalb prüfen wir hier den vollständigen UI-Ablauf mit einer kontrollierten
    // Antwort der eigenen Serverroute, ohne das Testkonto tatsächlich zu verändern.
    await page.route('**/api/me', async (route) => {
      const request = route.request()
      if (request.method() !== 'PATCH') {
        await route.continue()
        return
      }

      const payload = request.postDataJSON() as { currentPassword?: string; newPassword?: string }
      if (payload.newPassword === undefined) {
        await route.continue()
        return
      }

      passwordChanges.push({
        currentPassword: payload.currentPassword ?? '',
        newPassword: payload.newPassword,
      })
      const validPassword = payload.currentPassword !== 'ganz-sicher-falsch-123'
      await route.fulfill({
        status: validPassword ? 200 : 400,
        contentType: 'application/json',
        body: JSON.stringify(validPassword
          ? { success: true }
          : { success: false, error: 'Aktuelles Passwort ist falsch' }),
      })
    })

    await page.goto('/profil')
    await expect(page.getByRole('heading', { name: 'Mein Profil' })).toBeVisible()

    // Name ändern und über die API persistiert prüfen, danach zurücksetzen
    const changedName = `${originalName} [E2E]`
    await page.locator('input[name="name"]').fill(changedName)
    const changeNameResponsePromise = page.waitForResponse((response) => (
      response.url().endsWith('/api/me')
      && response.request().method() === 'PATCH'
      && response.request().postDataJSON()?.name === changedName
    ))
    await page.getByRole('button', { name: 'Speichern' }).click()
    expect((await changeNameResponsePromise).ok()).toBe(true)
    await expect(page.getByText('Gespeichert.')).toBeVisible()

    const afterChangeRes = await page.request.get('/api/me')
    const afterChangeJson = await afterChangeRes.json()
    expect(afterChangeJson.data.name).toBe(changedName)

    await page.locator('input[name="name"]').fill(originalName)
    const revertNameResponsePromise = page.waitForResponse((response) => (
      response.url().endsWith('/api/me')
      && response.request().method() === 'PATCH'
      && response.request().postDataJSON()?.name === originalName
    ))
    await page.getByRole('button', { name: 'Speichern' }).click()
    expect((await revertNameResponsePromise).ok()).toBe(true)
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

    expect(passwordChanges).toEqual([
      { currentPassword: 'ganz-sicher-falsch-123', newPassword: tempPassword },
      { currentPassword: adminPassword, newPassword: tempPassword },
      { currentPassword: tempPassword, newPassword: adminPassword },
    ])

    const finalRes = await page.request.get('/api/me')
    const finalJson = await finalRes.json()
    expect(finalJson.data.email).toBe(originalEmail)
  })
})
