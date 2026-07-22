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

const MAX_TOTAL_ATTACHMENT_BYTES = 35 * 1024 * 1024

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
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
  const [cc, setCc] = useState('')
  const [bcc, setBcc] = useState('')
  const [showCcBcc, setShowCcBcc] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Felder zurücksetzen, wenn das Modal frisch geöffnet wird
  useEffect(() => {
    if (open) {
      setTo(defaultTo || '')
      setCc('')
      setBcc('')
      setShowCcBcc(false)
      setSubject('')
      setBody('')
      setFiles([])
      setError(null)
      setNotice(null)
      setSending(false)
    }
  }, [open, defaultTo])

  if (!open) return null

  const totalAttachmentSize = files.reduce((sum, f) => sum + f.size, 0)
  const attachmentsTooLarge = totalAttachmentSize > MAX_TOTAL_ATTACHMENT_BYTES

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files
    if (!selected || selected.length === 0) return
    setFiles((prev) => [...prev, ...Array.from(selected)])
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSend() {
    setError(null)
    setNotice(null)

    if (!to.trim()) { setError('Empfänger-Adresse fehlt'); return }
    if (!subject.trim()) { setError('Betreff fehlt'); return }
    if (!body.trim()) { setError('Nachricht fehlt'); return }
    if (attachmentsTooLarge) { setError(`Anhänge zu groß (${formatSize(totalAttachmentSize)}, max. ${formatSize(MAX_TOTAL_ATTACHMENT_BYTES)})`); return }

    setSending(true)
    try {
      const formData = new FormData()
      formData.set('to', to.trim())
      formData.set('cc', cc.trim())
      formData.set('bcc', bcc.trim())
      formData.set('subject', subject.trim())
      formData.set('body', body)
      for (const file of files) {
        formData.append('attachments', file)
      }

      const res = await fetch(`/api/kontakte/${contactId}/email`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (res.ok && data.success) {
        onSent?.()
        if (data.filingWarning) {
          // E-Mail ist raus, nur die Dokumenten-Ablage hat gehakt — Modal offen
          // lassen, damit die Warnung nicht unbemerkt verschwindet.
          setNotice(data.filingWarning)
          setSending(false)
          return
        }
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
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-gray-600 uppercase">An</label>
              {!showCcBcc && (
                <button
                  type="button"
                  onClick={() => setShowCcBcc(true)}
                  className="text-xs font-semibold text-gray-400 hover:text-gray-700"
                >
                  Cc/Bcc
                </button>
              )}
            </div>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="empfaenger@example.com"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400/40"
            />
          </div>

          {showCcBcc && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Cc</label>
                <input
                  type="text"
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  placeholder="cc@example.com, weitere@…"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400/40"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Bcc</label>
                <input
                  type="text"
                  value={bcc}
                  onChange={(e) => setBcc(e.target.value)}
                  placeholder="bcc@example.com, weitere@…"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400/40"
                />
              </div>
            </div>
          )}

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

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Anhänge</label>
            <label className="flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-lg py-3 text-sm text-gray-500 hover:bg-gray-50 cursor-pointer transition-colors">
              <span>📎 Dateien auswählen…</span>
              <input
                type="file"
                multiple
                className="hidden"
                onChange={handleFileInputChange}
              />
            </label>
            {files.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5 text-xs">
                    <span className="truncate text-gray-700">{f.name}</span>
                    <span className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-gray-400">{formatSize(f.size)}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        aria-label={`${f.name} entfernen`}
                        className="text-gray-400 hover:text-red-600"
                      >
                        ✕
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className={`text-xs mt-1 ${attachmentsTooLarge ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
              {formatSize(totalAttachmentSize)} / {formatSize(MAX_TOTAL_ATTACHMENT_BYTES)} — Anhänge werden zusätzlich automatisch unter Dokumente abgelegt.
            </p>
          </div>

          {notice && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              ✅ E-Mail wurde versendet. {notice}
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200">
          {notice ? (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-gray-900 bg-yellow-400 hover:bg-yellow-500 rounded-lg"
            >
              Schließen
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                disabled={sending}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
              >
                Abbrechen
              </button>
              <button
                onClick={handleSend}
                disabled={sending || attachmentsTooLarge}
                className="px-4 py-2 text-sm font-semibold text-gray-900 bg-yellow-400 hover:bg-yellow-500 rounded-lg disabled:opacity-50"
              >
                {sending ? '⏳ Senden…' : '📤 Senden'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
