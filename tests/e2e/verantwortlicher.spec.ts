import { expect, test } from '@playwright/test'
import { createPlaywrightTestContact, expectOk } from './support/test-data'
import { applyTestCaseControl } from './support/test-control'

test.describe('Verantwortlicher: Kontakte & Aufgaben', () => {
  applyTestCaseControl('E2E-014')

  test('weist einen Kontakt einem Team-Mitglied zu und erzwingt einen Verantwortlichen bei Aufgaben', async ({ request }) => {
    const usersRes = await request.get('/api/users')
    const { data: teamMembers } = await expectOk(usersRes, 'Team-Mitglieder laden')
    expect(teamMembers.length, 'Mindestens ein aktives Team-Mitglied wird für diesen Test benötigt').toBeGreaterThan(0)
    const teamMember = teamMembers[0]

    // Kontakt: Verantwortlicher setzen und persistiert prüfen
    const contact = createPlaywrightTestContact('VerantwortlicherTest')
    const createContactRes = await request.post('/api/kontakte', { data: contact })
    const { data: createdContact } = await expectOk(createContactRes, 'Testkontakt anlegen')

    const patchRes = await request.patch(`/api/kontakte/${createdContact.id}`, {
      data: { assigned_user_id: teamMember.id },
    })
    await expectOk(patchRes, 'Verantwortlichen setzen')

    const contactDetailRes = await request.get(`/api/kontakte/${createdContact.id}`)
    const { data: contactDetail } = await expectOk(contactDetailRes, 'Kontakt laden')
    expect(contactDetail.assigned_user_id).toBe(teamMember.id)

    // Aufgabe ohne Verantwortlichen: muss abgelehnt werden
    const taskWithoutAssigneeRes = await request.post('/api/aufgaben', {
      data: { titel: '[TEST] Aufgabe ohne Verantwortlichen', fällig: '2026-12-31' },
    })
    expect(taskWithoutAssigneeRes.ok()).toBeFalsy()
    expect(taskWithoutAssigneeRes.status()).toBe(400)

    // Aufgabe mit Verantwortlichem: muss erfolgreich sein und den Namen mitliefern
    const taskRes = await request.post('/api/aufgaben', {
      data: {
        titel: '[TEST] Aufgabe mit Verantwortlichem',
        fällig: '2026-12-31',
        assigned_user_id: teamMember.id,
        contact_id: createdContact.id,
      },
    })
    const { data: createdTask } = await expectOk(taskRes, 'Testaufgabe mit Verantwortlichem anlegen')
    expect(createdTask.assigned_user_id).toBe(teamMember.id)

    const taskDetailRes = await request.get(`/api/aufgaben/${createdTask.id}`)
    const { data: taskDetail } = await expectOk(taskDetailRes, 'Aufgabe laden')
    expect(taskDetail.assigned_user?.name).toBe(teamMember.name)
  })
})
