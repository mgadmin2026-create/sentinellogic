'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { KontaktEditModal } from '@/components/KontaktEditModal'

interface Kontakt {
  id: string
  first_name: string
  last_name: string
  email: string
  phone_mobile?: string
  phone_office?: string
  website?: string
  company_name?: string
  industry?: string
  position?: string
  jahresumsatz?: string
  mitarbeitanzahl?: number
  street?: string
  postal_code?: string
  city?: string
  country?: string
  source?: string
  status: 'new' | 'contacted' | 'qualified' | 'customer'
  qualität?: string
  assigned_user_id?: string
  assigned_user?: string
  pipeline_stage?: string
  facebook_id?: string
  facebook_phase?: string
  dialfire_campaign?: string
  dialfire_task?: string
  klicktipp_tags?: string
  created_at: string
  updated_at?: string
  notes?: string
  bestandskunde?: boolean
  insurance_product?: string
}

interface ColumnVisibility {
  // Kontaktinfo
  first_name: boolean
  last_name: boolean
  email: boolean
  phone_mobile: boolean
  phone_office: boolean
  website: boolean
  // Unternehmensinfo
  company_name: boolean
  industry: boolean
  position: boolean
  jahresumsatz: boolean
  mitarbeitanzahl: boolean
  // Adresse
  street: boolean
  postal_code: boolean
  city: boolean
  country: boolean
  // Pipeline & Status
  status: boolean
  qualität: boolean
  pipeline_stage: boolean
  assigned_user: boolean
  // Integration
  source: boolean
  facebook_id: boolean
  facebook_phase: boolean
  dialfire_campaign: boolean
  dialfire_task: boolean
  klicktipp_tags: boolean
  // Metadaten
  created_at: boolean
  updated_at: boolean
  notes: boolean
  bestandskunde: boolean
  insurance_product: boolean
  // UI-Spalten
  progress: boolean
  actions: boolean
}

interface ColumnCategory {
  label: string
  fields: (keyof ColumnVisibility)[]
  description?: string
  icon?: string
}

const COLUMN_CATEGORIES: Record<string, ColumnCategory> = {
  kontaktinfo: {
    label: 'Kontaktinformation',
    description: 'Name, E-Mail und Telefon',
    icon: '👤',
    fields: ['first_name', 'last_name', 'email', 'phone_mobile', 'phone_office', 'website']
  },
  unternehmen: {
    label: 'Unternehmensinfo',
    description: 'Firma, Position, Branche',
    icon: '🏢',
    fields: ['company_name', 'industry', 'position', 'jahresumsatz', 'mitarbeitanzahl']
  },
  adresse: {
    label: 'Adresse',
    description: 'Straße, PLZ, Stadt, Land',
    icon: '📍',
    fields: ['street', 'postal_code', 'city', 'country']
  },
  pipeline: {
    label: 'Pipeline & Status',
    description: 'Status, Qualität, Stufe',
    icon: '📊',
    fields: ['status', 'qualität', 'pipeline_stage', 'assigned_user', 'progress']
  },
  integration: {
    label: 'Integration',
    description: 'Externe Plattformen & Quellen',
    icon: '⭐',
    fields: ['source', 'facebook_id', 'facebook_phase', 'dialfire_campaign', 'dialfire_task', 'klicktipp_tags']
  },
  metadaten: {
    label: 'Metadaten',
    description: 'Zeitstempel, Noten, Status',
    icon: '📝',
    fields: ['created_at', 'updated_at', 'notes', 'bestandskunde', 'insurance_product']
  }
}

const FIELD_LABELS: Record<keyof ColumnVisibility, string> = {
  first_name: 'Vorname',
  last_name: 'Nachname',
  email: 'E-Mail',
  phone_mobile: 'Mobiltelefon',
  phone_office: 'Bürotelefon',
  website: 'Website',
  company_name: 'Firma',
  industry: 'Branche',
  position: 'Position',
  jahresumsatz: 'Jahresumsatz',
  mitarbeitanzahl: 'Mitarbeitanzahl',
  street: 'Straße',
  postal_code: 'Postleitzahl',
  city: 'Stadt',
  country: 'Land',
  status: 'Status',
  qualität: 'Qualität',
  pipeline_stage: 'Pipeline-Stufe',
  assigned_user: 'Zugewiesen an',
  source: 'Quelle',
  facebook_id: 'Facebook ID',
  facebook_phase: 'Facebook Phase',
  dialfire_campaign: 'Dialfire Kampagne ⭐',
  dialfire_task: 'Dialfire Task ⭐',
  klicktipp_tags: 'Klicktipp Tags',
  created_at: 'Erstellt',
  updated_at: 'Aktualisiert',
  notes: 'Notizen',
  bestandskunde: 'Bestandskunde',
  insurance_product: 'Versicherungsprodukt',
  progress: 'Fortschritt',
  actions: 'Aktionen'
}

// Definierte Spalten-Reihenfolge (WICHTIG: Object.entries hat keine Reihenfolge!)
const COLUMN_ORDER: (keyof ColumnVisibility)[] = [
  'first_name', 'last_name', 'email', 'phone_mobile', 'phone_office', 'website',
  'company_name', 'industry', 'position', 'jahresumsatz', 'mitarbeitanzahl',
  'street', 'postal_code', 'city', 'country',
  'status', 'qualität', 'pipeline_stage', 'assigned_user',
  'source', 'facebook_id', 'facebook_phase', 'dialfire_campaign', 'dialfire_task', 'klicktipp_tags',
  'created_at', 'updated_at', 'notes', 'bestandskunde', 'insurance_product',
  'progress', 'actions'
]

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
  ki_upload: 'KI Upload',
}

const SOURCE_COLORS: Record<string, string> = {
  ki_upload: 'bg-violet-100 text-violet-700',
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
  // Kontaktinfo — KERN
  first_name: true,
  last_name: true,
  email: false,
  phone_mobile: false,
  phone_office: false,
  website: false,
  // Unternehmensinfo — KERN
  company_name: true,
  industry: false,
  position: false,
  jahresumsatz: false,
  mitarbeitanzahl: false,
  // Adresse
  street: false,
  postal_code: false,
  city: false,
  country: false,
  // Pipeline & Status — KERN
  status: true,
  qualität: false,
  pipeline_stage: true,
  assigned_user: false,
  // Integration — KERN
  source: true,
  facebook_id: false,
  facebook_phase: false,
  dialfire_campaign: false,
  dialfire_task: false,
  klicktipp_tags: false,
  // Metadaten
  created_at: false,
  updated_at: false,
  notes: false,
  bestandskunde: false,
  insurance_product: false,
  // UI
  progress: true,
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
  const [columnSearchQuery, setColumnSearchQuery] = useState('')
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

  // Handle search in column modal
  const handleColumnSearch = (query: string) => {
    setColumnSearchQuery(query.toLowerCase())
  }

  // Handle category select/deselect all
  const handleCategoryToggle = (category: string, selectAll: boolean) => {
    const categoryConfig = COLUMN_CATEGORIES[category]
    if (!categoryConfig) return

    const updated = { ...visibleColumns }
    categoryConfig.fields.forEach((field) => {
      if (field !== 'actions' && field !== 'progress') { // Don't toggle UI fields
        updated[field] = selectAll
      }
    })
    setVisibleColumns(updated)
    localStorage.setItem('kontakte-columns', JSON.stringify(updated))
  }

  // Reset all columns to default
  const handleResetColumns = () => {
    setVisibleColumns(DEFAULT_COLUMNS)
    setColumnSearchQuery('')
    localStorage.setItem('kontakte-columns', JSON.stringify(DEFAULT_COLUMNS))
  }

  // Get count of visible columns (excluding UI columns)
  const getColumnCount = () => {
    return Object.entries(visibleColumns).filter(
      ([key, val]) => val && key !== 'actions' && key !== 'progress'
    ).length
  }

  // Filter columns based on search query
  const getFilteredCategories = () => {
    if (!columnSearchQuery) return COLUMN_CATEGORIES

    const filtered: Record<string, ColumnCategory> = {}
    Object.entries(COLUMN_CATEGORIES).forEach(([key, category]) => {
      const matchingFields = category.fields.filter(
        (field) =>
          FIELD_LABELS[field].toLowerCase().includes(columnSearchQuery) ||
          category.label.toLowerCase().includes(columnSearchQuery)
      )
      if (matchingFields.length > 0) {
        filtered[key] = {
          ...category,
          fields: matchingFields
        }
      }
    })
    return filtered
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

      {/* Tabelle — DYNAMISCHE SPALTEN */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 sticky top-0">
                {/* DYNAMISCH: Loop through all visible columns in DEFINED ORDER */}
                {COLUMN_ORDER
                  .filter(key => visibleColumns[key] && key !== 'progress' && key !== 'actions')
                  .map((columnKey) => {
                    const key = columnKey as keyof ColumnVisibility
                    const isSortable = ['first_name', 'created_at', 'status'].includes(key)
                    const label = FIELD_LABELS[key]
                    const isCritical = ['first_name', 'last_name', 'company_name', 'status', 'pipeline_stage', 'source', 'progress'].includes(key)
                    const isBlueField = key.includes('dialfire')

                    // Adaptive column widths
                    const getMinWidth = () => {
                      if (['first_name', 'last_name'].includes(key)) return 'min-w-48'
                      if (['company_name', 'pipeline_stage'].includes(key)) return 'min-w-40'
                      if (['email', 'notes'].includes(key)) return 'min-w-36'
                      return 'min-w-32'
                    }

                    return (
                      <th
                        key={key}
                        className={`text-left text-xs font-semibold ${isBlueField ? 'text-blue-600' : 'text-gray-500'} uppercase tracking-wide px-3 sm:px-4 py-3 ${getMinWidth()} ${!isCritical ? 'hidden sm:table-cell' : ''}`}
                      >
                        {isSortable && (key === 'first_name' || key === 'created_at') ? (
                          <button
                            onClick={() => toggleSort(key as 'name' | 'created_at' | 'status' | 'progress')}
                            className="flex items-center gap-1 hover:text-gray-700"
                          >
                            {label} {key === 'first_name' && <SortIcon field="name" />}
                            {key === 'created_at' && <SortIcon field="created_at" />}
                          </button>
                        ) : (
                          label
                        )}
                      </th>
                    )
                  })}

                {/* PROGRESS Column (if visible) */}
                {visibleColumns.progress && (
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 sm:px-4 py-3 min-w-28">
                    <button onClick={() => toggleSort('progress')} className="flex items-center gap-1 hover:text-gray-700">
                      Fort. <SortIcon field="progress" />
                    </button>
                  </th>
                )}

                {/* ACTIONS Column (always at end if visible) */}
                {visibleColumns.actions && (
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-2 sm:px-3 py-3 min-w-20 text-right">
                    Aktionen
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={Object.values(visibleColumns).filter(v => v).length} className="text-center text-gray-400 py-16 text-sm">
                    Kontakte werden geladen…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={Object.values(visibleColumns).filter(v => v).length} className="text-center py-16">
                    <p className="text-gray-400 text-sm">{kontakte.length === 0 ? 'Noch keine Kontakte vorhanden.' : 'Keine Kontakte gefunden.'}</p>
                  </td>
                </tr>
              ) : (
                filtered.map((kontakt) => (
                  <tr
                    key={kontakt.id}
                    className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                  >
                    {/* DYNAMISCH: Loop through all visible columns in DEFINED ORDER */}
                    {COLUMN_ORDER
                      .filter(key => visibleColumns[key] && key !== 'progress' && key !== 'actions')
                      .map((columnKey) => {
                        const key = columnKey as keyof ColumnVisibility
                        const isCritical = ['first_name', 'last_name', 'company_name', 'status', 'pipeline_stage', 'source', 'progress'].includes(key)
                        let value: any = (kontakt as any)[key]

                        // Format value based on column type
                        let displayContent: React.ReactNode = '—'

                        if (key === 'first_name') {
                          displayContent = (
                            <Link href={`/kontakte/${kontakt.id}`} className="group">
                              <p className="font-semibold text-yellow-600 group-hover:underline truncate">
                                {kontakt.first_name} {kontakt.last_name}
                              </p>
                              <p className="text-xs text-gray-400 mt-0.5 truncate">{kontakt.email || kontakt.id}</p>
                            </Link>
                          )
                        } else if (key === 'status') {
                          displayContent = (
                            <select
                              value={kontakt.status}
                              onChange={(e) => handleStatusChange(kontakt.id, e.target.value)}
                              className="text-xs px-1.5 sm:px-2 py-1 border border-gray-200 rounded hover:bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {Object.entries(STATUS_LABELS).map(([optKey, label]) => (
                                <option key={optKey} value={optKey}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          )
                        } else if (key === 'source') {
                          displayContent = value ? (
                            <span
                              className={`inline-flex text-xs font-medium px-2 py-1 rounded-full ${SOURCE_COLORS[value] || SOURCE_COLORS['manuell']}`}
                            >
                              {SOURCE_LABELS[value] || value}
                            </span>
                          ) : (
                            '—'
                          )
                        } else if (key === 'pipeline_stage') {
                          const stageLabel = getStepLabel(value)
                          displayContent = (
                            <span
                              className="text-xs text-gray-700 font-medium truncate max-w-full block"
                              title={stageLabel}
                            >
                              {stageLabel.length > 20 ? stageLabel.substring(0, 17) + '…' : stageLabel}
                            </span>
                          )
                        } else if (key === 'created_at' || key === 'updated_at') {
                          displayContent = value ? new Date(value).toLocaleDateString('de-DE') : '—'
                        } else if (key === 'bestandskunde') {
                          displayContent = value ? (
                            <span className="inline-flex text-xs font-medium px-2 py-1 rounded-full bg-green-50 text-green-700">
                              Ja
                            </span>
                          ) : (
                            <span className="text-xs text-gray-500">Nein</span>
                          )
                        } else if (
                          key.includes('dialfire') ||
                          key.includes('facebook') ||
                          key.includes('klicktipp')
                        ) {
                          // Integration fields with special styling
                          displayContent = value ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                              {String(value).substring(0, 25)}
                              {String(value).length > 25 ? '…' : ''}
                            </span>
                          ) : (
                            '—'
                          )
                        } else if (key === 'mitarbeitanzahl') {
                          displayContent = value ? (
                            <span className="text-xs text-gray-700 font-medium">{value.toLocaleString('de-DE')}</span>
                          ) : (
                            '—'
                          )
                        } else if (typeof value === 'boolean') {
                          displayContent = value ? '✓' : '—'
                        } else {
                          // Default text rendering
                          displayContent = value ? (
                            <span className="text-xs text-gray-600 truncate block" title={String(value)}>
                              {String(value).substring(0, 40)}
                              {String(value).length > 40 ? '…' : ''}
                            </span>
                          ) : (
                            '—'
                          )
                        }

                        // Adaptive column widths (match headers)
                        const getTdMinWidth = () => {
                          if (['first_name', 'last_name'].includes(key)) return 'min-w-48'
                          if (['company_name', 'pipeline_stage'].includes(key)) return 'min-w-40'
                          if (['email', 'notes'].includes(key)) return 'min-w-36'
                          return 'min-w-32'
                        }

                        return (
                          <td
                            key={key}
                            className={`px-3 sm:px-4 py-3 ${getTdMinWidth()} ${!isCritical ? 'hidden sm:table-cell' : ''}`}
                          >
                            {displayContent}
                          </td>
                        )
                      })}

                    {/* PROGRESS Column (if visible) */}
                    {visibleColumns.progress && (
                      <td className="px-3 sm:px-4 py-3 min-w-28">
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

                    {/* ACTIONS Column (always at end if visible) */}
                    {visibleColumns.actions && (
                      <td className="px-2 sm:px-3 py-3 min-w-20 text-right">
                        <div className="flex items-center gap-0.5 justify-end">
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

      {/* Column Customization Modal - NEW FLEXIBLE SYSTEM */}
      {showColumnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="border-b border-gray-200 p-6 pb-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Spalten anpassen</h3>
                <button
                  onClick={() => setShowColumnModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                  title="Schließen"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Search Field */}
              <div className="relative">
                <svg width="16" height="16" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  placeholder="Nach Feldname suchen…"
                  value={columnSearchQuery}
                  onChange={(e) => handleColumnSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400"
                />
              </div>

              {/* Column Counter */}
              <div className="mt-3 text-sm text-gray-600">
                <strong>{getColumnCount()}</strong> von <strong>35</strong> Spalten gewählt
              </div>
            </div>

            {/* Categories - Scrollable Content */}
            <div className="overflow-y-auto flex-1 p-6 space-y-6">
              {Object.entries(getFilteredCategories()).map(([categoryKey, category]) => {
                const categoryVisibleCount = category.fields.filter(
                  (field) => visibleColumns[field]
                ).length
                const isCategoryFullySelected = category.fields.every(
                  (field) => field === 'actions' || field === 'progress' || visibleColumns[field]
                )

                return (
                  <div key={categoryKey} className="border border-gray-200 rounded-lg p-4">
                    {/* Category Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{category.icon}</span>
                        <div>
                          <h4 className="font-semibold text-gray-900">{category.label}</h4>
                          {category.description && (
                            <p className="text-xs text-gray-500 mt-0.5">{category.description}</p>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {categoryVisibleCount}/{category.fields.length}
                      </span>
                    </div>

                    {/* Category Buttons */}
                    <div className="flex gap-2 mb-4">
                      <button
                        onClick={() => handleCategoryToggle(categoryKey, true)}
                        className="text-xs font-medium px-2.5 py-1.5 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded hover:bg-yellow-100 transition-colors"
                      >
                        Alle
                      </button>
                      <button
                        onClick={() => handleCategoryToggle(categoryKey, false)}
                        className="text-xs font-medium px-2.5 py-1.5 bg-gray-50 text-gray-700 border border-gray-200 rounded hover:bg-gray-100 transition-colors"
                      >
                        Keine
                      </button>
                    </div>

                    {/* Fields */}
                    <div className="space-y-2">
                      {category.fields.map((field) => (
                        <label key={field} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-gray-50 rounded">
                          <input
                            type="checkbox"
                            checked={visibleColumns[field]}
                            onChange={() => handleColumnToggle(field)}
                            className="w-4 h-4 rounded border-gray-300"
                          />
                          <span className="text-sm text-gray-900 flex-1">{FIELD_LABELS[field]}</span>
                          {(field === 'dialfire_campaign' || field === 'dialfire_task') && (
                            <span className="text-xs text-blue-600 font-semibold">⭐</span>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                )
              })}

              {/* No results message */}
              {Object.keys(getFilteredCategories()).length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-500 text-sm">Keine Spalten gefunden, die "{columnSearchQuery}" entsprechen</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 p-6 bg-gray-50 flex gap-3">
              <button
                onClick={handleResetColumns}
                className="px-4 py-2.5 text-sm font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Alle zurücksetzen
              </button>
              <button
                onClick={() => {
                  setShowColumnModal(false)
                  setColumnSearchQuery('')
                }}
                className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold px-4 py-2.5 rounded-lg transition-colors"
              >
                Fertig
              </button>
            </div>
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
