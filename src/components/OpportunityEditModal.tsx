'use client'
import { useState } from 'react'

interface Opportunity {
  contact_id: string
  thema: string
  status?: string
  wert?: number
  nächster_schritt?: string
  fällig?: string
  notizen?: string
}

interface Props {
  kontaktId: string
  isOpen: boolean
  onClose: () => void
  onSave: (opp: Opportunity) => Promise<void>
}

export function OpportunityEditModal({ kontaktId, isOpen, onClose, onSave }: Props) {
  const [form, setForm] = useState<Opportunity>({
    contact_id: kontaktId,
    thema: '',
    status: 'neu',
    wert: undefined,
    nächster_schritt: '',
    fällig: '',
    notizen: '',
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
          <h2 className="text-lg font-bold text-gray-900">Neue Opportunity</h2>
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
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Thema *</label>
            <input
              type="text"
              required
              value={form.thema}
              onChange={(e) => setForm({ ...form, thema: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40"
              placeholder="z.B. KFZ-Versicherung"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Status</label>
            <select
              value={form.status || 'neu'}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40"
            >
              <option value="neu">Neu</option>
              <option value="kontaktiert">Kontaktiert</option>
              <option value="analyse">Analyse</option>
              <option value="angebot">Angebot</option>
              <option value="nachfassen">Nachfassen</option>
              <option value="kunde">Kunde</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Geschätzter Wert (€)</label>
              <input
                type="number"
                value={form.wert || ''}
                onChange={(e) => setForm({ ...form, wert: e.target.value ? parseInt(e.target.value) : undefined })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40"
                placeholder="z.B. 25000"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Fällig</label>
              <input
                type="date"
                value={form.fällig || ''}
                onChange={(e) => setForm({ ...form, fällig: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Nächster Schritt</label>
            <input
              type="text"
              value={form.nächster_schritt || ''}
              onChange={(e) => setForm({ ...form, nächster_schritt: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40"
              placeholder="z.B. Angebote vergleichen"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Notizen</label>
            <textarea
              value={form.notizen || ''}
              onChange={(e) => setForm({ ...form, notizen: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 h-20 resize-none"
            />
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
              {loading ? 'Erstellt…' : 'Opportunity erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
