'use client'
// Übersicht aller eigenen @-Erwähnungen, neueste zuerst. Klick auf eine
// Erwähnung markiert sie als gelesen und springt zur Aufgabe/zum Kontakt.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { HelpButton } from '@/components/help/HelpButton'
import { PageHeader } from '@/components/ui'

interface Mention {
  id: string
  read_at: string | null
  created_at: string
  authorName: string
  body: string
  entityType: 'task' | 'contact'
  entityLabel: string
  entityUrl: string
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function ErwaehnungenPage() {
  const [mentions, setMentions] = useState<Mention[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      setLoading(true)
      const res = await fetch('/api/mentions')
      const json = await res.json()
      if (json.success) setMentions(json.data)
    } catch (err) {
      console.error('Fehler beim Laden der Erwähnungen:', err)
    } finally {
      setLoading(false)
    }
  }

  async function markRead(mention: Mention) {
    if (mention.read_at) return
    setMentions((prev) => prev.map((m) => (m.id === mention.id ? { ...m, read_at: new Date().toISOString() } : m)))
    try {
      await fetch(`/api/mentions/${mention.id}`, { method: 'PATCH' })
    } catch (err) {
      console.error('Fehler beim Markieren als gelesen:', err)
    }
  }

  const visibleMentions = filter === 'unread' ? mentions.filter((m) => !m.read_at) : mentions
  const unreadCount = mentions.filter((m) => !m.read_at).length

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl">
        <PageHeader
          title="Erwähnungen"
          subtitle={<HelpButton articleId="erwaehnungen.overview" />}
          actions={
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filter === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Alle ({mentions.length})
                </button>
                <button
                  onClick={() => setFilter('unread')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filter === 'unread' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Ungelesen ({unreadCount})
                </button>
              </div>
              <HelpButton articleId="erwaehnungen.filter" />
            </div>
          }
        />

        {loading ? (
          <p className="text-sm text-gray-400 text-center py-12">Wird geladen…</p>
        ) : visibleMentions.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">
            {filter === 'unread' ? 'Keine ungelesenen Erwähnungen.' : 'Du wurdest noch nicht erwähnt.'}
          </p>
        ) : (
          <div className="space-y-2">
            {visibleMentions.map((m) => (
              <Link
                key={m.id}
                href={m.entityUrl}
                onClick={() => markRead(m)}
                className={`block bg-white rounded-xl border px-4 py-3 hover:border-gray-300 transition-colors ${!m.read_at ? 'border-yellow-300' : 'border-gray-200'}`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    {!m.read_at && <span className="w-2 h-2 rounded-full bg-yellow-400 flex-shrink-0" />}
                    {m.authorName} → {m.entityLabel}
                  </span>
                  <span className="text-xs text-gray-400 flex-shrink-0">{formatTimestamp(m.created_at)}</span>
                </div>
                <p className="text-sm text-gray-600 line-clamp-2">{m.body}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
