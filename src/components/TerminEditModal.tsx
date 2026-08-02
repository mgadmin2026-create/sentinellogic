'use client'
import { useState, useEffect } from 'react'
import { toDatetimeLocalValue, toDateKey } from '@/lib/kalender-helpers'

export interface Termin {
  id?: string
  titel: string
  beschreibung?: string
  start_zeit: string
  end_zeit: string
  ganztaegig?: boolean
  ort?: string
  contact_id?: string
  assigned_user_id?: string
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
  termin?: Termin | null
  initialStart?: Date | null
  isOpen: boolean
  onClose: () => void
  onSave: (termin: Termin) => Promise<void>
  onDelete?: () => Promise<void>
}

function leeresFormular(initialStart?: Date | null): Termin {
  const start = initialStart ? new Date(initialStart) : new Date()
  start.setMinutes(0, 0, 0)
  const end = new Date(start)
  end.setHours(end.getHours() + 1)
  return {
    titel: '',
    beschreibung: '',
    start_zeit: start.toISOString(),
    end_zeit: end.toISOString(),
    ganztaegig: false,
    ort: '',
  }
}

export function TerminEditModal({ termin, initialStart, isOpen, onClose, onSave, onDelete }: Props) {
  const [form, setForm] = useState<Termin>(termin || leeresFormular(initialStart))
  const [kontakte, setKontakte] = useState<Kontakt[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const isEdit = !!termin?.id

  useEffect(() => {
    if (isOpen) {
      setForm(termin || leeresFormular(initialStart))
      setError('')
      loadKontakte()
      loadTeamMembers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, termin, initialStart])

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

  async function handleDelete() {
    if (!onDelete) return
    setDeleting(true)
    try {
      await onDelete()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Fehler beim Löschen')
    } finally {
      setDeleting(false)
    }
  }

  function setStart(value: string) {
    // Bei ganztägig ist value ein reines Datum (YYYY-MM-DD), sonst datetime-local.
    const start = form.ganztaegig ? new Date(`${value}T00:00`) : new Date(value)
    const end = new Date(form.end_zeit)
    setForm({
      ...form,
      start_zeit: start.toISOString(),
      end_zeit: end < start ? start.toISOString() : form.end_zeit,
    })
  }

  function setEnd(value: string) {
    const end = form.ganztaegig ? new Date(`${value}T23:59`) : new Date(value)
    setForm({ ...form, end_zeit: end.toISOString() })
  }

  return (
    <div data-testid="termin-edit-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 sticky top-0 bg-white">
          <h2 className="text-lg font-bold text-gray-900">{isEdit ? 'Termin bearbeiten' : 'Neuer Termin'}</h2>
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
              placeholder="z.B. Beratungstermin"
              autoFocus
            />
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!form.ganztaegig}
              onChange={(e) => setForm({ ...form, ganztaegig: e.target.checked })}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-900">Ganztägig</span>
          </label>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Start *</label>
              <input
                type={form.ganztaegig ? 'date' : 'datetime-local'}
                required
                value={form.ganztaegig ? toDateKey(new Date(form.start_zeit)) : toDatetimeLocalValue(new Date(form.start_zeit))}
                onChange={(e) => setStart(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Ende *</label>
              <input
                type={form.ganztaegig ? 'date' : 'datetime-local'}
                required
                value={form.ganztaegig ? toDateKey(new Date(form.end_zeit)) : toDatetimeLocalValue(new Date(form.end_zeit))}
                onChange={(e) => setEnd(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Ort</label>
            <input
              type="text"
              value={form.ort || ''}
              onChange={(e) => setForm({ ...form, ort: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 text-sm"
              placeholder="Optional"
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

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Kontakt (optional)</label>
            <select
              value={form.contact_id || ''}
              onChange={(e) => setForm({ ...form, contact_id: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 text-sm"
            >
              <option value="">Kein Kontakt</option>
              {kontakte.map((k) => (
                <option key={k.id} value={k.id}>{k.first_name} {k.last_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Verantwortlicher</label>
            <select
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
            {isEdit && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading || deleting}
                className="border border-red-200 text-red-600 font-medium text-sm px-4 py-2.5 rounded-lg hover:bg-red-50 disabled:opacity-50"
              >
                {deleting ? 'Löscht…' : 'Löschen'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={loading || deleting}
              className="flex-1 border border-gray-200 text-gray-600 font-medium text-sm px-4 py-2.5 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={loading || deleting}
              className="flex-1 bg-yellow-400 hover:bg-yellow-500 disabled:opacity-50 text-gray-900 font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors"
            >
              {loading ? 'Speichert…' : isEdit ? 'Änderungen speichern' : 'Termin erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
