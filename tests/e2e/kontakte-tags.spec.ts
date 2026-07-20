import { expect, test } from '@playwright/test'
import { createPlaywrightTestContact } from './support/test-data'

test.describe('Kontakte: Tags', () => {
  test('Tag anlegen, zuweisen, filtern und umbenennen', async ({ page, request }) => {
    const contact = createPlaywrightTestContact('TagTest')
    const fullName = `${contact.first_name} ${contact.last_name}`
    const createRes = await request.post('/api/kontakte', { data: contact })
    expect(createRes.ok()).toBeTruthy()
    const { data: created } = await createRes.json()

    const runId = process.env.PLAYWRIGHT_RUN_ID
    const tagName = `TestTag-${runId}`
    let tagId: string | undefined

    // Tags sind (anders als contacts) nicht Teil der is_test_data-Bereinigung —
    // deshalb hier explizit selbst aufräumen, unabhängig vom Testausgang.
    try {
      await page.goto(`/kontakte/${created.id}`)
      const tagInput = page.getByPlaceholder('Tag hinzufügen…')
      await tagInput.fill(tagName)
      await tagInput.press('Enter')
      await expect(page.getByText(tagName, { exact: true })).toBeVisible()

      const tagsRes = await request.get(`/api/kontakt-tags?search=${encodeURIComponent(tagName)}`)
      const tagsJson = await tagsRes.json()
      tagId = tagsJson.data.find((t: { name: string; id: string }) => t.name === tagName)?.id
      expect(tagId).toBeTruthy()

      // Persistenz nach Reload (Beweis für den PUT-/GET-Roundtrip)
      await page.reload()
      await expect(page.getByText(tagName, { exact: true })).toBeVisible()

      // Filter in der Kontaktliste
      await page.goto('/kontakte')
      await page.getByRole('button', { name: /Tags/ }).click()
      await page.getByText(tagName, { exact: true }).click()
      await expect(page.getByText(fullName)).toBeVisible()

      // Umbenennen propagiert überall (contact_tag_map referenziert per tag_id)
      const renamedName = `${tagName}-renamed`
      const renameRes = await request.patch(`/api/kontakt-tags/${tagId}`, { data: { name: renamedName } })
      expect(renameRes.ok()).toBeTruthy()

      await page.goto(`/kontakte/${created.id}`)
      await expect(page.getByText(renamedName, { exact: true })).toBeVisible()
    } finally {
      if (tagId) {
        await request.delete(`/api/kontakt-tags/${tagId}`)
      }
    }
  })
})
