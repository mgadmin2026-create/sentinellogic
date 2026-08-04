import { expect, test } from '@playwright/test'
import { applyTestCaseControl } from './support/test-control'

test.describe('STRATO E-Mail-Postfach', () => {
  applyTestCaseControl('E2E-020')

  test('liest eine STRATO-Nachricht und versendet eine Antwort über den geschützten Postfach-Endpunkt', async ({ page }) => {
    let sentPayload: Record<string, unknown> | null = null

    await page.route('**/api/postfach', async (route) => {
      if (route.request().method() === 'POST') {
        sentPayload = route.request().postDataJSON()
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) })
        return
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          configured: true,
          data: {
            account: 'postfach@example.invalid',
            uidValidity: '12345',
            total: 1,
            page: 1,
            pageSize: 30,
            messages: [{
              uid: 42,
              messageId: '<test-message@example.invalid>',
              subject: 'Beratungsanfrage',
              from: [{ name: 'Melanie Muster', address: 'melanie@example.invalid' }],
              to: [{ name: '', address: 'postfach@example.invalid' }],
              date: '2026-08-04T10:00:00.000Z',
              seen: false,
              answered: false,
              hasAttachments: false,
            }],
          },
        }),
      })
    })

    await page.route('**/api/postfach/42', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            uid: 42,
            subject: 'Beratungsanfrage',
            from: [{ name: 'Melanie Muster', address: 'melanie@example.invalid' }],
            to: [{ name: '', address: 'postfach@example.invalid' }],
            cc: [],
            date: '2026-08-04T10:00:00.000Z',
            seen: true,
            answered: false,
            hasAttachments: false,
            text: 'Ich wünsche einen Beratungstermin.',
            messageId: '<test-message@example.invalid>',
            inReplyTo: null,
            attachments: [],
            contact: { id: '00000000-0000-4000-8000-000000000020', name: 'Melanie Muster' },
          },
        }),
      })
    })

    await page.goto('/postfach')
    await expect(page.getByRole('heading', { name: 'E-Mail-Postfach' })).toBeVisible()
    await expect(page.getByText('postfach@example.invalid · 1 Nachrichten')).toBeVisible()
    await expect(page.getByText('1 ungelesen')).toBeVisible()

    await page.getByRole('button', { name: /Melanie Muster/ }).click()
    await expect(page.getByText('Ich wünsche einen Beratungstermin.')).toBeVisible()
    await expect(page.getByRole('link', { name: /Kontakt öffnen: Melanie Muster/ })).toBeVisible()

    await page.getByRole('button', { name: '↩ Antworten' }).click()
    await expect(page.getByRole('textbox', { name: 'An', exact: true })).toHaveValue('melanie@example.invalid')
    await expect(page.getByRole('textbox', { name: 'Betreff', exact: true })).toHaveValue('Re: Beratungsanfrage')
    await page.getByRole('textbox', { name: 'Nachricht', exact: true }).fill('Vielen Dank. Ich melde mich bei Ihnen.')
    await page.getByRole('button', { name: 'Senden' }).click()

    await expect.poll(() => sentPayload).not.toBeNull()
    expect(sentPayload).toMatchObject({
      to: 'melanie@example.invalid',
      subject: 'Re: Beratungsanfrage',
      inReplyTo: '<test-message@example.invalid>',
    })
    await expect(page.getByText('E-Mail wurde über das STRATO-Postfach versendet.')).toBeVisible()

    await page.goto('/postfach?uid=42&uidValidity=12345')
    await expect(page.getByText('Ich wünsche einen Beratungstermin.')).toBeVisible()
  })
})
