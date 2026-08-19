import { expect, test } from '@playwright/test'
import { applyTestCaseControl } from './support/test-control'

const conversationId = '00000000-0000-4000-8000-000000000031'
const contactId = '00000000-0000-4000-8000-000000000032'

test.describe('Zentrale Kommunikations-Inbox', () => {
  applyTestCaseControl('E2E-031')

  test('zeigt einen Gesprächsverlauf und speichert eine interne Notiz', async ({ page }) => {
    let savedNote = ''
    let markedRead = false

    const conversation = {
      id: conversationId,
      provider: 'superchat',
      providerConversationId: 'provider-test-31',
      channel: 'whatsapp',
      status: 'open',
      unreadCount: markedRead ? 0 : 1,
      lastMessagePreview: 'Ich hätte gern einen Beratungstermin.',
      lastMessageAt: '2026-08-19T09:15:00.000Z',
      snoozedUntil: null,
      contact: {
        id: contactId,
        firstName: 'Inbox',
        lastName: 'Testkontakt',
        companyName: 'Testfirma GmbH',
        email: 'inbox-test@example.invalid',
        phone: '+4915112345678',
      },
      assignedUser: null,
    }

    await page.route('**/api/users', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [{ id: '00000000-0000-4000-8000-000000000033', name: 'Testberater' }] }),
    }))

    await page.route('**/api/kommunikation/conversations?*', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [{ ...conversation, unreadCount: markedRead ? 0 : 1 }],
        counts: { open: 1, mine: 0, unassigned: 1, unread: markedRead ? 0 : 1, snoozed: 0, done: 0 },
      }),
    }))

    await page.route(`**/api/kommunikation/conversations/${conversationId}`, async (route) => {
      if (route.request().method() === 'PATCH') {
        const payload = route.request().postDataJSON()
        if (payload.markRead) markedRead = true
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) })
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            ...conversation,
            unreadCount: markedRead ? 0 : 1,
            messages: [
              {
                id: '00000000-0000-4000-8000-000000000034',
                direction: 'inbound',
                messageType: 'text',
                textContent: 'Ich hätte gern einen Beratungstermin.',
                senderName: 'Inbox Testkontakt',
                sentAt: '2026-08-19T09:15:00.000Z',
                deliveryStatus: 'received',
                attachmentMetadata: [],
              },
              ...(savedNote ? [{
                id: '00000000-0000-4000-8000-000000000035',
                direction: 'internal',
                messageType: 'note',
                textContent: savedNote,
                senderName: 'Testberater',
                sentAt: '2026-08-19T09:20:00.000Z',
                deliveryStatus: 'received',
                attachmentMetadata: [],
              }] : []),
            ],
          },
        }),
      })
    })

    await page.route(`**/api/kommunikation/conversations/${conversationId}/notes`, async (route) => {
      savedNote = route.request().postDataJSON().text
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ success: true }) })
    })

    await page.goto('/kommunikation')
    await expect(page.getByRole('heading', { name: 'Kommunikation' })).toBeVisible()
    await expect(page.getByText('Inbox Testkontakt').first()).toBeVisible()
    await expect(page.getByText('Ich hätte gern einen Beratungstermin.').last()).toBeVisible()
    await expect.poll(() => markedRead).toBe(true)
    await expect(page.getByText('Antwortversand folgt mit der WhatsApp-Anbindung.')).toBeVisible()

    await page.getByRole('button', { name: 'Interne Notiz' }).click()
    await page.getByRole('textbox', { name: 'Interne Notiz' }).fill('Bitte morgen zurückrufen.')
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect.poll(() => savedNote).toBe('Bitte morgen zurückrufen.')
    await expect(page.getByText('Bitte morgen zurückrufen.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Kontakt öffnen →' })).toHaveAttribute('href', `/kontakte/${contactId}`)
  })
})

