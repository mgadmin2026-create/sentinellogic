'use client'
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

interface ColumnVisibility {
  name: boolean
  company: boolean
  source: boolean
  step: boolean
  progress: boolean
  created: boolean
  actions: boolean
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

const PIPELINE_STEPS = [
  { key: 'lead_in', label: 'Lead kommt rein' },
  { key: 'contacted', label: 'Lead wird kontaktiert' },
  { key: 'data_gathering', label: 'Daten werden eingeholt' },
  { key: 'wait_policies', label: 'Warten auf Policen' },
  { key: 'calc_offers', label: 'Angebote berechnen' },
  { key: 'download_offers', label: 'Angebote herunterladen & ablegen' },
  { key: 'contract_overview', label: 'Vertragsübersicht erstellen' },
  { key: 'send_offers', label: 'Angebote senden' },
  { key: 'offer_meeting', label: 'Angebotsbesprechung (Termin)' },
  { key: 'sales_talk', label: 'Verkaufsgespräch' },
  { key: 'contracts_store', label: 'Verträge ablegen' },
  { key: 'aftercare', label: 'Nachbereitung' },
]

function getStepLabel(stageKey?: string): string {
  if (!stageKey) return '—'
  const step = PIPELINE_STEPS.find(s => s.key === stageKey)
  return step ? step.label : stageKey
}

function getStepNumber(stageKey?: string): number {
  if (!stageKey) return 0
  return (PIPELINE_STEPS.findIndex(s => s.key === stageKey) || 0) + 1
}

const DEFAULT_COLUMNS: ColumnVisibility = {
  name: true,
  company: true,
  source: true,
  step: true,
  progress: true,
  created: true,
  actions: true,
}

export default function KontaktePage() {
  const [kontakte, setKontakte] = useState<Kontakt[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingKontakt, setEditingKontakt] = useState<Kontakt | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Sortierung
  const [sortBy, setSortBy] = useState<'name' | 'created_at' | 'status' | 'progress'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  // Spalten-Customization
  const [visibleColumns, setVisibleColumns] = useState<ColumnVisibility>(DEFAULT_COLUMNS)
  const [showColumnModal, setShowColumnModal] = useState(false)
  const [showQuickNote, setShowQuickNote] = useState<string | null>(null)
  const [quickNoteText, setQuickNoteText] = useState('')

  // Load column preferences from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('kontakte-columns')
    if (saved) {
      try {
        setVisibleColumns(JSON.parse(saved))
      } catch (err) {
        console.error('Error loading column preferences:', err)
      }
    }
  }, [])

  // Save column preferences to localStorage
  const handleColumnToggle = (column: keyof ColumnVisibility) => {
    const updated = { ...visibleColumns, [column]: !visibleColumns[column] }
    setVisibleColumns(updated)
    localStorage.setItem('kontakte-columns', JSON.stringify(updated))
  }

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

  async function handleQuickNote(kontaktId: string) {
    if (!quickNoteText.trim()) return
    try {
      const res = await fetch(`/api/kontakte/${kontaktId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: `${kontakte.find(k => k.id === kontaktId)?.notes || ''}\n[${new Date().toLocaleDateString('de-DE')}] ${quickNoteText}`.trim()
        }),
      })
      if (res.ok) {
        await loadKontakte()
        setShowQuickNote(null)
        setQuickNoteText('')
      }
    } catch (err) {
      console.error('Fehler beim Speichern der Notiz:', err)
    }
  }

  // Sortierungs-Logik
  const sorted = [...kontakte].sort((a, b) => {
    let compareValue = 0

    switch (sortBy) {
      case 'name':
        compareValue = `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)
        break
      case 'created_at':
        compareValue = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        break
      case 'status':
        compareValue = (a.status || '').localeCompare(b.status || '')
        break
      case 'progress':
        compareValue = getStepNumber(a.pipeline_stage) - getStepNumber(b.pipeline_stage)
        break
    }

    return sortOrder === 'asc' ? compareValue : -compareValue
  })

  const filtered = sorted.filter((k) => {
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

  const toggleSort = (field: 'name' | 'created_at' | 'status' | 'progress') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
  }

  const SortIcon = ({ field }: { field: 'name' | 'created_at' | 'status' | 'progress' }) => {
    if (sortBy !== field) return <span className="text-gray-300">⇅</span>
    return <span>{sortOrder === 'asc' ? '▲' : '▼'}</span>
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap sm:flex-nowrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Kontakte</h1>
          <p className="text-gray-500 text-sm mt-0.5">{loading ? 'Lädt…' : `${kontakte.length} Kontakte gesamt`}</p>
        </div>
        <button
          onClick={() => {
            setEditingKontakt(null)
            setEditModalOpen(true)
          }}
          className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors whitespace-nowrap"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Neu
        </button>
      </div>

      {/* Suche + Filter + Spalten Toggle */}
      <div className="mb-6 space-y-3">
        <div className="flex gap-3 flex-wrap sm:flex-nowrap">
          <div className="relative flex-1 min-w-64">
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
          <button
            onClick={() => setShowColumnModal(true)}
            className="px-3 py-2.5 text-sm font-medium bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
            title="Spalten anpassen"
          >
            ⚙️ Spalten
          </button>
        </div>

        {/* Status-Tabs */}
        <div className="flex gap-1.5 bg-white border border-gray-200 rounded-lg p-1 w-fit overflow-x-auto">
          {KONTAKT_FILTER.map((f) => {
            const count = f.value === 'all' ? kontakte.length : kontakte.filter((k) => k.status === f.value).length
            return (
              <button
                key={f.value}
                onClick={() => setActiveFilter(f.value)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
                  activeFilter === f.value ? 'bg-yellow-400 text-gray-900' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {f.label} <span className={`ml-1 text-xs ${activeFilter === f.value ? 'text-gray-700' : 'text-gray-400'}`}>{count}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Tabelle — OPTIMIERTE SPALTEN-BREITEN */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 sticky top-0">
                {/* NAME — 28% (Wichtigste Spalte, nicht kürzen) */}
                {visibleColumns.name && (
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 sm:px-4 py-3 w-[28%] min-w-52">
                    <button onClick={() => toggleSort('name')} className="flex items-center gap-1 hover:text-gray-700">
                      Name <SortIcon field="name" />
                    </button>
                  </th>
                )}

                {/* FIRMA — 22% (Wichtig, auf Mobile versteckt) */}
                {visibleColumns.company && (
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 sm:px-4 py-3 w-[22%] hidden sm:table-cell">
                    Firma
                  </th>
                )}

                {/* QUELLE — 11% (Badge, auf Tablet versteckt) */}
                {visibleColumns.source && (
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 sm:px-4 py-3 w-[11%] hidden md:table-cell">
                    Quelle
                  </th>
                )}

                {/* SCHRITT — 16% (Auf Desktop, kürzt automatisch) */}
                {visibleColumns.step && (
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 sm:px-4 py-3 w-[16%] hidden lg:table-cell">
                    Schritt
                  </th>
                )}

                {/* FORTSCHRITT — 13% (Kompakter Progress Bar) */}
                {visibleColumns.progress && (
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 sm:px-4 py-3 w-[13%]">
                    <button onClick={() => toggleSort('progress')} className="flex items-center gap-1 hover:text-gray-700">
                      Fort. <SortIcon field="progress" />
                    </button>
                  </th>
                )}

                {/* ERSTELLT — 10% (Auf Mobile versteckt) */}
                {visibleColumns.created && (
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 sm:px-4 py-3 w-[10%] hidden sm:table-cell">
                    <button onClick={() => toggleSort('created_at')} className="flex items-center gap-1 hover:text-gray-700">
                      Erstellt <SortIcon field="created_at" />
                    </button>
                  </th>
                )}

                {/* AKTIONEN — 8-10% (Compact Icons) */}
                {visibleColumns.actions && (
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-2 sm:px-3 py-3 w-[10%] text-right">
                    Aktionen
                  </th>
                )}
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
                  <tr
                    key={kontakt.id}
                    className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                  >
                    {/* NAME */}
                    {visibleColumns.name && (
                      <td className="px-3 sm:px-4 py-3 w-[28%] min-w-52">
                        <Link href={`/kontakte/${kontakt.id}`} className="group">
                          <p className="font-semibold text-yellow-600 group-hover:underline truncate">{kontakt.first_name} {kontakt.last_name}</p>
                          <p className="text-xs text-gray-400 mt-0.5 truncate">{kontakt.email || kontakt.id}</p>
                        </Link>
                      </td>
                    )}

                    {/* FIRMA */}
                    {visibleColumns.company && (
                      <td className="px-3 sm:px-4 py-3 w-[22%] hidden sm:table-cell text-gray-600 truncate">
                        {kontakt.company_name || '—'}
                      </td>
                    )}

                    {/* QUELLE */}
                    {visibleColumns.source && (
                      <td className="px-3 sm:px-4 py-3 w-[11%] hidden md:table-cell">
                        <span className={`inline-flex text-xs font-medium px-2 py-1 rounded-full ${SOURCE_COLORS[kontakt.source || 'manuell']}`}>
                          {SOURCE_LABELS[kontakt.source || 'manuell']}
                        </span>
                      </td>
                    )}

                    {/* SCHRITT */}
                    {visibleColumns.step && (
                      <td className="px-3 sm:px-4 py-3 w-[16%] hidden lg:table-cell">
                        <span className="text-xs text-gray-700 font-medium truncate max-w-full block" title={getStepLabel(kontakt.pipeline_stage)}>
                          {getStepLabel(kontakt.pipeline_stage).length > 20
                            ? getStepLabel(kontakt.pipeline_stage).substring(0, 17) + '…'
                            : getStepLabel(kontakt.pipeline_stage)}
                        </span>
                      </td>
                    )}

                    {/* FORTSCHRITT */}
                    {visibleColumns.progress && (
                      <td className="px-3 sm:px-4 py-3 w-[13%]">
                        <div className="flex items-center gap-1.5">
                          <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden flex-shrink-0">
                            <div
                              className="h-full bg-yellow-400 rounded-full transition-all"
                              style={{
                                width: `${(getStepNumber(kontakt.pipeline_stage) / 12) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 font-medium whitespace-nowrap">
                            {getStepNumber(kontakt.pipeline_stage)}/12
                          </span>
                        </div>
                      </td>
                    )}

                    {/* ERSTELLT */}
                    {visibleColumns.created && (
                      <td className="px-3 sm:px-4 py-3 w-[10%] hidden sm:table-cell text-gray-500 text-xs">
                        {new Date(kontakt.created_at).toLocaleDateString('de-DE')}
                      </td>
                    )}

                    {/* AKTIONEN */}
                    {visibleColumns.actions && (
                      <td className="px-2 sm:px-3 py-3 w-[10%] text-right">
                        <div className="flex items-center gap-0.5 justify-end">
                          {/* Status Dropdown */}
                          <select
                            value={kontakt.status}
                            onChange={(e) => handleStatusChange(kontakt.id, e.target.value)}
                            className="text-xs px-1.5 sm:px-2 py-1 border border-gray-200 rounded hover:bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {Object.entries(STATUS_LABELS).map(([key, label]) => (
                              <option key={key} value={key}>{label}</option>
                            ))}
                          </select>

                          {/* Quick Note */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setShowQuickNote(kontakt.id)
                            }}
                            className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all flex-shrink-0"
                            title="Notiz"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>

                          {/* Details */}
                          <Link
                            href={`/kontakte/${kontakt.id}`}
                            className="p-1 rounded text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-all flex-shrink-0"
                            title="Details"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                              <path d="M6.5 2H20a2 2 0 012 2v14" />
                            </svg>
                          </Link>

                          {/* Copy */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCopyKontakt(kontakt)
                            }}
                            className="p-1 rounded text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 transition-all flex-shrink-0"
                            title="Kopieren"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                          </button>

                          {/* Delete */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteConfirm(kontakt.id)
                            }}
                            className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all flex-shrink-0"
                            title="Löschen"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Column Customization Modal */}
      {showColumnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Spalten anpassen</h3>
            <div className="space-y-3">
              {Object.entries(visibleColumns).map(([column, visible]) => {
                const labels: Record<string, string> = {
                  name: 'Name',
                  company: 'Firma',
                  source: 'Quelle',
                  step: 'Aktueller Schritt',
                  progress: 'Fortschritt',
                  created: 'Erstellt',
                  actions: 'Aktionen',
                }
                return (
                  <label key={column} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-gray-50 rounded">
                    <input
                      type="checkbox"
                      checked={visible}
                      onChange={() => handleColumnToggle(column as keyof ColumnVisibility)}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm font-medium text-gray-900">{labels[column]}</span>
                  </label>
                )
              })}
            </div>
            <button
              onClick={() => setShowColumnModal(false)}
              className="w-full mt-6 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold px-4 py-2.5 rounded-lg transition-colors"
            >
              Fertig
            </button>
          </div>
        </div>
      )}

      {/* Quick Note Modal */}
      {showQuickNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Notiz hinzufügen</h3>
            <textarea
              value={quickNoteText}
              onChange={(e) => setQuickNoteText(e.target.value)}
              placeholder="Schreib eine Notiz…"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 text-sm"
              rows={4}
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setShowQuickNote(null)
                  setQuickNoteText('')
                }}
                className="flex-1 border border-gray-200 text-gray-600 font-medium text-sm px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={() => handleQuickNote(showQuickNote)}
                disabled={!quickNoteText.trim()}
                className="flex-1 bg-yellow-400 hover:bg-yellow-500 disabled:opacity-50 text-gray-900 font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors"
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}

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
