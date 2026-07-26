'use client'
// Wiederverwendbarer Kommentarverlauf mit @-Erwähnung (Team + "Alle") und
// Datei-Anhang — nutzbar für Aufgaben (AufgabenEditModal) und Kontakte
// (Kontaktdetail-Kachel). Mentions werden nicht per Freitext-Parsing erkannt,
// sondern strukturiert über eine Auswahlliste erfasst (Chips unterhalb des
// Textfelds sind die Quelle der Wahrheit, der "@Name"-Text im Feld ist nur
// die sichtbare Bestätigung).

import { useEffect, useRef, useState } from 'react'

interface TeamMember {
  id: string
  name: string
}

interface CommentAttachment {
  id: string
  file_name: string
  file_size: number | null
  dokument_id: string | null
  file_id: string | null
}

interface Comment {
  id: string
  body: string
  created_at: string
  author?: { name: string } | null
  mentions: { name: string }[]
  attachments: CommentAttachment[]
}

interface CommentThreadProps {
  entityType: 'task' | 'contact'
  entityId: string
}

const MAX_TOTAL_ATTACHMENT_BYTES = 35 * 1024 * 1024

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function CommentThread({ entityType, entityId }: CommentThreadProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [body, setBody] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [pendingMentions, setPendingMentions] = useState<{ id: string; name: string }[]>([])
  const [mentionAll, setMentionAll] = useState(false)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionAtIndex, setMentionAtIndex] = useState(0)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    loadComments()
    fetch('/api/users')
      .then((r) => r.json())
      .then((res) => { if (res.success) setTeamMembers(res.data) })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId])

  async function loadComments() {
    try {
      setLoading(true)
      const res = await fetch(`/api/comments?entity_type=${entityType}&entity_id=${entityId}`)
      const data = await res.json()
      if (data.success) setComments(data.data)
    } catch (err) {
      console.error('[CommentThread] Laden fehlgeschlagen:', err)
    } finally {
      setLoading(false)
    }
  }

  const totalAttachmentSize = files.reduce((sum, f) => sum + f.size, 0)
  const attachmentsTooLarge = totalAttachmentSize > MAX_TOTAL_ATTACHMENT_BYTES

  const suggestions = mentionQuery === null
    ? []
    : [
        ...(('alle'.startsWith(mentionQuery.toLowerCase()) || mentionQuery === '') ? [{ id: 'all', name: 'Alle' }] : []),
        ...teamMembers.filter((m) => m.name.toLowerCase().includes(mentionQuery.toLowerCase())),
      ]

  function handleBodyChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value
    const cursor = e.target.selectionStart
    setBody(value)

    const uptoCursor = value.slice(0, cursor)
    const atIndex = uptoCursor.lastIndexOf('@')
    if (atIndex === -1) { setMentionQuery(null); return }
    const between = uptoCursor.slice(atIndex + 1)
    if (/\s/.test(between)) { setMentionQuery(null); return }
    setMentionQuery(between)
    setMentionAtIndex(atIndex)
  }

  function selectMention(member: { id: string; name: string }) {
    if (mentionQuery === null) return
    const before = body.slice(0, mentionAtIndex)
    const after = body.slice(mentionAtIndex + 1 + mentionQuery.length)
    const newBody = `${before}@${member.name} ${after}`
    setBody(newBody)
    setMentionQuery(null)

    if (member.id === 'all') {
      setMentionAll(true)
    } else {
      setPendingMentions((prev) => (prev.some((m) => m.id === member.id) ? prev : [...prev, member]))
    }
    textareaRef.current?.focus()
  }

  function removeMention(id: string) {
    if (id === 'all') setMentionAll(false)
    else setPendingMentions((prev) => prev.filter((m) => m.id !== id))
  }

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
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
    if (!body.trim()) { setError('Kommentar darf nicht leer sein'); return }
    if (attachmentsTooLarge) { setError(`Anhänge zu groß (${formatSize(totalAttachmentSize)}, max. ${formatSize(MAX_TOTAL_ATTACHMENT_BYTES)})`); return }

    setSending(true)
    try {
      const formData = new FormData()
      formData.set('entity_type', entityType)
      formData.set('entity_id', entityId)
      formData.set('body', body.trim())
      formData.set('mention_all', String(mentionAll))
      formData.set('mentioned_user_ids', JSON.stringify(pendingMentions.map((m) => m.id)))
      for (const file of files) formData.append('attachments', file)

      const res = await fetch('/api/comments', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Fehler beim Senden')

      setBody('')
      setFiles([])
      setPendingMentions([])
      setMentionAll(false)
      if (data.attachmentWarning) setNotice(data.attachmentWarning)
      await loadComments()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Senden')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-6">Wird geladen…</p>
        ) : comments.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Noch keine Kommentare.</p>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {comments.map((c) => (
              <div key={c.id} className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2.5">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-semibold text-gray-900">{c.author?.name ?? 'Unbekannt'}</span>
                  <span className="text-[11px] text-gray-400 flex-shrink-0">{formatTimestamp(c.created_at)}</span>
                </div>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{c.body}</p>
                {c.mentions.length > 0 && (
                  <p className="text-[11px] text-amber-700 mt-1.5">
                    → erwähnt: {c.mentions.map((m) => m.name).join(', ')}
                  </p>
                )}
                {c.attachments.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {c.attachments.map((a) => (
                      <div key={a.id} className="flex items-center gap-1.5 text-xs">
                        <span>📎</span>
                        {a.file_id ? (
                          <a
                            href={`https://drive.google.com/file/d/${a.file_id}/view`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline truncate"
                          >
                            {a.file_name}
                          </a>
                        ) : (
                          <span className="text-gray-500 truncate">{a.file_name} (nicht abgelegt)</span>
                        )}
                        {a.file_size != null && <span className="text-gray-400 flex-shrink-0">{formatSize(a.file_size)}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-gray-100 pt-3">
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={body}
            onChange={handleBodyChange}
            placeholder="Kommentar schreiben… @ um jemanden zu erwähnen"
            rows={3}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400/40 resize-y"
          />
          {mentionQuery !== null && suggestions.length > 0 && (
            <div className="absolute z-10 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => selectMention(s)}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-yellow-50 flex items-center gap-1.5"
                >
                  {s.id === 'all' ? '👥' : '👤'} {s.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {(mentionAll || pendingMentions.length > 0) && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {mentionAll && (
              <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 text-xs font-medium px-2 py-1 rounded-full">
                👥 Alle
                <button type="button" onClick={() => removeMention('all')} aria-label="Erwähnung Alle entfernen" className="text-amber-500 hover:text-amber-800">✕</button>
              </span>
            )}
            {pendingMentions.map((m) => (
              <span key={m.id} className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 text-xs font-medium px-2 py-1 rounded-full">
                👤 {m.name}
                <button type="button" onClick={() => removeMention(m.id)} aria-label={`Erwähnung ${m.name} entfernen`} className="text-amber-500 hover:text-amber-800">✕</button>
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 mt-2">
          <div>
            <input type="file" id={`comment-attachment-${entityType}-${entityId}`} multiple className="hidden" onChange={handleFilesSelected} />
            <label
              htmlFor={`comment-attachment-${entityType}-${entityId}`}
              className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer font-medium"
            >
              📎 Datei anhängen
            </label>
          </div>
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || attachmentsTooLarge || !body.trim()}
            className="bg-yellow-400 hover:bg-yellow-500 disabled:opacity-50 text-gray-900 font-semibold text-xs px-3 py-1.5 rounded-lg transition-colors"
          >
            {sending ? 'Sendet…' : 'Kommentieren'}
          </button>
        </div>

        {files.length > 0 && (
          <ul className="mt-2 space-y-1">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1 text-xs">
                <span className="truncate text-gray-700">{f.name}</span>
                <span className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-gray-400">{formatSize(f.size)}</span>
                  <button type="button" onClick={() => removeFile(i)} aria-label={`${f.name} entfernen`} className="text-gray-400 hover:text-red-600">✕</button>
                </span>
              </li>
            ))}
          </ul>
        )}

        {notice && <p className="text-xs text-amber-700 mt-2">{notice}</p>}
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      </div>
    </div>
  )
}
