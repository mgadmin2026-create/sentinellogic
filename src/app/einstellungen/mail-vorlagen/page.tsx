'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface MailTemplate {
  id: string
  name: string
  subject: string
  body: string
  created_at: string
  updated_at: string
}

const PLACEHOLDER_HINTS = [
  '{{vorname}}', '{{nachname}}', '{{name}}', '{{firma}}',
  '{{email}}', '{{telefon}}', '{{versicherungsgesellschaft}}', '{{sparte}}',
]

function emptyForm(): { name: string; subject: string; body: string } {
  return { name: '', subject: '', body: '' }
}

export default function MailVorlagenPage() {
  const [templates, setTemplates] = useState<MailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<MailTemplate | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    loadTemplates()
  }, [])

  async function loadTemplates() {
    try {
      setLoading(true)
      const res = await fetch('/api/mail-templates')
      const data = await res.json()
      if (data.success) setTemplates(data.data)
    } catch (err) {
      setError('Vorlagen konnten nicht geladen werden')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setEditing(null)
    setForm(emptyForm())
    setModalOpen(true)
  }

  function openEdit(template: MailTemplate) {
    setEditing(template)
    setForm({ name: template.name, subject: template.subject, body: template.body })
    setModalOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const url = editing ? `/api/mail-templates/${editing.id}` : '/api/mail-templates'
      const method = editing ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Fehler beim Speichern')
      setModalOpen(false)
      await loadTemplates()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(template: MailTemplate) {
    if (!confirm(`Vorlage "${template.name}" wirklich löschen?`)) return
    setDeletingId(template.id)
    try {
      const res = await fetch(`/api/mail-templates/${template.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Fehler beim Löschen')
      await loadTemplates()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Löschen')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/einstellungen" className="text-sm text-gray-500 hover:text-gray-900">← Einstellungen</Link>
      <div className="flex items-center justify-between mt-2 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">E-Mail-Vorlagen</h1>
          <p className="text-gray-600 text-sm mt-0.5">Vorlagen für den Kontakt-E-Mail-Versand verwalten</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors"
        >
          + Neue Vorlage
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm py-8 text-center">Lädt…</p>
      ) : templates.length === 0 ? (
        <p className="text-gray-500 text-sm py-8 text-center">Noch keine Vorlagen angelegt.</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {templates.map((template) => (
            <div key={template.id} className="p-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium text-gray-900">{template.name}</p>
                <p className="text-xs text-gray-500 truncate mt-0.5">{template.subject}</p>
                <p className="text-xs text-gray-400 truncate mt-1 max-w-lg">{template.body.replace(/\n/g, ' ')}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => openEdit(template)}
                  title="Bearbeiten"
                  className="px-2 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  ✏️
                </button>
                <button
                  onClick={() => handleDelete(template)}
                  disabled={deletingId === template.id}
                  title="Löschen"
                  className="px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 rounded-lg transition-colors"
                >
                  {deletingId === template.id ? '⏳' : '🗑️'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <h3 className="text-lg font-bold text-gray-900">{editing ? 'Vorlage bearbeiten' : 'Neue Vorlage'}</h3>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Name</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="z.B. Datenanfrage"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Betreff</label>
                <input
                  type="text"
                  required
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Nachricht</label>
                <textarea
                  required
                  rows={10}
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 text-sm font-mono resize-y"
                />
                <p className="text-xs text-gray-500 mt-1.5">
                  Verfügbare Platzhalter: {PLACEHOLDER_HINTS.join(', ')}
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                  className="flex-1 border border-gray-200 text-gray-600 font-medium text-sm px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-yellow-400 hover:bg-yellow-500 disabled:opacity-50 text-gray-900 font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors"
                >
                  {saving ? 'Speichert…' : 'Speichern'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
