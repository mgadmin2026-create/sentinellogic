'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { OpportunityEditModal } from '@/components/OpportunityEditModal'

interface Opportunity {
  id: string
  contact_id: string
  contact_name?: string
  thema: string
  status: 'neu' | 'kontaktiert' | 'analyse' | 'angebot' | 'nachfassen' | 'kunde'
  wert?: number
  nächster_schritt?: string
  fällig?: string
  notizen?: string
  created_at: string
}

const STATUS_LABELS = {
  neu: 'Neu',
  kontaktiert: 'Kontaktiert',
  analyse: 'Analyse',
  angebot: 'Angebot',
  nachfassen: 'Nachfassen',
  kunde: 'Kunde',
}

const STATUS_COLORS = {
  neu: 'bg-blue-100 text-blue-800',
  kontaktiert: 'bg-cyan-100 text-cyan-800',
  analyse: 'bg-purple-100 text-purple-800',
  angebot: 'bg-orange-100 text-orange-800',
  nachfassen: 'bg-yellow-100 text-yellow-800',
  kunde: 'bg-emerald-100 text-emerald-800',
}

const OPPORTUNITIES_FILTER = [
  { label: 'Alle', value: 'all' },
  { label: 'Neu', value: 'neu' },
  { label: 'Kontaktiert', value: 'kontaktiert' },
  { label: 'Analyse', value: 'analyse' },
  { label: 'Angebot', value: 'angebot' },
  { label: 'Nachfassen', value: 'nachfassen' },
  { label: 'Kunde', value: 'kunde' },
]

export default function OpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [contactSelectOpen, setContactSelectOpen] = useState(false)
  const [selectedContactId, setSelectedContactId] = useState('')
  const [kontakte, setKontakte] = useState<any[]>([])
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    loadOpportunities()
    loadKontakte()
  }, [statusFilter, search])

  async function loadKontakte() {
    try {
      const res = await fetch('/api/kontakte?limit=1000')
      const json = await res.json()
      if (json.success) setKontakte(json.data)
    } catch (err) {
      console.error('Fehler beim Laden der Kontakte:', err)
    }
  }

  async function loadOpportunities() {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set('limit', '500')
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (search) params.set('search', search)

      const res = await fetch(`/api/opportunities?${params.toString()}`)
      const json = await res.json()
      if (json.success) {
        setOpportunities(
          json.data.map((o: any) => ({
            ...o,
            contact_name: o.contact ? `${o.contact.first_name} ${o.contact.last_name}` : '—',
          }))
        )
      }
    } catch (err) {
      console.error('Fehler:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateOpp(form: any) {
    try {
      const res = await fetch('/api/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Fehler beim Erstellen')
      setModalOpen(false)
      await loadOpportunities()
    } catch (err: any) {
      throw err
    }
  }

  async function handleStatusChange(id: string, newStatus: string) {
    try {
      const res = await fetch(`/api/opportunities/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) await loadOpportunities()
    } catch (err) {
      console.error('Fehler:', err)
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/opportunities/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setDeleteConfirm(null)
        await loadOpportunities()
      }
    } catch (err) {
      console.error('Fehler:', err)
    }
  }

  const isOverdue = (dueDate?: string) => dueDate && new Date(dueDate) < new Date()

  const filtered = opportunities.filter((o) => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false
    const q = search.toLowerCase()
    if (q && !(o.thema.toLowerCase().includes(q) || (o.contact_name ?? '').toLowerCase().includes(q))) return false
    return true
  })

  const totalWert = filtered.reduce((sum, o) => sum + (o.wert ?? 0), 0)
  const kundenWert = filtered.filter((o) => o.status === 'kunde').reduce((sum, o) => sum + (o.wert ?? 0), 0)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Opportunities</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {loading ? 'Lädt…' : `${opportunities.length} Opportunities, ${(totalWert / 1000).toFixed(0)}K € Gesamtwert`}
          </p>
        </div>
        <button
          onClick={() => setContactSelectOpen(true)}
          className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold text-sm px-4 py-2.5 rounded-lg"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Neue Opportunity
        </button>
      </div>

      {/* KPI-Widgets */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 font-semibold uppercase">Gesamt</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{opportunities.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 font-semibold uppercase">Offene</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1">{opportunities.filter((o) => o.status !== 'kunde').length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 font-semibold uppercase">Abgeschlossen</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{opportunities.filter((o) => o.status === 'kunde').length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 font-semibold uppercase">Umsatz (Kunde)</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{(kundenWert / 1000).toFixed(0)}K €</p>
        </div>
      </div>

      <div className="mb-6 space-y-3">
        <input
          type="text"
          placeholder="Nach Thema oder Kontakt suchen…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40"
        />

        <div className="flex gap-1.5 bg-white border border-gray-200 rounded-lg p-1 w-fit overflow-x-auto">
          {OPPORTUNITIES_FILTER.map((f) => {
            const count = f.value === 'all' ? opportunities.length : opportunities.filter((o) => o.status === f.value).length
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
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left text-xs font-semibold text-gray-400 uppercase px-5 py-3">Thema</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase px-5 py-3">Kontakt</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase px-5 py-3">Status</th>
                <th className="text-right text-xs font-semibold text-gray-400 uppercase px-5 py-3">Wert</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase px-5 py-3">Fällig</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase px-5 py-3">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center text-gray-400 py-16 text-sm">
                    Opportunities werden geladen…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16">
                    <p className="text-gray-400 text-sm">
                      {opportunities.length === 0 ? 'Noch keine Opportunities vorhanden.' : 'Keine Opportunities gefunden.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((opp) => (
                  <tr key={opp.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-5 py-3.5 font-semibold text-gray-900">{opp.thema}</td>
                    <td className="px-5 py-3.5">
                      <Link href={`/kontakte/${opp.contact_id}`} className="text-yellow-600 hover:underline">
                        {opp.contact_name}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5">
                      <select
                        value={opp.status}
                        onChange={(e) => handleStatusChange(opp.id, e.target.value)}
                        className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${STATUS_COLORS[opp.status]}`}
                      >
                        {Object.entries(STATUS_LABELS).map(([v, label]) => (
                          <option key={v} value={v}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold text-gray-900">{opp.wert ? `${(opp.wert / 1000).toFixed(0)}K €` : '—'}</td>
                    <td className={`px-5 py-3.5 text-xs ${isOverdue(opp.fällig) && opp.status !== 'kunde' ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                      {opp.fällig ? new Date(opp.fällig).toLocaleDateString('de-DE') : '—'}
                      {isOverdue(opp.fällig) && opp.status !== 'kunde' && (
                        <span className="ml-2 inline-flex px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-bold">⏰</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => setDeleteConfirm(opp.id)}
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

      <OpportunityEditModal kontaktId={selectedContactId} isOpen={modalOpen} onClose={() => setModalOpen(false)} onSave={handleCreateOpp} />

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
            <h3 className="text-lg font-bold text-gray-900 mb-2">Opportunity löschen?</h3>
            <p className="text-gray-600 text-sm mb-6">Diese Opportunity wird gelöscht.</p>
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
