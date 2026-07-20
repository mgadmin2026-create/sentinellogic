'use client'
import { useState, useEffect } from 'react'

interface Aufgabe {
  contact_id?: string
  opportunity_id?: string
  assigned_user_id?: string
  titel: string
  beschreibung?: string
  fällig: string
  priorität?: string
  status?: string
}

interface Kontakt {
  id: string
  first_name: string
  last_name: string
}

interface TeamMember {
  id: string
  name: string
}

interface Props {
  kontaktId?: string
  isOpen: boolean
  onClose: () => void
  onSave: (aufgabe: Aufgabe) => Promise<void>
}

export function AufgabenEditModal({ kontaktId, isOpen, onClose, onSave }: Props) {
  const [form, setForm] = useState<Aufgabe>({
    contact_id: kontaktId || undefined,
    titel: '',
    beschreibung: '',
    fällig: new Date().toISOString().split('T')[0],
    priorität: 'mittel',
    status: 'offen',
    assigned_user_id: undefined,
  })
  const [kontakte, setKontakte] = useState<Kontakt[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      loadKontakte()
      loadTeamMembers()
    }
  }, [isOpen])

  async function loadKontakte() {
    try {
      const res = await fetch('/api/kontakte?limit=1000')
      const json = await res.json()
      if (json.success) setKontakte(json.data)
    } catch (err) {
      console.error('Fehler beim Laden der Kontakte:', err)
    }
  }

  async function loadTeamMembers() {
    try {
      const res = await fetch('/api/users')
      const json = await res.json()
      if (json.success) setTeamMembers(json.data)
    } catch (err) {
      console.error('Fehler beim Laden der Team-Mitglieder:', err)
    }
  }

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
              data-testid="task-title"
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
              data-testid="task-description"
              value={form.beschreibung || ''}
              onChange={(e) => setForm({ ...form, beschreibung: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 text-sm h-20 resize-none"
              placeholder="Optionale Details…"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Fällig *</label>
              <input
                data-testid="task-due-date"
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
                data-testid="task-priority"
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
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Kontakt (optional)</label>
            <select
              value={form.contact_id || ''}
              onChange={(e) => setForm({ ...form, contact_id: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 text-sm"
            >
              <option value="">Kein Kontakt</option>
              {kontakte.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.first_name} {k.last_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Verantwortlicher *</label>
            <select
              data-testid="task-assigned-user"
              required
              value={form.assigned_user_id || ''}
              onChange={(e) => setForm({ ...form, assigned_user_id: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 text-sm"
            >
              <option value="">-- Wählen --</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
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
