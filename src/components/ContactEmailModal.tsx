'use client'

import { useState, useEffect } from 'react'

interface ContactEmailModalProps {
  open: boolean
  contactId: string
  defaultTo?: string
  contactName?: string
  onClose: () => void
  onSent?: () => void
}

export function ContactEmailModal({
  open,
  contactId,
  defaultTo,
  contactName,
  onClose,
  onSent,
}: ContactEmailModalProps) {
  const [to, setTo] = useState(defaultTo || '')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Felder zurücksetzen, wenn das Modal frisch geöffnet wird
  useEffect(() => {
    if (open) {
      setTo(defaultTo || '')
      setSubject('')
      setBody('')
      setError(null)
      setSending(false)
    }
  }, [open, defaultTo])

  if (!open) return null

  async function handleSend() {
    setError(null)

    if (!to.trim()) { setError('Empfänger-Adresse fehlt'); return }
    if (!subject.trim()) { setError('Betreff fehlt'); return }
    if (!body.trim()) { setError('Nachricht fehlt'); return }

    setSending(true)
    try {
      const res = await fetch(`/api/kontakte/${contactId}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: to.trim(), subject: subject.trim(), body }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        onSent?.()
        onClose()
      } else {
        setError(data.error || 'Versand fehlgeschlagen')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Versand fehlgeschlagen')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">
            ✉️ E-Mail schreiben{contactName ? ` — ${contactName}` : ''}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">An</label>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="empfaenger@example.com"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400/40"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Betreff</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Betreff…"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400/40"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Nachricht</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Nachricht…"
              rows={9}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400/40 resize-y"
            />
            <p className="text-xs text-gray-400 mt-1">
              Absender: Allianz Generalvertretung Gün — die Signatur wird automatisch angehängt.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={sending}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSend}
            disabled={sending}
            className="px-4 py-2 text-sm font-semibold text-gray-900 bg-yellow-400 hover:bg-yellow-500 rounded-lg disabled:opacity-50"
          >
            {sending ? '⏳ Senden…' : '📤 Senden'}
          </button>
        </div>
      </div>
    </div>
  )
}
