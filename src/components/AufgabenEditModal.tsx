'use client'
import { useState } from 'react'

interface Aufgabe {
  contact_id: string
  opportunity_id?: string
  assigned_user_id?: string
  titel: string
  beschreibung?: string
  fällig: string
  priorität?: string
  status?: string
}

interface Props {
  kontaktId: string
  isOpen: boolean
  onClose: () => void
  onSave: (aufgabe: Aufgabe) => Promise<void>
}

const MOCK_USERS = [
  { id: 'max', name: 'Max Mustermann' },
  { id: 'laura', name: 'Laura Klein' },
  { id: 'system', name: 'System' },
]

export function AufgabenEditModal({ kontaktId, isOpen, onClose, onSave }: Props) {
  const [form, setForm] = useState<Aufgabe>({
    contact_id: kontaktId,
    titel: '',
    beschreibung: '',
    fällig: new Date().toISOString().split('T')[0],
    priorität: 'mittel',
    status: 'offen',
    assigned_user_id: undefined, // Keine Zuweisung standardmäßig
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await onSave(form)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Fehler beim Speichern')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 sticky top-0 bg-white">
          <h2 className="text-lg font-bold text-gray-900">Neue Aufgabe</h2>
          <button onClick={onClose} disabled={loading} className="text-gray-400 hover:text-gray-600 disabled:opacity-50">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Titel *</label>
            <input
              type="text"
              required
              value={form.titel}
              onChange={(e) => setForm({ ...form, titel: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 text-sm"
              placeholder="z.B. Angebote vorbereiten"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Beschreibung</label>
            <textarea
              value={form.beschreibung || ''}
              onChange={(e) => setForm({ ...form, beschreibung: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 text-sm h-20 resize-none"
              placeholder="Optionale Details…"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Fällig *</label>
              <input
                type="date"
                required
                value={form.fällig}
                onChange={(e) => setForm({ ...form, fällig: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Priorität</label>
              <select
                value={form.priorität || 'mittel'}
                onChange={(e) => setForm({ ...form, priorität: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 text-sm"
              >
                <option value="niedrig">Niedrig</option>
                <option value="mittel">Mittel</option>
                <option value="hoch">Hoch</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Zugewiesen an</label>
            <select
              value={form.assigned_user_id || 'system'}
              onChange={(e) => setForm({ ...form, assigned_user_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 text-sm"
            >
              {MOCK_USERS.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 border border-gray-200 text-gray-600 font-medium text-sm px-4 py-2.5 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-yellow-400 hover:bg-yellow-500 disabled:opacity-50 text-gray-900 font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors"
            >
              {loading ? 'Erstellt…' : 'Aufgabe erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
