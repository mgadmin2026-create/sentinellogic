'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/ui'
import type {
  ConversationDetail,
  ConversationListItem,
  ConversationStatus,
  ConversationView,
  InboxCounts,
  InboxUser,
} from '@/types/communication'

const EMPTY_COUNTS: InboxCounts = { open: 0, mine: 0, unassigned: 0, unread: 0, snoozed: 0, done: 0 }

const VIEWS: Array<{ id: ConversationView; label: string; icon: string }> = [
  { id: 'open', label: 'Offen', icon: '💬' },
  { id: 'mine', label: 'Meine', icon: '👤' },
  { id: 'unassigned', label: 'Nicht zugewiesen', icon: '○' },
  { id: 'unread', label: 'Ungelesen', icon: '●' },
  { id: 'snoozed', label: 'Zurückgestellt', icon: '◷' },
  { id: 'done', label: 'Erledigt', icon: '✓' },
]

function contactName(conversation: ConversationListItem): string {
  const fullName = [conversation.contact?.firstName, conversation.contact?.lastName].filter(Boolean).join(' ')
  return fullName || conversation.contact?.companyName || 'Unbekannter Kontakt'
}

function initials(conversation: ConversationListItem): string {
  const value = contactName(conversation).split(/\s+/).slice(0, 2).map((part) => part[0]).join('')
  return value.toLocaleUpperCase('de-DE') || '?'
}

function formatListDate(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  const today = new Date()
  if (date.toDateString() === today.toDateString()) {
    return new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(date)
  }
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' }).format(date)
}

function formatMessageDate(value: string): string {
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function channelLabel(channel: ConversationListItem['channel']): string {
  return { whatsapp: 'WhatsApp', email: 'E-Mail', webchat: 'Webchat', sms: 'SMS' }[channel]
}

export default function KommunikationPage() {
  const [view, setView] = useState<ConversationView>('open')
  const [search, setSearch] = useState('')
  const [conversations, setConversations] = useState<ConversationListItem[]>([])
  const [counts, setCounts] = useState<InboxCounts>(EMPTY_COUNTS)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ConversationDetail | null>(null)
  const [users, setUsers] = useState<InboxUser[]>([])
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [composerMode, setComposerMode] = useState<'reply' | 'note'>('reply')

  const loadConversations = useCallback(async (requestedView: ConversationView, query: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ view: requestedView })
      if (query.trim()) params.set('search', query.trim())
      const response = await fetch(`/api/kommunikation/conversations?${params}`, { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error || 'Gespräche konnten nicht geladen werden')
      setConversations(result.data)
      setCounts(result.counts)
      setSelectedId((current) => result.data.some((item: ConversationListItem) => item.id === current) ? current : result.data[0]?.id ?? null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Gespräche konnten nicht geladen werden')
      setConversations([])
    } finally {
      setLoading(false)
    }
  }, [])

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/kommunikation/conversations/${id}`, { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error || 'Gespräch konnte nicht geladen werden')
      setDetail(result.data)
      if (result.data.unreadCount > 0) {
        await fetch(`/api/kommunikation/conversations/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ markRead: true }),
        })
        setConversations((items) => items.map((item) => item.id === id ? { ...item, unreadCount: 0 } : item))
        setCounts((current) => ({ ...current, unread: Math.max(0, current.unread - 1) }))
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Gespräch konnte nicht geladen werden')
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => loadConversations(view, search), 250)
    return () => window.clearTimeout(timer)
  }, [loadConversations, search, view])

  useEffect(() => {
    if (selectedId) loadDetail(selectedId)
    else setDetail(null)
  }, [loadDetail, selectedId])

  useEffect(() => {
    async function loadUsers() {
      try {
        const response = await fetch('/api/users', { cache: 'no-store' })
        const result = await response.json()
        if (response.ok && result.success) setUsers(result.data)
      } catch (loadError) {
        console.error('Team-Liste der Inbox konnte nicht geladen werden:', loadError)
      }
    }
    loadUsers()
  }, [])

  async function updateConversation(updates: Record<string, unknown>) {
    if (!selectedId) return
    setUpdating(true)
    setError(null)
    try {
      const response = await fetch(`/api/kommunikation/conversations/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error || 'Änderung konnte nicht gespeichert werden')
      await loadConversations(view, search)
      if (selectedId) await loadDetail(selectedId)
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Änderung konnte nicht gespeichert werden')
    } finally {
      setUpdating(false)
    }
  }

  async function saveNote() {
    if (!selectedId || !noteText.trim()) return
    setUpdating(true)
    setError(null)
    try {
      const response = await fetch(`/api/kommunikation/conversations/${selectedId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: noteText }),
      })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error || 'Notiz konnte nicht gespeichert werden')
      setNoteText('')
      await loadDetail(selectedId)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Notiz konnte nicht gespeichert werden')
    } finally {
      setUpdating(false)
    }
  }

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedId) ?? detail,
    [conversations, detail, selectedId]
  )

  return (
    <div className="min-h-full p-3 md:p-6">
      <div className="mx-auto max-w-[1800px]">
        <PageHeader
          title="Kommunikation"
          subtitle="Alle Kundengespräche zentral in Sentimental Logic"
          actions={<span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">Inbox-Grundgerüst aktiv</span>}
        />

        {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="grid min-h-[720px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm xl:h-[calc(100vh-130px)] xl:grid-cols-[220px_370px_minmax(0,1fr)]">
          <nav className={`${selectedId ? 'hidden xl:block' : 'block'} border-b border-gray-200 bg-gray-50/70 p-3 xl:border-b-0 xl:border-r`} aria-label="Inbox-Ansichten">
            <p className="px-3 pb-2 pt-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">Gespräche</p>
            <div className="space-y-1">
              {VIEWS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { setView(item.id); setSelectedId(null) }}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition ${view === item.id ? 'bg-white font-bold text-gray-950 shadow-sm ring-1 ring-gray-200' : 'text-gray-600 hover:bg-white'}`}
                >
                  <span className="w-5 text-center text-xs">{item.icon}</span>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-600">{counts[item.id]}</span>
                </button>
              ))}
            </div>
            <div className="mt-6 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-800">
              <strong>Schritt 1:</strong> Die Inbox verwaltet Gespräche bereits unabhängig vom Anbieter. Der WhatsApp-Empfang und -Versand wird als nächstes angeschlossen.
            </div>
            <Link href="/postfach" className="mt-3 block rounded-lg px-3 py-2 text-xs font-semibold text-gray-500 hover:bg-white hover:text-gray-900">Zum bisherigen E-Mail-Postfach →</Link>
          </nav>

          <section className={`${selectedId ? 'hidden xl:flex' : 'flex'} min-h-[620px] flex-col border-r border-gray-200`} aria-label="Gesprächsliste">
            <div className="border-b border-gray-200 p-3">
              <label htmlFor="inbox-search" className="sr-only">Gespräche durchsuchen</label>
              <input
                id="inbox-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name, Firma, E-Mail oder Inhalt …"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none transition focus:border-yellow-400 focus:bg-white focus:ring-2 focus:ring-yellow-100"
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {loading ? (
                <p className="p-8 text-center text-sm text-gray-400">Gespräche werden geladen…</p>
              ) : conversations.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-3xl">💬</p>
                  <p className="mt-3 text-sm font-semibold text-gray-700">Noch keine Gespräche in dieser Ansicht</p>
                  <p className="mt-1 text-xs leading-5 text-gray-400">Sobald ein Kommunikationskanal Nachrichten übergibt, erscheinen sie hier.</p>
                </div>
              ) : conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => setSelectedId(conversation.id)}
                  className={`w-full border-b border-gray-100 px-4 py-4 text-left transition hover:bg-gray-50 ${selectedId === conversation.id ? 'bg-yellow-50/70 shadow-[inset_3px_0_0_#facc15]' : ''}`}
                >
                  <div className="flex gap-3">
                    <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white">{initials(conversation)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className={`min-w-0 flex-1 truncate text-sm ${conversation.unreadCount > 0 ? 'font-extrabold text-gray-950' : 'font-semibold text-gray-800'}`}>{contactName(conversation)}</p>
                        <time className="flex-none text-[11px] text-gray-400">{formatListDate(conversation.lastMessageAt)}</time>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-gray-400">
                        <span className={conversation.channel === 'whatsapp' ? 'text-emerald-600' : 'text-blue-600'}>{conversation.channel === 'whatsapp' ? '●' : '✉'}</span>
                        <span>{channelLabel(conversation.channel)}</span>
                        {conversation.assignedUser && <><span>·</span><span className="truncate">{conversation.assignedUser.name}</span></>}
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <p className="min-w-0 flex-1 truncate text-sm text-gray-500">{conversation.lastMessagePreview || 'Noch keine Vorschau'}</p>
                        {conversation.unreadCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[10px] font-extrabold text-gray-950">{conversation.unreadCount}</span>}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className={`${selectedId ? 'flex' : 'hidden xl:flex'} min-w-0 flex-col`} aria-label="Gespräch">
            {!selectedId ? (
              <div className="flex h-full min-h-[620px] items-center justify-center p-8 text-center text-gray-400">
                <div><p className="text-5xl">💬</p><p className="mt-4 text-sm">Gespräch auswählen, um den Verlauf zu öffnen.</p></div>
              </div>
            ) : detailLoading && !detail ? (
              <p className="p-10 text-center text-sm text-gray-400">Verlauf wird geladen…</p>
            ) : detail && selectedConversation ? (
              <>
                <header className="flex flex-wrap items-center gap-3 border-b border-gray-200 px-4 py-3 md:px-5">
                  <button type="button" onClick={() => setSelectedId(null)} className="mr-1 text-sm text-gray-500 hover:text-gray-900 xl:hidden">← Zurück</button>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-bold text-gray-950">{contactName(selectedConversation)}</h2>
                    <p className="text-xs text-gray-400">{channelLabel(selectedConversation.channel)} · {selectedConversation.provider}</p>
                  </div>
                  <select
                    aria-label="Verantwortlicher"
                    value={detail.assignedUser?.id ?? ''}
                    onChange={(event) => updateConversation({ assignedUserId: event.target.value || null })}
                    disabled={updating}
                    className="max-w-[170px] rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs font-semibold"
                  >
                    <option value="">Nicht zugewiesen</option>
                    {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                  </select>
                  {detail.status === 'done' ? (
                    <button type="button" disabled={updating} onClick={() => updateConversation({ status: 'open' satisfies ConversationStatus })} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold hover:bg-gray-50">Wieder öffnen</button>
                  ) : (
                    <button type="button" disabled={updating} onClick={() => updateConversation({ status: 'done' satisfies ConversationStatus })} className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-bold text-white hover:bg-black">✓ Erledigen</button>
                  )}
                </header>

                <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_240px]">
                  <div className="flex min-h-0 flex-col bg-[#f7f5f1]">
                    <div className="min-h-[380px] flex-1 space-y-4 overflow-y-auto p-4 md:p-6">
                      {detail.messages.length === 0 ? (
                        <p className="py-16 text-center text-sm text-gray-400">Für dieses Gespräch liegen noch keine Nachrichten vor.</p>
                      ) : detail.messages.map((message) => (
                        <div key={message.id} className={`flex ${message.direction === 'outbound' ? 'justify-end' : message.direction === 'internal' ? 'justify-center' : 'justify-start'}`}>
                          <div className={`max-w-[82%] rounded-2xl px-4 py-3 shadow-sm ${message.direction === 'outbound' ? 'rounded-br-md bg-[#dff5cf]' : message.direction === 'internal' ? 'w-full max-w-[92%] border border-amber-200 bg-amber-50 text-amber-950' : 'rounded-bl-md bg-white'}`}>
                            {message.direction === 'internal' && <p className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-amber-700">Interne Notiz · {message.senderName || 'Team'}</p>}
                            {message.senderName && message.direction === 'inbound' && <p className="mb-1 text-xs font-bold text-gray-600">{message.senderName}</p>}
                            <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.textContent || `[${message.messageType}]`}</p>
                            <p className="mt-1 text-right text-[10px] text-gray-400">{formatMessageDate(message.sentAt)}{message.direction === 'outbound' ? ` · ${message.deliveryStatus}` : ''}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-gray-200 bg-white p-3 md:p-4">
                      <div className="mb-2 flex gap-1">
                        <button type="button" onClick={() => setComposerMode('reply')} className={`rounded-md px-3 py-1.5 text-xs font-bold ${composerMode === 'reply' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>Antwort</button>
                        <button type="button" onClick={() => setComposerMode('note')} className={`rounded-md px-3 py-1.5 text-xs font-bold ${composerMode === 'note' ? 'bg-amber-100 text-amber-900' : 'text-gray-500 hover:bg-gray-100'}`}>Interne Notiz</button>
                      </div>
                      {composerMode === 'reply' ? (
                        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                          <p className="font-semibold text-gray-700">Antwortversand folgt mit der WhatsApp-Anbindung.</p>
                          <p className="mt-1 text-xs">Die Oberfläche ist vorbereitet; aktuell wird keine Nachricht an Kunden gesendet.</p>
                        </div>
                      ) : (
                        <div className="flex items-end gap-2">
                          <label htmlFor="inbox-note" className="sr-only">Interne Notiz</label>
                          <textarea id="inbox-note" rows={3} value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="Nur für das Team sichtbar …" className="min-w-0 flex-1 resize-none rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-200" />
                          <button type="button" onClick={saveNote} disabled={updating || !noteText.trim()} className="rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-amber-950 disabled:opacity-40">Speichern</button>
                        </div>
                      )}
                    </div>
                  </div>

                  <aside className="hidden overflow-y-auto border-l border-gray-200 bg-white p-4 lg:block" aria-label="Kontaktdaten">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Kontakt</p>
                    <div className="mt-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-sm font-bold text-white">{initials(selectedConversation)}</div>
                    <p className="mt-3 font-bold text-gray-900">{contactName(selectedConversation)}</p>
                    {detail.contact?.companyName && <p className="mt-0.5 text-sm text-gray-500">{detail.contact.companyName}</p>}
                    <dl className="mt-5 space-y-3 text-xs">
                      <div><dt className="font-bold uppercase text-gray-400">Telefon</dt><dd className="mt-0.5 break-words text-gray-700">{detail.contact?.phone || '—'}</dd></div>
                      <div><dt className="font-bold uppercase text-gray-400">E-Mail</dt><dd className="mt-0.5 break-words text-gray-700">{detail.contact?.email || '—'}</dd></div>
                      <div><dt className="font-bold uppercase text-gray-400">Kanal</dt><dd className="mt-0.5 text-gray-700">{channelLabel(detail.channel)}</dd></div>
                    </dl>
                    {detail.contact && <Link href={`/kontakte/${detail.contact.id}`} className="mt-6 block rounded-lg border border-gray-200 px-3 py-2 text-center text-xs font-bold text-gray-700 hover:bg-gray-50">Kontakt öffnen →</Link>}
                  </aside>
                </div>
              </>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  )
}

