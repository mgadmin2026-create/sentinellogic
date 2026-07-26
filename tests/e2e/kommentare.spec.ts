import { expect, test } from '@playwright/test'
import { createPlaywrightTestContact, expectOk } from './support/test-data'
import { applyTestCaseControl } from './support/test-control'

// "@Alle" fächert an ALLE aktiven User (auch echte Mitarbeiter) eine
// E-Mail auf — das wird hier bewusst NICHT automatisiert getestet, da dieser
// Testlauf laut docs/TESTUMGEBUNG_KONZEPT.md regelmäßig gegen die
// Produktionsumgebung läuft und sonst bei jedem Deploy echte Kolleg:innen
// anschreiben würde. Die Alle-Erwähnung wurde stattdessen einmalig manuell
// verifiziert. Individuelle Erwähnungen zielen hier ausschließlich auf den
// dedizierten Test-Account "Test Mitarbeiter" (@sentinellogic.de).

test.describe('Kommentare & Erwähnungen', () => {
  applyTestCaseControl('E2E-016')

  test('postet einen Kommentar mit Einzel-Erwähnung und Datei-Anhang an einem Kontakt', async ({ page, request }) => {
    const usersRes = await request.get('/api/users')
    const { data: teamMembers } = await expectOk(usersRes, 'Team-Mitglieder laden')
    const testMitarbeiter = teamMembers.find((m: { name: string }) => m.name === 'Test Mitarbeiter')
    expect(testMitarbeiter, 'Dedizierter Test-Account "Test Mitarbeiter" wird für diesen Test benötigt').toBeTruthy()

    const contact = createPlaywrightTestContact('KommentarKontakt')
    const createRes = await request.post('/api/kontakte', { data: contact })
    const { data: created } = await expectOk(createRes, 'Testkontakt anlegen')

    await page.goto(`/kontakte/${created.id}`)
    const commentBody = `[TEST] Bitte prüfen @Test`
    const textarea = page.getByPlaceholder('Kommentar schreiben… @ um jemanden zu erwähnen')
    await textarea.fill(commentBody)
    await page.getByRole('button', { name: '👤 Test Mitarbeiter' }).click()
    await expect(page.getByText('👤 Test Mitarbeiter')).toBeVisible()

    await page.locator('input[type="file"]').setInputFiles({
      name: 'kommentar-test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Playwright-Testanhang für Kommentare', 'utf-8'),
    })
    await expect(page.getByText('kommentar-test.txt')).toBeVisible()

    await page.getByRole('button', { name: 'Kommentieren' }).click()
    await expect(page.getByText('→ erwähnt: Test Mitarbeiter')).toBeVisible()
    await expect(page.getByText('kommentar-test.txt')).toBeVisible()

    const commentsRes = await request.get(`/api/comments?entity_type=contact&entity_id=${created.id}`)
    const { data: comments } = await expectOk(commentsRes, 'Kommentare laden')
    const posted = comments.find((c: { body: string }) => c.body.startsWith(commentBody))
    expect(posted, 'Soeben erstellter Kommentar muss über die API auffindbar sein').toBeTruthy()
    expect(posted.mentions).toEqual(expect.arrayContaining([{ name: 'Test Mitarbeiter' }]))
    expect(posted.attachments).toHaveLength(1)
    expect(posted.attachments[0].file_name).toBe('kommentar-test.txt')
    expect(posted.attachments[0].file_id, 'Anhang muss in Google Drive abgelegt worden sein').toBeTruthy()
  })

  test('lehnt Datei-Anhänge an Kommentaren ohne Kontakt-Bezug ab', async ({ request }) => {
    const usersRes = await request.get('/api/users')
    const { data: teamMembers } = await expectOk(usersRes, 'Team-Mitglieder laden')
    expect(teamMembers.length).toBeGreaterThan(0)

    const taskRes = await request.post('/api/aufgaben', {
      data: {
        titel: '[TEST] Aufgabe ohne Kontakt für Kommentar-Anhang-Test',
        fällig: '2026-12-31',
        assigned_user_id: teamMembers[0].id,
      },
    })
    const { data: task } = await expectOk(taskRes, 'Kontaktlose Testaufgabe anlegen')

    const commentRes = await request.post('/api/comments', {
      multipart: {
        entity_type: 'task',
        entity_id: task.id,
        body: '[TEST] Kommentar mit Anhang ohne Kontakt',
        mention_all: 'false',
        mentioned_user_ids: '[]',
        attachments: {
          name: 'sollte-abgelehnt-werden.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('darf nicht abgelegt werden', 'utf-8'),
        },
      },
    })

    expect(commentRes.ok()).toBeFalsy()
    expect(commentRes.status()).toBe(400)
    const body = await commentRes.json()
    expect(body.error).toMatch(/Kontakt zugeordnet/)
  })

  test('zeigt den Kommentarverlauf in der Aufgaben-Bearbeiten-Ansicht', async ({ page, request }) => {
    const usersRes = await request.get('/api/users')
    const { data: teamMembers } = await expectOk(usersRes, 'Team-Mitglieder laden')

    const contact = createPlaywrightTestContact('KommentarAufgabe')
    const createContactRes = await request.post('/api/kontakte', { data: contact })
    const { data: createdContact } = await expectOk(createContactRes, 'Testkontakt anlegen')

    const taskRes = await request.post('/api/aufgaben', {
      data: {
        titel: '[TEST] Aufgabe mit Kommentarverlauf',
        fällig: '2026-12-31',
        assigned_user_id: teamMembers[0].id,
        contact_id: createdContact.id,
      },
    })
    const { data: task } = await expectOk(taskRes, 'Testaufgabe anlegen')

    await page.goto(`/kontakte/${createdContact.id}`)
    await page.getByRole('button', { name: /Historie \(\d+\) →/ }).click()
    await page.getByText(task.titel, { exact: true }).click()

    const modal = page.getByTestId('aufgaben-edit-modal')
    await expect(modal.getByRole('heading', { name: 'Aufgabe bearbeiten' })).toBeVisible()

    const commentBody = '[TEST] Kommentar direkt an der Aufgabe'
    await modal.getByPlaceholder('Kommentar schreiben… @ um jemanden zu erwähnen').fill(commentBody)
    await modal.getByRole('button', { name: 'Kommentieren' }).click()
    await expect(modal.getByText(commentBody)).toBeVisible()

    const commentsRes = await request.get(`/api/comments?entity_type=task&entity_id=${task.id}`)
    const { data: comments } = await expectOk(commentsRes, 'Aufgaben-Kommentare laden')
    expect(comments.some((c: { body: string }) => c.body === commentBody)).toBeTruthy()
  })
})
