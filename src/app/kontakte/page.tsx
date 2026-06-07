'use client'
// Kontakte-Liste — zentrale Verwaltung aller Kontakte mit vollständiger CRUD
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { KontaktEditModal } from '@/components/KontaktEditModal'

interface Kontakt {
  id: string
  first_name: string
  last_name: string
  email: string
  company_name?: string
  source?: string
  status: 'new' | 'contacted' | 'qualified' | 'customer'
  assigned_user_id?: string
  pipeline_stage?: string
  created_at: string
  notes?: string
}

const STATUS_LABELS: Record<string, string> = {
  new: 'Neu',
  contacted: 'Kontaktiert',
  qualified: 'Qualifiziert',
  customer: 'Kunde',
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  qualified: 'bg-emerald-100 text-emerald-800',
  customer: 'bg-purple-100 text-purple-800',
}

const SOURCE_LABELS: Record<string, string> = {
  manuell: 'Manuell',
  csv: 'CSV',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  calendly: 'Calendly',
  email: 'E-Mail',
}

const SOURCE_COLORS: Record<string, string> = {
  manuell: 'bg-gray-100 text-gray-600',
  csv: 'bg-gray-100 text-gray-700',
  facebook: 'bg-blue-50 text-blue-700',
  tiktok: 'bg-gray-900 text-white',
  calendly: 'bg-orange-50 text-orange-700',
  email: 'bg-green-50 text-green-700',
}

const KONTAKT_FILTER = [
  { label: 'Alle', value: 'all' },
  { label: 'Neu', value: 'new' },
  { label: 'Kontaktiert', value: 'contacted' },
  { label: 'Qualifiziert', value: 'qualified' },
  { label: 'Kunde', value: 'customer' },
]

export default function KontaktePage() {
  const [kontakte, setKontakte] = useState<Kontakt[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingKontakt, setEditingKontakt] = useState<Kontakt | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    loadKontakte()
  }, [activeFilter, search])

  async function loadKontakte() {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set('limit', '500')
      if (activeFilter !== 'all') params.set('status', activeFilter)
      if (search) params.set('search', search)

      const res = await fetch(`/api/kontakte?${params.toString()}`)
      const json = await res.json()
      if (json.success) {
        setKontakte(json.data)
      }
    } catch (err) {
      console.error('Fehler beim Laden der Kontakte:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveKontakt(formData: any) {
    try {
      const url = editingKontakt ? `/api/kontakte/${editingKontakt.id}` : '/api/kontakte'
      const method = editingKontakt ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Fehler beim Speichern')
      }

      setEditingKontakt(null)
      await loadKontakte()
    } catch (err: any) {
      throw err
    }
  }

  async function handleDeleteKontakt(id: string) {
    try {
      const res = await fetch(`/api/kontakte/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Löschen fehlgeschlagen')
      setDeleteConfirm(null)
      await loadKontakte()
    } catch (err) {
      console.error('Fehler beim Löschen:', err)
    }
  }

  async function handleCopyKontakt(kontakt: Kontakt) {
    try {
      const copiedData = {
        ...kontakt,
        first_name: `${kontakt.first_name} (Kopie)`,
      }
      delete (copiedData as any).id
      delete (copiedData as any).created_at

      const res = await fetch('/api/kontakte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(copiedData),
      })

      if (!res.ok) {
        const error = await res.json()
        alert(`Fehler beim Kopieren: ${error.error}`)
      } else {
        await loadKontakte()
      }
    } catch (err) {
      console.error('Fehler beim Kopieren:', err)
      alert('Fehler beim Kopieren des Kontakts')
    }
  }

  async function handleStatusChange(kontaktId: string, newStatus: string) {
    try {
      const res = await fetch(`/api/kontakte/${kontaktId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        await loadKontakte()
      }
    } catch (err) {
      console.error('Fehler bei Status-Änderung:', err)
    }
  }

  const filtered = kontakte.filter((k) => {
    if (activeFilter !== 'all' && k.status !== activeFilter) return false
    const q = search.toLowerCase()
    if (
      q &&
      !(
        `${k.first_name} ${k.last_name}`.toLowerCase().includes(q) ||
        (k.email ?? '').toLowerCase().includes(q) ||
        (k.company_name ?? '').toLowerCase().includes(q)
      )
    )
      return false
    return true
  })

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Kontakte</h1>
          <p className="text-gray-500 text-sm mt-0.5">{loading ? 'Lädt…' : `${kontakte.length} Kontakte gesamt`}</p>
        </div>
        <button
          onClick={() => {
            setEditingKontakt(null)
            setEditModalOpen(true)
          }}
          className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Neuer Kontakt
        </button>
      </div>

      {/* Suche + Filter */}
      <div className="mb-6 space-y-3">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <svg width="16" height="16" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Nach Name, E-Mail oder Firma suchen…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400"
            />
          </div>
        </div>

        {/* Status-Tabs */}
        <div className="flex gap-1.5 bg-white border border-gray-200 rounded-lg p-1 w-fit">
          {KONTAKT_FILTER.map((f) => {
            const count = f.value === 'all' ? kontakte.length : kontakte.filter((k) => k.status === f.value).length
            return (
              <button
                key={f.value}
                onClick={() => setActiveFilter(f.value)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  activeFilter === f.value ? 'bg-yellow-400 text-gray-900' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {f.label} <span className={`ml-1 text-xs ${activeFilter === f.value ? 'text-gray-700' : 'text-gray-400'}`}>{count}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Tabelle */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-5 py-3">Name</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-5 py-3">Firma</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-5 py-3">Quelle</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-5 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-5 py-3">Fortschritt</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-5 py-3">Erstellt</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-5 py-3">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center text-gray-400 py-16 text-sm">
                    Kontakte werden geladen…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16">
                    <p className="text-gray-400 text-sm">{kontakte.length === 0 ? 'Noch keine Kontakte vorhanden.' : 'Keine Kontakte gefunden.'}</p>
                  </td>
                </tr>
              ) : (
                filtered.map((kontakt) => (
                  <tr key={kontakt.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div>
                        <p className="font-semibold text-gray-900">{kontakt.first_name} {kontakt.last_name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{kontakt.email || kontakt.id}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">{kontakt.company_name || '—'}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex text-xs font-medium px-2.5 py-1 rounded-full ${SOURCE_COLORS[kontakt.source || 'manuell']}`}>
                        {SOURCE_LABELS[kontakt.source || 'manuell']}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <select
                        value={kontakt.status}
                        onChange={(e) => handleStatusChange(kontakt.id, e.target.value)}
                        className={`text-xs font-medium px-2.5 py-1 rounded-full border-0 cursor-pointer ${STATUS_COLORS[kontakt.status]}`}
                      >
                        {KONTAKT_FILTER.slice(1).map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-3.5">
                      {/* Prozessfortschritt Bar */}
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-yellow-400 rounded-full transition-all"
                            style={{
                              width: kontakt.status === 'new' ? '25%' : kontakt.status === 'contacted' ? '50%' : kontakt.status === 'qualified' ? '75%' : '100%',
                            }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 font-medium">
                          {kontakt.status === 'new' ? '1/4' : kontakt.status === 'contacted' ? '2/4' : kontakt.status === 'qualified' ? '3/4' : '4/4'}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs">{new Date(kontakt.created_at).toLocaleDateString('de-DE')}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-0.5">
                        <Link
                          href={`/kontakte/${kontakt.id}`}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-all"
                          title="Bearbeiten & Details"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </Link>
                        <button
                          onClick={() => handleCopyKontakt(kontakt)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 transition-all"
                          title="Kopieren"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(kontakt.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all"
                          title="Löschen"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      <KontaktEditModal
        kontakt={editingKontakt}
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false)
          setEditingKontakt(null)
        }}
        onSave={handleSaveKontakt}
      />

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Kontakt löschen?</h3>
            <p className="text-gray-600 text-sm mb-6">Dieser Kontakt und alle zugehörigen Aufgaben, Opportunities und Aktivitäten werden gelöscht. Dies kann nicht rückgängig gemacht werden.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 border border-gray-200 text-gray-600 font-medium text-sm px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={() => {
                  handleDeleteKontakt(deleteConfirm)
                }}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors"
              >
                Ja, löschen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
