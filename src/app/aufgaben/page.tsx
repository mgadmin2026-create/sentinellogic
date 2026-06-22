'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { AufgabenEditModal } from '@/components/AufgabenEditModal'

interface Aufgabe {
  id: string
  contact_id: string
  contact_name?: string
  titel: string
  beschreibung?: string
  status: 'offen' | 'in_bearbeitung' | 'erledigt'
  priorität: 'niedrig' | 'mittel' | 'hoch'
  fällig: string
  assigned_user_id?: string
  assigned_user_name?: string
  created_at: string
}

const STATUS_LABELS = { offen: 'Offen', in_bearbeitung: 'In Bearbeitung', erledigt: 'Erledigt' }
const STATUS_COLORS = {
  offen: 'bg-red-100 text-red-800',
  in_bearbeitung: 'bg-yellow-100 text-yellow-800',
  erledigt: 'bg-emerald-100 text-emerald-800',
}
const PRIORITÄT_COLORS = { niedrig: 'text-gray-500', mittel: 'text-orange-500', hoch: 'text-red-500' }
const PRIORITÄT_LABELS = { niedrig: 'Niedrig', mittel: 'Mittel', hoch: 'Hoch' }

const AUFGABEN_FILTER = [
  { label: 'Alle', value: 'all' },
  { label: 'Offen', value: 'offen' },
  { label: 'In Bearbeitung', value: 'in_bearbeitung' },
  { label: 'Erledigt', value: 'erledigt' },
]
const PRIORITÄT_FILTER = [
  { label: 'Alle', value: 'all' },
  { label: 'Hoch', value: 'hoch' },
  { label: 'Mittel', value: 'mittel' },
  { label: 'Niedrig', value: 'niedrig' },
]

export default function AufgabenPage() {
  const [aufgaben, setAufgaben] = useState<Aufgabe[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [prioritätFilter, setPrioritätFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [contactSelectOpen, setContactSelectOpen] = useState(false)
  const [selectedContactId, setSelectedContactId] = useState('')
  const [kontakte, setKontakte] = useState<any[]>([])
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    loadAufgaben()
    loadKontakte()
  }, [statusFilter, prioritätFilter, search])

  async function loadKontakte() {
    try {
      const res = await fetch('/api/kontakte?limit=1000')
      const json = await res.json()
      if (json.success) setKontakte(json.data)
    } catch (err) {
      console.error('Fehler beim Laden der Kontakte:', err)
    }
  }

  async function loadAufgaben() {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set('limit', '500')
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (prioritätFilter !== 'all') params.set('priorität', prioritätFilter)
      if (search) params.set('search', search)

      const res = await fetch(`/api/aufgaben?${params.toString()}`)
      const json = await res.json()
      if (json.success) {
        setAufgaben(
          json.data.map((t: any) => ({
            ...t,
            contact_name: t.contact ? `${t.contact.first_name} ${t.contact.last_name}` : '—',
            assigned_user_name: t.assigned_user?.name || '—',
          }))
        )
      }
    } catch (err) {
      console.error('Fehler:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateAufgabe(form: any) {
    try {
      const res = await fetch('/api/aufgaben', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Fehler beim Erstellen')
      setModalOpen(false)
      await loadAufgaben()
    } catch (err: any) {
      throw err
    }
  }

  async function handleStatusChange(id: string, newStatus: string) {
    try {
      const res = await fetch(`/api/aufgaben/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) await loadAufgaben()
    } catch (err) {
      console.error('Fehler:', err)
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/aufgaben/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setDeleteConfirm(null)
        await loadAufgaben()
      }
    } catch (err) {
      console.error('Fehler:', err)
    }
  }

  const isOverdue = (dueDate: string) => new Date(dueDate) < new Date() && dueDate

  const filtered = aufgaben.filter((a) => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false
    if (prioritätFilter !== 'all' && a.priorität !== prioritätFilter) return false
    const q = search.toLowerCase()
    if (q && !(a.titel.toLowerCase().includes(q) || (a.contact_name ?? '').toLowerCase().includes(q))) return false
    return true
  })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Aufgaben</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {loading ? 'Lädt…' : `${aufgaben.filter((a) => a.status !== 'erledigt').length} offen, ${aufgaben.filter((a) => a.status === 'erledigt').length} erledigt`}
          </p>
        </div>
        <button
          onClick={() => {
            setSelectedContactId('')
            setModalOpen(true)
          }}
          className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold text-sm px-4 py-2.5 rounded-lg"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Neue Aufgabe
        </button>
      </div>

      <div className="mb-6 space-y-3">
        <input
          type="text"
          placeholder="Nach Titel oder Kontakt suchen…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40"
        />

        <div className="flex gap-2 flex-wrap">
          <div className="flex gap-1.5 bg-white border border-gray-200 rounded-lg p-1 w-fit">
            {AUFGABEN_FILTER.map((f) => {
              const count =
                f.value === 'all' ? aufgaben.length : aufgaben.filter((a) => a.status === f.value).length
              return (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
                    statusFilter === f.value
                      ? 'bg-yellow-400 text-gray-900'
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {f.label} <span className="ml-1 text-xs">{count}</span>
                </button>
              )
            })}
          </div>

          <div className="flex gap-1.5 bg-white border border-gray-200 rounded-lg p-1 w-fit">
            {PRIORITÄT_FILTER.map((f) => {
              const count =
                f.value === 'all' ? aufgaben.length : aufgaben.filter((a) => a.priorität === f.value).length
              return (
                <button
                  key={f.value}
                  onClick={() => setPrioritätFilter(f.value)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
                    prioritätFilter === f.value
                      ? 'bg-yellow-400 text-gray-900'
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {f.label} <span className="ml-1 text-xs">{count}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left text-xs font-semibold text-gray-400 uppercase px-5 py-3">Aufgabe</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase px-5 py-3">Kontakt</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase px-5 py-3">Priorität</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase px-5 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase px-5 py-3">Fällig</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase px-5 py-3">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center text-gray-400 py-16 text-sm">
                    Aufgaben werden geladen…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16">
                    <p className="text-gray-400 text-sm">
                      {aufgaben.length === 0 ? 'Noch keine Aufgaben vorhanden.' : 'Keine Aufgaben gefunden.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((aufgabe) => (
                  <tr
                    key={aufgabe.id}
                    className={`border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer ${aufgabe.status === 'erledigt' ? 'opacity-60' : ''}`}
                    onClick={() => window.location.href = `/aufgaben/${aufgabe.id}`}
                  >
                    <td className="px-5 py-3.5 font-semibold text-yellow-600 hover:underline">{aufgabe.titel}</td>
                    <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                      {aufgabe.contact_name && aufgabe.contact_id ? (
                        <Link href={`/kontakte/${aufgabe.contact_id}`} className="text-yellow-600 hover:underline">
                          {aufgabe.contact_name}
                        </Link>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-bold ${PRIORITÄT_COLORS[aufgabe.priorität]}`}>
                        {PRIORITÄT_LABELS[aufgabe.priorität]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={aufgabe.status}
                        onChange={(e) => handleStatusChange(aufgabe.id, e.target.value)}
                        className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${STATUS_COLORS[aufgabe.status]}`}
                      >
                        {Object.entries(STATUS_LABELS).map(([v, label]) => (
                          <option key={v} value={v}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={`px-5 py-3.5 text-xs ${isOverdue(aufgabe.fällig) ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                      {new Date(aufgabe.fällig).toLocaleDateString('de-DE')}
                      {isOverdue(aufgabe.fällig) && aufgabe.status !== 'erledigt' && (
                        <span className="ml-2 inline-flex px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-bold">
                          ⏰
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setDeleteConfirm(aufgabe.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AufgabenEditModal kontaktId={selectedContactId} isOpen={modalOpen} onClose={() => setModalOpen(false)} onSave={handleCreateAufgabe} />

      {/* Kontakt-Selektor */}
      {contactSelectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 sticky top-0 bg-white">
              <h2 className="text-lg font-bold text-gray-900">Kontakt wählen</h2>
              <button onClick={() => setContactSelectOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-2">
              {kontakte.map((k) => (
                <button
                  key={k.id}
                  onClick={() => {
                    setSelectedContactId(k.id)
                    setContactSelectOpen(false)
                    setModalOpen(true)
                  }}
                  className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-yellow-50 hover:border-yellow-400 transition-all"
                >
                  <p className="font-medium text-gray-900">{k.first_name} {k.last_name}</p>
                  <p className="text-xs text-gray-500">{k.company_name || k.email}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Aufgabe löschen?</h3>
            <p className="text-gray-600 text-sm mb-6">Diese Aufgabe wird gelöscht.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 border border-gray-200 text-gray-600 font-medium text-sm px-4 py-2.5 rounded-lg hover:bg-gray-50"
              >
                Abbrechen
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm px-4 py-2.5 rounded-lg"
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
