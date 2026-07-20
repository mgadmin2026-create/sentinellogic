'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface Aufgabe {
  id: string
  contact_id?: string
  contact?: { first_name: string; last_name: string }
  titel: string
  beschreibung?: string
  status: 'offen' | 'in_bearbeitung' | 'erledigt'
  priorität: 'niedrig' | 'mittel' | 'hoch'
  fällig: string
  assigned_user_id?: string
  assigned_user?: { name: string }
  created_at: string
  updated_at: string
}

interface TeamMember {
  id: string
  name: string
}

const STATUS_COLORS = {
  offen: 'bg-red-100 text-red-800',
  in_bearbeitung: 'bg-yellow-100 text-yellow-800',
  erledigt: 'bg-emerald-100 text-emerald-800',
}

const STATUS_LABELS = {
  offen: 'Offen',
  in_bearbeitung: 'In Bearbeitung',
  erledigt: 'Erledigt',
}

const PRIORITÄT_COLORS = {
  niedrig: 'text-gray-500',
  mittel: 'text-orange-500',
  hoch: 'text-red-500',
}

const PRIORITÄT_LABELS = {
  niedrig: 'Niedrig',
  mittel: 'Mittel',
  hoch: 'Hoch',
}

export default function AufgabeDetailPage() {
  const params = useParams()
  const router = useRouter()
  const aufgabeId = params.id as string

  const [aufgabe, setAufgabe] = useState<Aufgabe | null>(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [form, setForm] = useState<Partial<Aufgabe>>({})
  const [saving, setSaving] = useState(false)
  const [kontakte, setKontakte] = useState<any[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])

  useEffect(() => {
    loadAufgabe()
    loadKontakte()
    loadTeamMembers()
  }, [aufgabeId])

  async function loadAufgabe() {
    try {
      setLoading(true)
      const res = await fetch(`/api/aufgaben/${aufgabeId}`)
      const json = await res.json()
      if (json.success) {
        setAufgabe(json.data)
        setForm(json.data)
      }
    } catch (err) {
      console.error('Fehler:', err)
    } finally {
      setLoading(false)
    }
  }

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

  async function handleSave() {
    if (!aufgabe) return
    try {
      setSaving(true)
      const res = await fetch(`/api/aufgaben/${aufgabeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        await loadAufgabe()
        setEditMode(false)
      }
    } catch (err) {
      console.error('Fehler:', err)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Aufgabe wirklich löschen?')) return
    try {
      const res = await fetch(`/api/aufgaben/${aufgabeId}`, { method: 'DELETE' })
      if (res.ok) {
        router.push('/aufgaben')
      }
    } catch (err) {
      console.error('Fehler:', err)
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-gray-400">Aufgabe wird geladen…</p>
      </div>
    )
  }

  if (!aufgabe) {
    return (
      <div className="p-8">
        <p className="text-gray-400">Aufgabe nicht gefunden.</p>
        <Link href="/aufgaben" className="text-yellow-600 hover:underline mt-2 inline-block">
          ← Zurück zur Übersicht
        </Link>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{editMode ? 'Aufgabe bearbeiten' : aufgabe.titel}</h1>
          <p className="text-gray-500 text-sm mt-1">Erstellt: {new Date(aufgabe.created_at).toLocaleDateString('de-DE')}</p>
        </div>
        <div className="flex gap-2">
          {!editMode && (
            <>
              <button
                onClick={() => {
                  setEditMode(true)
                  setForm(aufgabe)
                }}
                className="px-4 py-2.5 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold text-sm rounded-lg"
              >
                Bearbeiten
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2.5 bg-red-100 hover:bg-red-200 text-red-700 font-semibold text-sm rounded-lg"
              >
                Löschen
              </button>
            </>
          )}
        </div>
      </div>

      {/* Hauptinhaltsbereich */}
      <div className="bg-white rounded-xl border border-gray-200 p-8">
        {editMode ? (
          <div className="space-y-6">
            {/* Titel */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Titel</label>
              <input
                type="text"
                value={form.titel || ''}
                onChange={(e) => setForm({ ...form, titel: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40"
              />
            </div>

            {/* Beschreibung */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Beschreibung</label>
              <textarea
                value={form.beschreibung || ''}
                onChange={(e) => setForm({ ...form, beschreibung: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 h-24 resize-none"
              />
            </div>

            {/* Fällig, Priorität, Status */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Fällig</label>
                <input
                  type="date"
                  value={form.fällig || ''}
                  onChange={(e) => setForm({ ...form, fällig: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Priorität</label>
                <select
                  value={form.priorität || 'mittel'}
                  onChange={(e) => setForm({ ...form, priorität: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40"
                >
                  <option value="niedrig">Niedrig</option>
                  <option value="mittel">Mittel</option>
                  <option value="hoch">Hoch</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
                <select
                  value={form.status || 'offen'}
                  onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40"
                >
                  <option value="offen">Offen</option>
                  <option value="in_bearbeitung">In Bearbeitung</option>
                  <option value="erledigt">Erledigt</option>
                </select>
              </div>
            </div>

            {/* Kontakt (optional) */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Kontakt (optional)</label>
              <select
                value={form.contact_id || ''}
                onChange={(e) => setForm({ ...form, contact_id: e.target.value || undefined })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40"
              >
                <option value="">Kein Kontakt</option>
                {kontakte.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.first_name} {k.last_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Verantwortlicher */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Verantwortlicher</label>
              <select
                value={form.assigned_user_id || ''}
                onChange={(e) => setForm({ ...form, assigned_user_id: e.target.value || undefined })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40"
              >
                <option value="">-- Wählen --</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-4 border-t border-gray-100">
              <button
                onClick={() => {
                  setEditMode(false)
                  setForm(aufgabe)
                }}
                className="flex-1 border border-gray-200 text-gray-600 font-medium px-4 py-2.5 rounded-lg hover:bg-gray-50"
              >
                Abbrechen
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-yellow-400 hover:bg-yellow-500 disabled:opacity-50 text-gray-900 font-semibold px-4 py-2.5 rounded-lg"
              >
                {saving ? 'Speichert…' : 'Speichern'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Beschreibung */}
            {aufgabe.beschreibung && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Beschreibung</h3>
                <p className="text-gray-600 whitespace-pre-wrap">{aufgabe.beschreibung}</p>
              </div>
            )}

            {/* Meta-Informationen */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Fällig</h3>
                <p className="text-gray-900">{new Date(aufgabe.fällig).toLocaleDateString('de-DE')}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Priorität</h3>
                <span className={`text-sm font-bold ${PRIORITÄT_COLORS[aufgabe.priorität]}`}>
                  {PRIORITÄT_LABELS[aufgabe.priorität]}
                </span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Status</h3>
                <span className={`inline-flex text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[aufgabe.status]}`}>
                  {STATUS_LABELS[aufgabe.status]}
                </span>
              </div>
              {aufgabe.contact_id && aufgabe.contact && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Kontakt</h3>
                  <Link href={`/kontakte/${aufgabe.contact_id}`} className="text-yellow-600 hover:underline">
                    {aufgabe.contact.first_name} {aufgabe.contact.last_name}
                  </Link>
                </div>
              )}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Verantwortlicher</h3>
                <p className="text-gray-900">{aufgabe.assigned_user?.name || '—'}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-8 text-center">
        <Link href="/aufgaben" className="text-gray-500 hover:text-gray-900 text-sm font-medium">
          ← Zurück zur Übersicht
        </Link>
      </div>
    </div>
  )
}
