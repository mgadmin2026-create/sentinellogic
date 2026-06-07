'use client'
// Kontakt-Detail-Seite mit 6 Tabs: Übersicht, Aktivitäten, Aufgaben, Opportunities, Notizen, Dokumente
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { KontaktEditModal } from '@/components/KontaktEditModal'
import { AufgabenEditModal } from '@/components/AufgabenEditModal'
import { OpportunityEditModal } from '@/components/OpportunityEditModal'

interface Kontakt {
  id: string
  first_name: string
  last_name: string
  email: string
  phone_mobile?: string
  phone_office?: string
  company_name?: string
  industry?: string
  position?: string
  street?: string
  postal_code?: string
  city?: string
  country?: string
  website?: string
  source?: string
  status: 'new' | 'contacted' | 'qualified' | 'customer'
  pipeline_stage?: string
  pipeline_steps?: Array<{
    key: string
    done: boolean
    completed_at?: string
    due_date?: string
  }>
  assigned_user_id?: string
  assigned_user_name?: string
  qualität?: string
  bestandskunde?: boolean
  notes?: string
  created_at: string
}

interface Aktivität {
  id: string
  type: string
  description: string
  data?: Record<string, any>
  created_at: string
}

interface Aufgabe {
  id: string
  titel: string
  status: 'offen' | 'in_bearbeitung' | 'erledigt'
  priorität: 'niedrig' | 'mittel' | 'hoch'
  fällig: string
  assigned_user_name?: string
}

interface Opportunity {
  id: string
  thema: string
  status: string
  wert?: number
  fällig?: string
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  qualified: 'bg-emerald-100 text-emerald-800',
  customer: 'bg-purple-100 text-purple-800',
}

const STATUS_LABELS: Record<string, string> = {
  new: 'Neu',
  contacted: 'Kontaktiert',
  qualified: 'Qualifiziert',
  customer: 'Kunde',
}

const TABS = [
  { id: 'overview', label: 'Übersicht', icon: '👤' },
  { id: 'activities', label: 'Aktivitäten', icon: '📝' },
  { id: 'tasks', label: 'Aufgaben', icon: '✓' },
  { id: 'opportunities', label: 'Opportunities', icon: '💼' },
  { id: 'notes', label: 'Notizen', icon: '📋' },
  { id: 'documents', label: 'Dokumente', icon: '📄' },
]

export default function KontaktDetailPage() {
  const params = useParams()
  const router = useRouter()
  const kontaktId = params.id as string

  const [activeTab, setActiveTab] = useState('overview')
  const [kontakt, setKontakt] = useState<Kontakt | null>(null)
  const [loading, setLoading] = useState(true)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [newTaskModalOpen, setNewTaskModalOpen] = useState(false)
  const [newOppModalOpen, setNewOppModalOpen] = useState(false)
  const [notesEditMode, setNotesEditMode] = useState(false)
  const [notes, setNotes] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)
  const [aktivitäten, setAktivitäten] = useState<Aktivität[]>([])
  const [aufgaben, setAufgaben] = useState<Aufgabe[]>([])
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  useEffect(() => {
    loadKontakt()
  }, [kontaktId])

  async function loadKontakt() {
    try {
      setLoading(true)
      const res = await fetch(`/api/kontakte/${kontaktId}`)
      const json = await res.json()
      if (json.success) {
        const data = json.data
        setKontakt(data)
        setNotes(data.notes || '')
        setAktivitäten(data.activities || [])
        setAufgaben(data.tasks || [])
        setOpportunities(data.opportunities || [])
      }
    } catch (err) {
      console.error('Fehler beim Laden des Kontakts:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveKontakt(formData: any) {
    try {
      const res = await fetch(`/api/kontakte/${kontaktId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!res.ok) throw new Error('Fehler beim Speichern')
      setEditModalOpen(false)
      await loadKontakt()
    } catch (err: any) {
      throw err
    }
  }

  async function handleSaveNotes() {
    try {
      setNotesSaving(true)
      const res = await fetch(`/api/kontakte/${kontaktId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
      if (!res.ok) throw new Error('Fehler beim Speichern')
      setNotesEditMode(false)
      await loadKontakt()
    } catch (err) {
      console.error('Fehler:', err)
    } finally {
      setNotesSaving(false)
    }
  }

  async function handleDeleteKontakt() {
    try {
      const res = await fetch(`/api/kontakte/${kontaktId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Fehler beim Löschen')
      router.push('/kontakte')
    } catch (err) {
      console.error('Fehler beim Löschen:', err)
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
      setNewTaskModalOpen(false)
      await loadKontakt()
    } catch (err: any) {
      throw err
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
      setNewOppModalOpen(false)
      await loadKontakt()
    } catch (err: any) {
      throw err
    }
  }

  async function handleStatusChange(newStatus: string) {
    try {
      const res = await fetch(`/api/kontakte/${kontaktId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        await loadKontakt()
      }
    } catch (err) {
      console.error('Fehler:', err)
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-gray-400">Kontakt wird geladen…</p>
      </div>
    )
  }

  if (!kontakt) {
    return (
      <div className="p-8">
        <p className="text-gray-400">Kontakt nicht gefunden.</p>
        <Link href="/kontakte" className="text-yellow-600 hover:underline mt-2 inline-block">
          ← Zurück zur Übersicht
        </Link>
      </div>
    )
  }

  const fullName = `${kontakt.first_name} ${kontakt.last_name}`

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{fullName}</h1>
          <p className="text-gray-500 text-sm mt-1">{kontakt.company_name || 'Kein Unternehmen'}</p>
        </div>
        <div className="flex gap-2">
          <select
            value={kontakt.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className={`text-sm font-medium px-3 py-2 rounded-lg border-0 cursor-pointer ${STATUS_COLORS[kontakt.status]}`}
          >
            <option value="new">Neu</option>
            <option value="contacted">Kontaktiert</option>
            <option value="qualified">Qualifiziert</option>
            <option value="customer">Kunde</option>
          </select>
          <button
            onClick={() => setEditModalOpen(true)}
            className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold text-sm px-4 py-2 rounded-lg transition-colors"
          >
            Bearbeiten
          </button>
          <button
            onClick={() => setDeleteConfirm(true)}
            className="flex items-center gap-2 bg-red-100 hover:bg-red-200 text-red-700 font-semibold text-sm px-4 py-2 rounded-lg transition-colors"
          >
            Löschen
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-0.5 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                activeTab === tab.id ? 'text-yellow-600 border-yellow-600' : 'text-gray-600 border-transparent hover:text-gray-900'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {/* TAB: Übersicht */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-3 gap-6">
            {/* Linke Spalte: Kontaktinfo */}
            <div className="col-span-2 space-y-6">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Kontaktinformationen</h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 font-semibold uppercase">E-Mail</p>
                      <p className="text-sm text-gray-900 mt-1">
                        <a href={`mailto:${kontakt.email}`} className="text-yellow-600 hover:underline">
                          {kontakt.email}
                        </a>
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-semibold uppercase">Telefon Mobil</p>
                      <p className="text-sm text-gray-900 mt-1">
                        {kontakt.phone_mobile ? (
                          <a href={`tel:${kontakt.phone_mobile}`} className="text-yellow-600 hover:underline">
                            {kontakt.phone_mobile}
                          </a>
                        ) : (
                          '—'
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 font-semibold uppercase">Telefon Büro</p>
                      <p className="text-sm text-gray-900 mt-1">
                        {kontakt.phone_office ? (
                          <a href={`tel:${kontakt.phone_office}`} className="text-yellow-600 hover:underline">
                            {kontakt.phone_office}
                          </a>
                        ) : (
                          '—'
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-semibold uppercase">Website</p>
                      <p className="text-sm text-gray-900 mt-1">
                        {kontakt.website ? (
                          <a href={kontakt.website} target="_blank" rel="noopener noreferrer" className="text-yellow-600 hover:underline">
                            {kontakt.website.replace('https://', '')}
                          </a>
                        ) : (
                          '—'
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Adresse</h2>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-gray-500 font-semibold uppercase">Firma</p>
                    <p className="text-sm text-gray-900 mt-1">{kontakt.company_name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-semibold uppercase">Position</p>
                    <p className="text-sm text-gray-900 mt-1">{kontakt.position || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-semibold uppercase">Straße</p>
                    <p className="text-sm text-gray-900 mt-1">{kontakt.street || '—'}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 font-semibold uppercase">PLZ</p>
                      <p className="text-sm text-gray-900 mt-1">{kontakt.postal_code || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-semibold uppercase">Ort</p>
                      <p className="text-sm text-gray-900 mt-1">{kontakt.city || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-semibold uppercase">Land</p>
                      <p className="text-sm text-gray-900 mt-1">{kontakt.country || '—'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Rechte Spalte: Status & Metadata */}
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-xs text-gray-500 font-semibold uppercase mb-2">Status</p>
                <span className={`inline-flex text-sm font-medium px-3 py-1.5 rounded-full ${STATUS_COLORS[kontakt.status]}`}>
                  {STATUS_LABELS[kontakt.status]}
                </span>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-xs text-gray-500 font-semibold uppercase mb-2">Quelle</p>
                <p className="text-sm text-gray-900 font-medium capitalize">{kontakt.source || 'Manuell'}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-xs text-gray-500 font-semibold uppercase mb-2">Qualität</p>
                <p className="text-sm text-gray-900">{kontakt.qualität || '—'}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-xs text-gray-500 font-semibold uppercase mb-2">Bestandskunde</p>
                <p className="text-sm text-gray-900">{kontakt.bestandskunde ? '✓ Ja' : 'Nein'}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-xs text-gray-500 font-semibold uppercase mb-2">Erstellt</p>
                <p className="text-sm text-gray-900">{new Date(kontakt.created_at).toLocaleDateString('de-DE')}</p>
              </div>
            </div>
          </div>
        )}

        {/* TAB: Aktivitäten */}
        {activeTab === 'activities' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Aktivitätshistorie</h2>
            {aktivitäten.length === 0 ? (
              <p className="text-gray-400 text-sm">Keine Aktivitäten vorhanden.</p>
            ) : (
              <div className="space-y-4">
                {aktivitäten.map((akt, i) => (
                  <div key={akt.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600 font-bold flex-shrink-0">
                        {i + 1}
                      </div>
                      {i < aktivitäten.length - 1 && <div className="w-0.5 h-8 bg-gray-200 mt-2" />}
                    </div>
                    <div className="flex-1 pt-1">
                      <p className="text-sm font-medium text-gray-900">{akt.description}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(akt.created_at).toLocaleDateString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: Aufgaben */}
        {activeTab === 'tasks' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Aufgaben für diesen Kontakt</h2>
              <button
                onClick={() => setNewTaskModalOpen(true)}
                className="text-yellow-600 hover:text-yellow-700 text-sm font-medium"
              >
                + Neue Aufgabe
              </button>
            </div>
            {aufgaben.length === 0 ? (
              <div className="p-6 text-center text-gray-400">
                <p>Keine Aufgaben für diesen Kontakt.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      {['Titel', 'Status', 'Priorität', 'Fällig'].map((h) => (
                        <th key={h} className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-6 py-3">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {aufgaben.map((aufgabe) => (
                      <tr key={aufgabe.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-6 py-3.5 text-gray-900 font-medium">{aufgabe.titel}</td>
                        <td className="px-6 py-3.5">
                          <span
                            className={`inline-flex text-xs font-medium px-2.5 py-1 rounded-full ${
                              aufgabe.status === 'offen'
                                ? 'bg-red-100 text-red-800'
                                : aufgabe.status === 'in_bearbeitung'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {aufgabe.status === 'offen' ? 'Offen' : aufgabe.status === 'in_bearbeitung' ? 'In Bearbeitung' : 'Erledigt'}
                          </span>
                        </td>
                        <td className="px-6 py-3.5">
                          <span
                            className={`text-xs font-bold ${
                              aufgabe.priorität === 'hoch' ? 'text-red-600' : aufgabe.priorität === 'mittel' ? 'text-orange-600' : 'text-gray-600'
                            }`}
                          >
                            {aufgabe.priorität.charAt(0).toUpperCase() + aufgabe.priorität.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-gray-600">{new Date(aufgabe.fällig).toLocaleDateString('de-DE')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB: Opportunities */}
        {activeTab === 'opportunities' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Opportunities für diesen Kontakt</h2>
              <button
                onClick={() => setNewOppModalOpen(true)}
                className="text-yellow-600 hover:text-yellow-700 text-sm font-medium"
              >
                + Neue Opportunity
              </button>
            </div>
            {opportunities.length === 0 ? (
              <div className="p-6 text-center text-gray-400">
                <p>Keine Opportunities für diesen Kontakt.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      {['Thema', 'Status', 'Wert', 'Fällig'].map((h) => (
                        <th key={h} className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-6 py-3">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {opportunities.map((opp) => (
                      <tr key={opp.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-6 py-3.5 text-gray-900 font-medium">{opp.thema}</td>
                        <td className="px-6 py-3.5">
                          <span className="inline-flex text-xs font-medium px-2.5 py-1 rounded-full bg-purple-100 text-purple-800">{opp.status}</span>
                        </td>
                        <td className="px-6 py-3.5 text-gray-900 font-semibold">{opp.wert ? `${(opp.wert / 1000).toFixed(0)}K €` : '—'}</td>
                        <td className="px-6 py-3.5 text-gray-600">{opp.fällig ? new Date(opp.fällig).toLocaleDateString('de-DE') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB: Notizen */}
        {activeTab === 'notes' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Notizen</h2>
            {notesEditMode ? (
              <div className="space-y-3">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notizen zum Kontakt…"
                  className="w-full h-64 p-4 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveNotes}
                    disabled={notesSaving}
                    className="flex-1 bg-yellow-400 hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors"
                  >
                    {notesSaving ? 'Speichert…' : 'Speichern'}
                  </button>
                  <button
                    onClick={() => {
                      setNotesEditMode(false)
                      setNotes(kontakt.notes || '')
                    }}
                    className="flex-1 border border-gray-200 text-gray-600 font-medium text-sm px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            ) : (
              <div>
                {notes ? (
                  <div className="bg-gray-50 rounded-lg p-4 whitespace-pre-wrap text-sm text-gray-700 mb-4">{notes}</div>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-400 mb-4">Keine Notizen vorhanden.</div>
                )}
                <button onClick={() => setNotesEditMode(true)} className="text-yellow-600 hover:text-yellow-700 text-sm font-medium">
                  Bearbeiten
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB: Dokumente */}
        {activeTab === 'documents' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Dokumente & Google Drive</h2>
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />
                  <polyline points="13 2 13 9 20 9" />
                </svg>
              </div>
              <p className="text-gray-900 font-medium mb-1">Google Drive Integration</p>
              <p className="text-sm text-gray-500 mb-4">Phase 2 — Dokumente automatisch aus Google Drive verknüpfen</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-8 text-center">
        <Link href="/kontakte" className="text-gray-500 hover:text-gray-900 text-sm font-medium">
          ← Zurück zur Übersicht
        </Link>
      </div>

      {/* Edit Modal */}
      <KontaktEditModal
        kontakt={kontakt}
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
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
                onClick={() => setDeleteConfirm(false)}
                className="flex-1 border border-gray-200 text-gray-600 font-medium text-sm px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={handleDeleteKontakt}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors"
              >
                Ja, löschen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Neue Aufgabe Modal */}
      <AufgabenEditModal
        kontaktId={kontaktId}
        isOpen={newTaskModalOpen}
        onClose={() => setNewTaskModalOpen(false)}
        onSave={handleCreateAufgabe}
      />

      {/* Neue Opportunity Modal */}
      <OpportunityEditModal
        kontaktId={kontaktId}
        isOpen={newOppModalOpen}
        onClose={() => setNewOppModalOpen(false)}
        onSave={handleCreateOpp}
      />
    </div>
  )
}
