'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { KontaktEditModal } from '@/components/KontaktEditModal'
import { KontaktImportModal } from '@/components/KontaktImportModal'

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
  sparte?: string
  'prüfung_grund'?: string
  kontakt_typ?: string
  is_test_data?: boolean
  test_run_id?: string
  archived_at?: string | null
  tags?: { id: string; name: string }[]
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
  sparte: boolean
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
    fields: ['created_at', 'updated_at', 'notes', 'bestandskunde', 'sparte']
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
  sparte: 'Sparte',
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
  'created_at', 'updated_at', 'notes', 'bestandskunde', 'sparte',
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
  sparte: false,
  // UI
  progress: true,
  actions: true,
}

// Default column widths (in pixels)
const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  first_name: 60,
  last_name: 50,
  company_name: 70,
  email: 80,
  status: 50,
  pipeline_stage: 60,
  source: 50,
  progress: 50,
  actions: 60,
}

export default function KontaktePage() {
  const router = useRouter()
  const [kontakte, setKontakte] = useState<Kontakt[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [typFilter, setTypFilter] = useState<string>('all')
  const [stageFilter, setStageFilter] = useState<string>('all')
  const [sparteFilter, setSparteFilter] = useState<string>('all')
  const [pruefungFilter, setPruefungFilter] = useState<string>('all')
  const [tagFilter, setTagFilter] = useState<string[]>([])
  const [allTags, setAllTags] = useState<{ id: string; name: string }[]>([])
  const [tagFilterOpen, setTagFilterOpen] = useState(false)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [exporting, setExporting] = useState<'csv' | 'xlsx' | 'pdf' | null>(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [editingKontakt, setEditingKontakt] = useState<Kontakt | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [archiveTasksToo, setArchiveTasksToo] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  // Sortierung - erweitert für alle Spalten
  const [sortBy, setSortBy] = useState<keyof Kontakt | 'name' | 'progress'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  // Spalten-Customization
  const [visibleColumns, setVisibleColumns] = useState<ColumnVisibility>(DEFAULT_COLUMNS)
  const [columnOrder, setColumnOrder] = useState<(keyof ColumnVisibility)[]>(COLUMN_ORDER)
  const [columnWidths, setColumnWidths] = useState<Record<keyof ColumnVisibility, number>>({} as any)
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null)
  const [resizingColumn, setResizingColumn] = useState<string | null>(null)
  const [showColumnModal, setShowColumnModal] = useState(false)
  const [columnSearchQuery, setColumnSearchQuery] = useState('')
  const [columnDensity, setColumnDensity] = useState<'compact' | 'normal' | 'spacious'>('normal')
  const [showQuickNote, setShowQuickNote] = useState<string | null>(null)
  const [quickNoteText, setQuickNoteText] = useState('')
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null)

  // Alle Tags für den Filter laden
  useEffect(() => {
    fetch('/api/kontakt-tags')
      .then((r) => r.json())
      .then((res) => { if (res.success) setAllTags(res.data) })
      .catch(() => {})
  }, [])

  // Load column preferences from localStorage
  useEffect(() => {
    const savedVisibility = localStorage.getItem('kontakte-columns')
    const savedOrder = localStorage.getItem('kontakte-column-order')
    const savedDensity = localStorage.getItem('kontakte-density')
    const savedWidths = localStorage.getItem('kontakte-column-widths')

    if (savedVisibility) {
      try {
        setVisibleColumns(JSON.parse(savedVisibility))
      } catch (err) {
        console.error('Error loading column visibility:', err)
      }
    }

    if (savedOrder) {
      try {
        setColumnOrder(JSON.parse(savedOrder))
      } catch (err) {
        console.error('Error loading column order:', err)
      }
    }

    if (savedDensity) {
      try {
        setColumnDensity(JSON.parse(savedDensity))
      } catch (err) {
        console.error('Error loading density:', err)
      }
    }

    if (savedWidths) {
      try {
        setColumnWidths(JSON.parse(savedWidths))
      } catch (err) {
        console.error('Error loading column widths:', err)
        setColumnWidths(DEFAULT_COLUMN_WIDTHS as any)
      }
    } else {
      setColumnWidths(DEFAULT_COLUMN_WIDTHS as any)
    }
  }, [])

  // Save column preferences to localStorage
  const handleColumnToggle = (column: keyof ColumnVisibility) => {
    const updated = { ...visibleColumns, [column]: !visibleColumns[column] }
    setVisibleColumns(updated)
    localStorage.setItem('kontakte-columns', JSON.stringify(updated))
  }

  // Spalten verschieben (Drag & Drop Support via Array-Index)
  const moveColumn = (fromIndex: number, toIndex: number) => {
    const newOrder = [...columnOrder]
    const [removed] = newOrder.splice(fromIndex, 1)
    newOrder.splice(toIndex, 0, removed)
    setColumnOrder(newOrder)
    localStorage.setItem('kontakte-column-order', JSON.stringify(newOrder))
  }

  // Drag-to-Reorder für Spalten
  const handleColumnDragStart = (e: React.DragEvent, columnKey: string) => {
    setDraggedColumn(columnKey)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleColumnDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleColumnDrop = (e: React.DragEvent, targetColumnKey: string) => {
    e.preventDefault()
    if (!draggedColumn || draggedColumn === targetColumnKey) {
      setDraggedColumn(null)
      return
    }

    const fromIdx = columnOrder.indexOf(draggedColumn as keyof ColumnVisibility)
    const toIdx = columnOrder.indexOf(targetColumnKey as keyof ColumnVisibility)

    if (fromIdx !== -1 && toIdx !== -1) {
      moveColumn(fromIdx, toIdx)
    }
    setDraggedColumn(null)
  }

  // Drag-to-Resize für Spalten
  const handleResizeStart = (e: React.MouseEvent, columnKey: string) => {
    e.preventDefault()
    setResizingColumn(columnKey)

    const startX = e.clientX
    const startWidth = columnWidths[columnKey as keyof ColumnVisibility] || DEFAULT_COLUMN_WIDTHS[columnKey] || 120

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const diff = moveEvent.clientX - startX
      const newWidth = Math.max(20, startWidth + diff)

      setColumnWidths(prev => ({
        ...prev,
        [columnKey]: newWidth
      }))
    }

    const handleMouseUp = () => {
      setResizingColumn(null)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)

      // Speichern in localStorage
      setColumnWidths(prev => {
        localStorage.setItem('kontakte-column-widths', JSON.stringify(prev))
        return prev
      })
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
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

    // Ensure all fields are in columnOrder
    const newOrder = [...columnOrder]
    categoryConfig.fields.forEach((field) => {
      if (!newOrder.includes(field)) {
        newOrder.push(field)
      }
    })
    setColumnOrder(newOrder)
    localStorage.setItem('kontakte-column-order', JSON.stringify(newOrder))
  }

  // Reset all columns to default
  const handleResetColumns = () => {
    setVisibleColumns(DEFAULT_COLUMNS)
    setColumnOrder(COLUMN_ORDER)
    setColumnDensity('normal')
    setColumnWidths(DEFAULT_COLUMN_WIDTHS as any)
    setColumnSearchQuery('')
    localStorage.setItem('kontakte-columns', JSON.stringify(DEFAULT_COLUMNS))
    localStorage.setItem('kontakte-column-order', JSON.stringify(COLUMN_ORDER))
    localStorage.setItem('kontakte-density', JSON.stringify('normal'))
    localStorage.setItem('kontakte-column-widths', JSON.stringify(DEFAULT_COLUMN_WIDTHS))
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
  }, [activeFilter, search, showArchived])

  async function loadKontakte() {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set('limit', '500')
      if (activeFilter !== 'all') params.set('status', activeFilter)
      if (search) params.set('search', search)
      if (showArchived) params.set('includeArchived', 'true')

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

  async function handleArchiveKontakt(id: string, archiveTasks: boolean) {
    try {
      const res = await fetch(`/api/kontakte/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archiveTasks }),
      })
      if (!res.ok) throw new Error('Archivieren fehlgeschlagen')
      setDeleteConfirm(null)
      setArchiveTasksToo(false)
      await loadKontakte()
    } catch (err) {
      console.error('Fehler beim Archivieren:', err)
    }
  }

  async function handleRestoreKontakt(id: string) {
    setRestoringId(id)
    try {
      const res = await fetch(`/api/kontakte/${id}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) throw new Error('Wiederherstellen fehlgeschlagen')
      await loadKontakte()
    } catch (err) {
      console.error('Fehler beim Wiederherstellen:', err)
    } finally {
      setRestoringId(null)
    }
  }

  async function handleExport(format: 'csv' | 'xlsx' | 'pdf') {
    setExportMenuOpen(false)
    setExporting(format)
    try {
      const params = new URLSearchParams()
      params.set('format', format)
      if (activeFilter !== 'all') params.set('status', activeFilter)
      if (search) params.set('search', search)
      if (sourceFilter !== 'all') params.set('source', sourceFilter)
      if (typFilter !== 'all') params.set('kontakt_typ', typFilter)
      if (stageFilter !== 'all') params.set('pipeline_stage', stageFilter)
      if (sparteFilter !== 'all') params.set('sparte', sparteFilter)
      if (pruefungFilter !== 'all') params.set('pruefung_grund', pruefungFilter)
      if (tagFilter.length > 0) params.set('tags', tagFilter.join(','))
      if (showArchived) params.set('includeArchived', 'true')

      const res = await fetch(`/api/kontakte/export?${params.toString()}`)
      if (!res.ok) throw new Error('Export fehlgeschlagen')

      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition') || ''
      const match = disposition.match(/filename="([^"]+)"/)
      const filename = match?.[1] || `kontakte_export.${format}`

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Fehler beim Export:', err)
    } finally {
      setExporting(null)
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

  // Sortierungs-Logik - erweitert für alle Spalten
  const sorted = [...kontakte].sort((a, b) => {
    let compareValue = 0

    if (sortBy === 'name') {
      compareValue = `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)
    } else if (sortBy === 'progress') {
      compareValue = getStepNumber(a.pipeline_stage) - getStepNumber(b.pipeline_stage)
    } else {
      const aVal = (a as any)[sortBy]
      const bVal = (b as any)[sortBy]

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        compareValue = aVal - bVal
      } else if (aVal instanceof Date || bVal instanceof Date) {
        const aTime = aVal instanceof Date ? aVal.getTime() : new Date(aVal).getTime()
        const bTime = bVal instanceof Date ? bVal.getTime() : new Date(bVal).getTime()
        compareValue = aTime - bTime
      } else if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
        compareValue = (aVal ? 1 : 0) - (bVal ? 1 : 0)
      } else {
        compareValue = String(aVal || '').localeCompare(String(bVal || ''))
      }
    }

    return sortOrder === 'asc' ? compareValue : -compareValue
  })

  const filtered = sorted.filter((k) => {
    if (activeFilter !== 'all' && k.status !== activeFilter) return false
    if (sourceFilter !== 'all' && (k.source || 'manuell') !== sourceFilter) return false
    if (typFilter !== 'all' && (k.kontakt_typ || 'gewerbe') !== typFilter) return false
    if (stageFilter !== 'all' && k.pipeline_stage !== stageFilter) return false
    if (sparteFilter !== 'all' && k.sparte !== sparteFilter) return false
    if (pruefungFilter !== 'all' && (k['prüfung_grund'] || '') !== pruefungFilter) return false
    if (tagFilter.length > 0 && !tagFilter.every((tId) => (k.tags ?? []).some((t) => t.id === tId))) return false
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

  // Filter-Optionen dynamisch aus den geladenen Kontakten ableiten
  const sparteOptions = Array.from(
    new Set(kontakte.map((k) => k.sparte).filter((v): v is string => !!v))
  ).sort()
  const pruefungOptions = Array.from(
    new Set(kontakte.map((k) => k['prüfung_grund']).filter((v): v is string => !!v))
  ).sort()

  const toggleSort = (field: keyof Kontakt | 'name' | 'progress') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
  }

  const SortIcon = ({ field }: { field: keyof Kontakt | 'name' | 'progress' }) => {
    if (sortBy !== field) return <span className="text-gray-300">⇅</span>
    return <span>{sortOrder === 'asc' ? '▲' : '▼'}</span>
  }

  // Column width helper - responsive & compact
  const getColumnWidth = () => {
    switch (columnDensity) {
      case 'compact': return { min: 'min-w-28', header: 'px-2', cell: 'px-2' }
      case 'spacious': return { min: 'min-w-56', header: 'px-6', cell: 'px-6' }
      default: return { min: 'min-w-40', header: 'px-4', cell: 'px-4' }
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap sm:flex-nowrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Kontakte</h1>
          <p className="text-gray-500 text-sm mt-0.5">{loading ? 'Lädt…' : `${kontakte.length} Kontakte gesamt`}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setImportModalOpen(true)}
            className="flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors whitespace-nowrap"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Importieren
          </button>
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

          <div className="relative">
            <button
              onClick={() => setExportMenuOpen((v) => !v)}
              disabled={exporting !== null}
              className="px-3 py-2.5 text-sm font-medium bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap disabled:opacity-50"
            >
              {exporting ? `⏳ ${exporting.toUpperCase()}…` : '⬇ Exportieren'}
            </button>
            {exportMenuOpen && (
              <div className="absolute right-0 z-20 mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                {(['csv', 'xlsx', 'pdf'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => handleExport(fmt)}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-yellow-50 transition-colors"
                  >
                    Als {fmt.toUpperCase()}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Status + weitere Filter */}
        <div className="flex gap-2 flex-wrap items-center">
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            className={`px-3 py-2 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400/40 ${
              activeFilter !== 'all' ? 'border-yellow-400 font-medium' : 'border-gray-200 text-gray-600'
            }`}
            title="Nach Status filtern"
          >
            {KONTAKT_FILTER.map((f) => {
              const count = f.value === 'all' ? kontakte.length : kontakte.filter((k) => k.status === f.value).length
              return (
                <option key={f.value} value={f.value}>
                  {f.label} ({count})
                </option>
              )
            })}
          </select>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className={`max-w-full min-w-0 px-3 py-2 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400/40 ${
              sourceFilter !== 'all' ? 'border-yellow-400 font-medium' : 'border-gray-200 text-gray-600'
            }`}
            title="Nach Quelle filtern"
          >
            <option value="all">Quelle: Alle</option>
            {Object.entries(SOURCE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          <select
            value={typFilter}
            onChange={(e) => setTypFilter(e.target.value)}
            className={`max-w-full min-w-0 px-3 py-2 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400/40 ${
              typFilter !== 'all' ? 'border-yellow-400 font-medium' : 'border-gray-200 text-gray-600'
            }`}
            title="Nach Kontakt-Typ filtern"
          >
            <option value="all">Typ: Alle</option>
            <option value="gewerbe">🏢 Gewerbe</option>
            <option value="privat">👤 Privat</option>
          </select>

          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className={`px-3 py-2 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400/40 ${
              stageFilter !== 'all' ? 'border-yellow-400 font-medium' : 'border-gray-200 text-gray-600'
            }`}
            title="Nach Prozessschritt filtern"
          >
            <option value="all">Schritt: Alle</option>
            {PIPELINE_STEPS.map((s, i) => (
              <option key={s.key} value={s.key}>{i + 1}. {s.label}</option>
            ))}
          </select>

          <select
            value={sparteFilter}
            onChange={(e) => setSparteFilter(e.target.value)}
            className={`max-w-full min-w-0 px-3 py-2 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400/40 ${
              sparteFilter !== 'all' ? 'border-yellow-400 font-medium' : 'border-gray-200 text-gray-600'
            }`}
            title="Nach Sparte filtern"
          >
            <option value="all">Sparte: Alle</option>
            {sparteOptions.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          {pruefungOptions.length > 0 && (
            <select
              value={pruefungFilter}
              onChange={(e) => setPruefungFilter(e.target.value)}
              className={`max-w-full min-w-0 px-3 py-2 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400/40 ${
                pruefungFilter !== 'all' ? 'border-yellow-400 font-medium' : 'border-gray-200 text-gray-600'
              }`}
              title="Nach Prüfgrund filtern"
            >
              <option value="all">Prüfgrund: Alle</option>
              {pruefungOptions.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          )}

          {allTags.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setTagFilterOpen((v) => !v)}
                className={`max-w-full min-w-0 px-3 py-2 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400/40 ${
                  tagFilter.length > 0 ? 'border-yellow-400 font-medium' : 'border-gray-200 text-gray-600'
                }`}
              >
                🏷️ Tags{tagFilter.length > 0 ? ` (${tagFilter.length})` : ': Alle'}
              </button>
              {tagFilterOpen && (
                <div className="absolute z-20 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto p-2">
                  {allTags.map((tag) => (
                    <label key={tag.id} className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-gray-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tagFilter.includes(tag.id)}
                        onChange={(e) => {
                          setTagFilter((prev) =>
                            e.target.checked ? [...prev, tag.id] : prev.filter((id) => id !== tag.id)
                          )
                        }}
                        className="rounded border-gray-300 text-yellow-500 focus:ring-yellow-400"
                      />
                      {tag.name}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-gray-600 whitespace-nowrap px-1">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded border-gray-300 text-yellow-500 focus:ring-yellow-400"
            />
            Archivierte anzeigen
          </label>

          {(sourceFilter !== 'all' || typFilter !== 'all' || stageFilter !== 'all' || sparteFilter !== 'all' || pruefungFilter !== 'all' || activeFilter !== 'all' || tagFilter.length > 0 || search) && (
            <button
              onClick={() => {
                setActiveFilter('all')
                setSourceFilter('all')
                setTypFilter('all')
                setStageFilter('all')
                setSparteFilter('all')
                setPruefungFilter('all')
                setTagFilter([])
                setSearch('')
              }}
              className="text-xs text-gray-500 hover:text-gray-900 font-medium underline-offset-2 hover:underline"
            >
              ✕ Filter zurücksetzen
            </button>
          )}
        </div>
      </div>

      {/* Tabelle — DYNAMISCHE SPALTEN (nur Desktop) */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
          <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
            <thead className="sticky top-0 z-10 bg-gray-50/95 border-b border-gray-100">
              <tr className="border-b border-gray-100 bg-gray-50/80">
                {/* DYNAMISCH: Loop through all visible columns in CUSTOM ORDER */}
                {columnOrder
                  .filter(key => visibleColumns[key] && key !== 'progress' && key !== 'actions')
                  .map((columnKey, idx) => {
                    const key = columnKey as keyof ColumnVisibility
                    const label = FIELD_LABELS[key]
                    const isBlueField = key.includes('dialfire')
                    const width = columnWidths[key] || DEFAULT_COLUMN_WIDTHS[key] || 120
                    const isDragging = draggedColumn === key

                    return (
                      <th
                        key={key}
                        draggable
                        onDragStart={(e) => handleColumnDragStart(e, key)}
                        onDragOver={handleColumnDragOver}
                        onDrop={(e) => handleColumnDrop(e, key)}
                        className={`text-left text-sm font-semibold ${isBlueField ? 'text-blue-600' : 'text-gray-700'} uppercase tracking-wide py-3 px-4 relative select-none transition-colors ${isDragging ? 'bg-yellow-50' : ''}`}
                        style={{ width: `${width}px`, minWidth: `${width}px` }}
                      >
                        <div className="flex items-center gap-1 cursor-move">
                          <button
                            onClick={() => toggleSort(key === 'first_name' ? 'name' : (key as keyof Kontakt))}
                            className="flex items-center gap-1 hover:text-gray-900 flex-1 min-w-0"
                            title={`Nach ${label} sortieren`}
                          >
                            <span className="truncate">{label}</span>
                            <SortIcon field={key === 'first_name' ? 'name' : (key as keyof Kontakt)} />
                          </button>
                        </div>

                        {/* Resize Handle */}
                        <div
                          onMouseDown={(e) => handleResizeStart(e, key)}
                          className={`absolute top-0 right-0 w-3 h-full cursor-col-resize hover:bg-yellow-400 transition-colors ${resizingColumn === key ? 'bg-yellow-400' : 'hover:bg-gray-300'}`}
                          title="Ziehen zum Ändern der Spaltenbreite"
                        />
                      </th>
                    )
                  })}

                {/* PROGRESS Column (if visible) */}
                {visibleColumns.progress && (
                  <th className={`text-left text-sm font-semibold text-gray-700 uppercase tracking-wide py-3 px-4 relative select-none`} style={{ width: '110px', minWidth: '110px' }}>
                    <button onClick={() => toggleSort('progress')} className="flex items-center gap-1 hover:text-gray-900">
                      Fort. <SortIcon field="progress" />
                    </button>
                  </th>
                )}

                {/* ACTIONS Column (always at end if visible) */}
                {visibleColumns.actions && (
                  <th className={`text-left text-sm font-semibold text-gray-700 uppercase tracking-wide py-3 px-4 text-right`} style={{ width: '120px', minWidth: '120px' }}>
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
                    onClick={() => router.push(`/kontakte/${kontakt.id}`)}
                    onMouseEnter={() => setHoveredRowId(kontakt.id)}
                    onMouseLeave={() => setHoveredRowId(null)}
                    className={`border-b border-gray-100 cursor-pointer transition-all ${
                      hoveredRowId === kontakt.id
                        ? 'bg-yellow-50 shadow-md border-2 border-yellow-300'
                        : 'border-gray-100 hover:bg-gray-50/50'
                    }`}
                  >
                    {/* DYNAMISCH: Loop through all visible columns in CUSTOM ORDER */}
                    {columnOrder
                      .filter(key => visibleColumns[key] && key !== 'progress' && key !== 'actions')
                      .map((columnKey, idx) => {
                        const key = columnKey as keyof ColumnVisibility
                        const width = columnWidths[key] || DEFAULT_COLUMN_WIDTHS[key] || 120
                        let value: any = (kontakt as any)[key]

                        // Format value based on column type
                        let displayContent: React.ReactNode = '—'

                        if (key === 'first_name') {
                          displayContent = (
                            <div>
                              <p className="font-semibold text-gray-900 truncate">
                                {kontakt.first_name} {kontakt.last_name}
                                {kontakt.archived_at && (
                                  <span className="ml-2 inline-flex rounded-full bg-gray-200 px-2 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide text-gray-600">
                                    Archiviert
                                  </span>
                                )}
                                {kontakt.is_test_data && (
                                  <span className="ml-2 inline-flex rounded-full bg-violet-100 px-2 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide text-violet-700">
                                    Testdaten
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-gray-500 mt-0.5 truncate">{kontakt.email || kontakt.id}</p>
                            </div>
                          )
                        } else if (key === 'status') {
                          displayContent = kontakt.archived_at ? (
                            <span className="inline-flex text-xs font-medium px-2 py-1 rounded-full bg-gray-200 text-gray-600">
                              Archiviert
                            </span>
                          ) : (
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

                        return (
                          <td
                            key={key}
                            className={`px-4 py-3 text-sm`}
                            style={{ width: `${width}px`, minWidth: `${width}px` }}
                          >
                            {displayContent}
                          </td>
                        )
                      })}

                    {/* PROGRESS Column (if visible) */}
                    {visibleColumns.progress && (
                      <td className={`px-4 py-3 text-sm`} style={{ width: '110px', minWidth: '110px' }}>
                        <div className="flex items-center gap-1.5">
                          <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden flex-shrink-0">
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
                      <td className={`px-4 py-3 text-right`} style={{ width: '120px', minWidth: '120px' }} onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-0.5 justify-end pointer-events-auto">
                          {/* Quick Note */}
                          <button
                            onClick={(e) => {
                              e.preventDefault()
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
                          <button
                            className="p-1 rounded text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-all flex-shrink-0"
                            title="Details"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              router.push(`/kontakte/${kontakt.id}`)
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                              <path d="M6.5 2H20a2 2 0 012 2v14" />
                            </svg>
                          </button>

                          {/* Archivieren / Wiederherstellen */}
                          {kontakt.archived_at ? (
                            <button
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                handleRestoreKontakt(kontakt.id)
                              }}
                              disabled={restoringId === kontakt.id}
                              className="p-1 rounded text-gray-400 hover:text-green-600 hover:bg-green-50 transition-all flex-shrink-0 disabled:opacity-50"
                              title="Wiederherstellen"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8" />
                                <path d="M3 3v5h5" />
                              </svg>
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                setArchiveTasksToo(false)
                                setDeleteConfirm(kontakt.id)
                              }}
                              className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all flex-shrink-0"
                              title="Archivieren"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                              </svg>
                            </button>
                          )}
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

      {/* Karten-Ansicht — nur Mobile */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <p className="text-center text-gray-400 py-12 text-sm">Kontakte werden geladen…</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-400 py-12 text-sm">
            {kontakte.length === 0 ? 'Noch keine Kontakte vorhanden.' : 'Keine Kontakte gefunden.'}
          </p>
        ) : (
          filtered.map((kontakt) => (
            <div key={kontakt.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-start justify-between gap-3">
                <Link href={`/kontakte/${kontakt.id}`} className="min-w-0 group">
                  <p className="font-semibold text-yellow-600 group-hover:underline truncate">
                    {kontakt.first_name} {kontakt.last_name}
                  </p>
                  {kontakt.archived_at && (
                    <span className="mt-1 mr-1 inline-flex rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-600">
                      Archiviert
                    </span>
                  )}
                  {kontakt.is_test_data && (
                    <span className="mt-1 inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700">
                      Testdaten
                    </span>
                  )}
                  {kontakt.company_name && (
                    <p className="text-sm text-gray-600 truncate">{kontakt.company_name}</p>
                  )}
                  <p className="text-xs text-gray-400 truncate mt-0.5">{kontakt.email || kontakt.id}</p>
                </Link>
                {kontakt.archived_at ? (
                  <span className="text-xs font-medium px-2 py-1.5 rounded-lg bg-gray-200 text-gray-600 flex-shrink-0">
                    Archiviert
                  </span>
                ) : (
                  <select
                    value={kontakt.status}
                    onChange={(e) => handleStatusChange(kontakt.id, e.target.value)}
                    className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 flex-shrink-0"
                  >
                    {Object.entries(STATUS_LABELS).map(([optKey, label]) => (
                      <option key={optKey} value={optKey}>{label}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {kontakt.source && (
                  <span className={`inline-flex text-xs font-medium px-2 py-1 rounded-full ${SOURCE_COLORS[kontakt.source] || SOURCE_COLORS['manuell']}`}>
                    {SOURCE_LABELS[kontakt.source] || kontakt.source}
                  </span>
                )}
                <span className="text-xs text-gray-500">{getStepLabel(kontakt.pipeline_stage)}</span>
                <div className="flex items-center gap-1.5 ml-auto">
                  <div className="w-14 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${(getStepNumber(kontakt.pipeline_stage) / 12) * 100}%` }} />
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">{getStepNumber(kontakt.pipeline_stage)}/12</span>
                </div>
              </div>

              <div className="flex items-center gap-1 mt-3 pt-3 border-t border-gray-100">
                <button
                  onClick={() => setShowQuickNote(kontakt.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-gray-600 hover:text-blue-600 hover:bg-blue-50"
                  aria-label="Notiz"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                  Notiz
                </button>
                <Link
                  href={`/kontakte/${kontakt.id}`}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20a2 2 0 012 2v14" /></svg>
                  Öffnen
                </Link>
                {kontakt.archived_at ? (
                  <button
                    onClick={() => handleRestoreKontakt(kontakt.id)}
                    disabled={restoringId === kontakt.id}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-gray-600 hover:text-green-600 hover:bg-green-50 disabled:opacity-50"
                    aria-label="Wiederherstellen"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
                    Wiederherstellen
                  </button>
                ) : (
                  <button
                    onClick={() => { setArchiveTasksToo(false); setDeleteConfirm(kontakt.id) }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-gray-600 hover:text-red-600 hover:bg-red-50"
                    aria-label="Archivieren"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                    Archivieren
                  </button>
                )}
              </div>
            </div>
          ))
        )}
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

              {/* Density Control */}
              <div className="mb-4 flex gap-2">
                <label className="text-sm font-medium text-gray-700">Spaltenbreite:</label>
                <div className="flex gap-2">
                  {(['compact', 'normal', 'spacious'] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => {
                        setColumnDensity(d)
                        localStorage.setItem('kontakte-density', JSON.stringify(d))
                      }}
                      className={`text-xs font-medium px-2.5 py-1.5 rounded border transition-colors ${
                        columnDensity === d
                          ? 'bg-yellow-400 text-gray-900 border-yellow-500'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {d === 'compact' ? 'Kompakt' : d === 'normal' ? 'Normal' : 'Geräumig'}
                    </button>
                  ))}
                </div>
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

      <KontaktImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImported={loadKontakte}
      />

      {/* Archivieren-Bestätigung */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Kontakt archivieren?</h3>
            <p className="text-gray-600 text-sm mb-4">Dieser Kontakt wird archiviert und aus der Kontaktübersicht ausgeblendet. Die Archivierung kann jederzeit rückgängig gemacht werden.</p>
            <label className="flex items-center gap-2 mb-6 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={archiveTasksToo}
                onChange={(e) => setArchiveTasksToo(e.target.checked)}
                className="rounded border-gray-300 text-yellow-500 focus:ring-yellow-400"
              />
              Zugehörige Aufgaben ebenfalls archivieren
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => { setDeleteConfirm(null); setArchiveTasksToo(false) }}
                className="flex-1 border border-gray-200 text-gray-600 font-medium text-sm px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={() => {
                  handleArchiveKontakt(deleteConfirm, archiveTasksToo)
                }}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors"
              >
                Ja, archivieren
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
