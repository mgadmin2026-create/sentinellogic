'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { MailDetail, MailListItem, MailboxPage } from '@/types/postfach'
import { Button, PageHeader } from '@/components/ui'

function displayAddress(addresses: MailListItem['from']): string {
  const first = addresses[0]
  if (!first) return 'Unbekannter Absender'
  return first.name || first.address
}

function fullAddress(addresses: MailListItem['from']): string {
  return addresses.map((item) => item.name ? `${item.name} <${item.address}>` : item.address).join(', ')
}

function formatDate(value: string | null, long = false): string {
  if (!value) return '—'
  const date = new Date(value)
  return new Intl.DateTimeFormat('de-DE', long
    ? { dateStyle: 'medium', timeStyle: 'short' }
    : { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }
  ).format(date)
}

export default function PostfachPage() {
  const [mailbox, setMailbox] = useState<MailboxPage | null>(null)
  const [selectedUid, setSelectedUid] = useState<number | null>(null)
  const [detail, setDetail] = useState<MailDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [composeOpen, setComposeOpen] = useState(false)
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [replyMessageId, setReplyMessageId] = useState<string | undefined>()
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sentNotice, setSentNotice] = useState<string | null>(null)

  const loadInbox = useCallback(async (silent = false): Promise<MailboxPage | null> => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/postfach', { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error || 'Posteingang konnte nicht geladen werden')
      setMailbox(result.data)
      return result.data
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Posteingang konnte nicht geladen werden')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    async function initializeMailbox() {
      const loadedMailbox = await loadInbox()
      const searchParams = new URLSearchParams(window.location.search)
      const requestedUid = Number(searchParams.get('uid'))
      const requestedUidValidity = searchParams.get('uidValidity')

      // UID-Werte sind nur innerhalb einer UIDVALIDITY-Generation eindeutig.
      // So kann ein alter Timeline-Link niemals versehentlich eine andere Mail öffnen.
      if (
        loadedMailbox
        && Number.isInteger(requestedUid)
        && requestedUid > 0
        && requestedUidValidity === loadedMailbox.uidValidity
      ) {
        await selectMessage(requestedUid)
      }
    }

    initializeMailbox()
    // selectMessage ist absichtlich kein Dependency: Der URL-Sprung soll nur
    // beim initialen Seitenaufruf ausgeführt werden, nicht nach jedem Rendern.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadInbox])

  async function selectMessage(uid: number) {
    setSelectedUid(uid)
    setDetail(null)
    setDetailLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/postfach/${uid}`, { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error || 'Nachricht konnte nicht geladen werden')
      setDetail(result.data)
      setMailbox((current) => current ? {
        ...current,
        messages: current.messages.map((message) => message.uid === uid ? { ...message, seen: true } : message),
      } : current)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Nachricht konnte nicht geladen werden')
    } finally {
      setDetailLoading(false)
    }
  }

  function openCompose() {
    setTo('')
    setSubject('')
    setBody('')
    setReplyMessageId(undefined)
    setSendError(null)
    setSentNotice(null)
    setComposeOpen(true)
  }

  function openReply() {
    if (!detail) return
    setTo(detail.from[0]?.address || '')
    setSubject(/^re:/i.test(detail.subject) ? detail.subject : `Re: ${detail.subject}`)
    setBody('')
    setReplyMessageId(detail.messageId || undefined)
    setSendError(null)
    setSentNotice(null)
    setComposeOpen(true)
  }

  async function sendMail() {
    setSendError(null)
    setSentNotice(null)
    setSending(true)
    try {
      const response = await fetch('/api/postfach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          subject,
          text: body,
          inReplyTo: replyMessageId,
          references: replyMessageId ? [replyMessageId] : undefined,
        }),
      })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error || 'E-Mail konnte nicht gesendet werden')
      setComposeOpen(false)
      setSentNotice('E-Mail wurde über das STRATO-Postfach versendet.')
    } catch (sendMailError) {
      setSendError(sendMailError instanceof Error ? sendMailError.message : 'E-Mail konnte nicht gesendet werden')
    } finally {
      setSending(false)
    }
  }

  const unreadCount = useMemo(
    () => mailbox?.messages.filter((message) => !message.seen).length || 0,
    [mailbox]
  )

  return (
    <div className="min-h-full p-4 md:p-6">
      <div className="max-w-[1500px]">
        <PageHeader
          title="E-Mail-Postfach"
          subtitle={mailbox ? `${mailbox.account} · ${mailbox.total} Nachrichten` : 'STRATO IMAP/SMTP'}
          actions={
            <>
              <Button variant="secondary" onClick={() => loadInbox()} disabled={loading}>
                ↻ Aktualisieren
              </Button>
              <Button onClick={openCompose}>+ Neue E-Mail</Button>
            </>
          }
        />

        {sentNotice && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{sentNotice}</div>
        )}
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="grid min-h-[680px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm lg:grid-cols-[390px_1fr]">
          <section className={`border-r border-gray-200 ${selectedUid ? 'hidden lg:block' : 'block'}`} aria-label="Posteingang">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <h2 className="font-bold text-gray-900">Posteingang</h2>
              {unreadCount > 0 && <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-bold">{unreadCount} ungelesen</span>}
            </div>

            {loading ? (
              <p className="p-8 text-center text-sm text-gray-400">Nachrichten werden geladen…</p>
            ) : mailbox?.messages.length === 0 ? (
              <p className="p-8 text-center text-sm text-gray-400">Der Posteingang ist leer.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {mailbox?.messages.map((message) => (
                  <button
                    key={message.uid}
                    type="button"
                    onClick={() => selectMessage(message.uid)}
                    className={`w-full px-4 py-3 text-left transition-colors hover:bg-gray-50 ${selectedUid === message.uid ? 'bg-yellow-50' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${message.seen ? 'bg-transparent' : 'bg-brand'}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`truncate text-sm ${message.seen ? 'text-gray-700' : 'font-bold text-gray-900'}`}>{displayAddress(message.from)}</p>
                          <span className="flex-shrink-0 text-[11px] text-gray-400">{formatDate(message.date)}</span>
                        </div>
                        <p className={`mt-0.5 truncate text-sm ${message.seen ? 'text-gray-500' : 'font-semibold text-gray-800'}`}>
                          {message.hasAttachments ? '📎 ' : ''}{message.subject}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className={`${selectedUid ? 'block' : 'hidden lg:block'} min-w-0`} aria-label="Nachricht">
            {!selectedUid ? (
              <div className="flex h-full min-h-[500px] items-center justify-center text-center text-gray-400">
                <div><p className="text-4xl">✉️</p><p className="mt-3 text-sm">Nachricht auswählen, um sie zu lesen.</p></div>
              </div>
            ) : detailLoading ? (
              <p className="p-8 text-center text-sm text-gray-400">Nachricht wird geladen…</p>
            ) : detail ? (
              <article className="flex h-full flex-col">
                <header className="border-b border-gray-200 p-5 md:p-6">
                  <button type="button" onClick={() => { setSelectedUid(null); setDetail(null) }} className="mb-4 text-sm text-gray-500 hover:text-gray-900 lg:hidden">← Posteingang</button>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-xl font-bold text-gray-900 break-words">{detail.subject}</h2>
                      <p className="mt-2 text-sm text-gray-700">Von: {fullAddress(detail.from)}</p>
                      <p className="mt-0.5 text-xs text-gray-400">An: {fullAddress(detail.to)} · {formatDate(detail.date, true)}</p>
                    </div>
                    <button type="button" onClick={openReply} className="rounded-lg bg-brand px-4 py-2 text-sm font-bold hover:bg-brand-hover">↩ Antworten</button>
                  </div>
                  {detail.contact && (
                    <Link href={`/kontakte/${detail.contact.id}`} className="mt-4 inline-flex rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100">
                      👤 Kontakt öffnen: {detail.contact.name}
                    </Link>
                  )}
                </header>
                <div className="flex-1 overflow-auto p-5 md:p-7">
                  <pre className="whitespace-pre-wrap break-words font-sans text-[15px] leading-7 text-gray-800">{detail.text}</pre>
                  {detail.attachments.length > 0 && (
                    <div className="mt-8 border-t border-gray-100 pt-5">
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Anhänge</p>
                      <div className="flex flex-wrap gap-2">
                        {detail.attachments.map((attachment, index) => (
                          <span key={`${attachment.filename}-${index}`} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                            📎 {attachment.filename} · {(attachment.size / 1024).toFixed(0)} KB
                          </span>
                        ))}
                      </div>
                      <p className="mt-2 text-xs text-gray-400">Der Download von Anhängen folgt in der nächsten Ausbaustufe.</p>
                    </div>
                  )}
                </div>
              </article>
            ) : null}
          </section>
        </div>
      </div>

      {composeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setComposeOpen(false)}>
          <div className="w-full max-w-xl rounded-xl bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-bold">{replyMessageId ? 'Antwort schreiben' : 'Neue E-Mail'}</h2>
              <button type="button" onClick={() => setComposeOpen(false)} className="text-xl text-gray-400 hover:text-gray-700">×</button>
            </div>
            <div className="space-y-4 p-6">
              <div>
                <label htmlFor="postfach-to" className="mb-1 block text-xs font-bold uppercase text-gray-500">An</label>
                <input id="postfach-to" type="email" value={to} onChange={(event) => setTo(event.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-300" />
              </div>
              <div>
                <label htmlFor="postfach-subject" className="mb-1 block text-xs font-bold uppercase text-gray-500">Betreff</label>
                <input id="postfach-subject" value={subject} onChange={(event) => setSubject(event.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-300" />
              </div>
              <div>
                <label htmlFor="postfach-body" className="mb-1 block text-xs font-bold uppercase text-gray-500">Nachricht</label>
                <textarea id="postfach-body" rows={11} value={body} onChange={(event) => setBody(event.target.value)} className="w-full resize-y rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-300" />
              </div>
              {sendError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{sendError}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setComposeOpen(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold">Abbrechen</button>
                <button type="button" onClick={sendMail} disabled={sending} className="rounded-lg bg-brand px-5 py-2 text-sm font-bold disabled:opacity-50">
                  {sending ? 'Wird gesendet…' : 'Senden'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
