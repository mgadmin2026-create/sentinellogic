'use client'
// Kontakt-Detail-Seite mit 6 Tabs: Übersicht, Aktivitäten, Aufgaben, Opportunities, Notizen, Dokumente
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { KontaktEditModal } from '@/components/KontaktEditModal'
import { AufgabenEditModal } from '@/components/AufgabenEditModal'
import { AutomationControls } from '@/components/AutomationControls'
import { ContactOverview } from '@/components/ContactOverview'
import { StickyContactHeader } from '@/components/StickyContactHeader'

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
  klicktipp_id?: string
  klicktipp_tags?: string[]
  klicktipp_last_sync?: string
  dialfire_id?: string
  dialfire_campaign?: string
  dialfire_last_sync?: string
  dialfire_task_name?: string
  automation_disabled?: boolean
  dialfire_campaign_auto?: boolean
  dialfire_campaign_id?: string
  dialfire_task_auto?: boolean
  dialfire_task_name_field?: string
  klicktipp_tags_auto?: boolean
  klicktipp_tags_field?: string[]
  jahresumsatz?: string
  mitarbeitanzahl?: number
  versicherungstyp?: string
  dialfire_updated_at?: string
  dialfire_sync_error?: string
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
  { id: 'process', label: 'Prozess', icon: '🎯' },
  { id: 'activities', label: 'Aktivitäten', icon: '📝' },
  { id: 'tasks', label: 'Aufgaben', icon: '✓' },
  { id: 'notes', label: 'Notizen', icon: '📋' },
  { id: 'documents', label: 'Dokumente', icon: '📄' },
  { id: 'automation', label: 'Automation', icon: '⚙️' },
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
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [isEditingOverview, setIsEditingOverview] = useState(false)
  const [overviewSaving, setOverviewSaving] = useState(false)
  const [pipelineSaving, setPipelineSaving] = useState(false)

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

  async function handleUpdatePipelineStep(stepKey: string, done: boolean, dueDate?: string) {
    if (!kontakt) return
    try {
      setPipelineSaving(true)
      // Update the step in pipeline_steps array
      const updatedSteps = (kontakt.pipeline_steps || []).map((step: any) =>
        step.key === stepKey
          ? {
              ...step,
              done,
              completed_at: done ? new Date().toISOString().split('T')[0] : null,
              due_date: dueDate || null,
            }
          : step
      )
      const res = await fetch(`/api/kontakte/${kontaktId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipeline_steps: updatedSteps }),
      })
      if (!res.ok) throw new Error('Fehler beim Speichern')
      await loadKontakt()
    } catch (err) {
      console.error('Fehler:', err)
    } finally {
      setPipelineSaving(false)
    }
  }

  async function handleNextStep() {
    if (!kontakt || !kontakt.pipeline_stage) return
    try {
      setPipelineSaving(true)
      const currentIndex = PIPELINE_STEPS.findIndex(s => s.key === kontakt.pipeline_stage)
      if (currentIndex < PIPELINE_STEPS.length - 1) {
        const nextStep = PIPELINE_STEPS[currentIndex + 1]
        // Mark current step as done and move to next
        const updatedSteps = (kontakt.pipeline_steps || []).map((step: any) =>
          step.key === kontakt.pipeline_stage
            ? { ...step, done: true, completed_at: new Date().toISOString().split('T')[0] }
            : step
        )
        const res = await fetch(`/api/kontakte/${kontaktId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pipeline_stage: nextStep.key,
            pipeline_steps: updatedSteps,
          }),
        })
        if (!res.ok) throw new Error('Fehler beim Fortschreiten')
        await loadKontakt()
      }
    } catch (err) {
      console.error('Fehler:', err)
    } finally {
      setPipelineSaving(false)
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

  async function handleSaveOverview(changes: Record<string, any>) {
    setOverviewSaving(true)
    try {
      const res = await fetch(`/api/kontakte/${kontaktId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      })
      if (res.ok) {
        await loadKontakt()
      }
    } catch (err) {
      console.error('Fehler beim Speichern:', err)
    } finally {
      setOverviewSaving(false)
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
    <div>
      {/* Sticky Header */}
      <StickyContactHeader
        firstName={kontakt.first_name}
        lastName={kontakt.last_name}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isEditing={isEditingOverview}
        onEditChange={setIsEditingOverview}
        onDelete={() => setDeleteConfirm(true)}
      />

      {/* Tab Content */}
      <div className="p-8">
        {/* TAB: Übersicht */}
        {activeTab === 'overview' && (
          <ContactOverview
            kontakt={kontakt}
            onSave={handleSaveOverview}
            isEditing={isEditingOverview}
            onEditChange={setIsEditingOverview}
          />
        )}
        {activeTab === 'process' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Vertriebsprozess</h2>
              {kontakt?.pipeline_stage && (
                <button
                  onClick={handleNextStep}
                  disabled={
                    pipelineSaving ||
                    PIPELINE_STEPS.findIndex(s => s.key === kontakt.pipeline_stage) === PIPELINE_STEPS.length - 1
                  }
                  className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 font-semibold text-sm px-4 py-2 rounded-lg transition-colors"
                >
                  {pipelineSaving ? '…' : '→'} Nächster Schritt
                </button>
              )}
            </div>

            <div className="space-y-3 max-w-2xl">
              {PIPELINE_STEPS.map((step, index) => {
                const stepData = (kontakt?.pipeline_steps || []).find((s: any) => s.key === step.key)
                const isCompleted = stepData?.done || false
                const isDueDate = stepData?.due_date
                const isCurrent = kontakt?.pipeline_stage === step.key
                const isNext = !isCompleted && (PIPELINE_STEPS.findIndex(s => s.key === kontakt?.pipeline_stage) || 0) === index - 1

                return (
                  <div
                    key={step.key}
                    className={`flex gap-4 p-4 rounded-lg border-2 transition-all ${
                      isCurrent
                        ? 'border-yellow-400 bg-yellow-50'
                        : isCompleted
                          ? 'border-emerald-200 bg-emerald-50'
                          : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    {/* Icon */}
                    <div className="flex-shrink-0">
                      {isCompleted ? (
                        <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold">
                          ✓
                        </div>
                      ) : isCurrent ? (
                        <div className="w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center text-gray-900 font-bold">
                          {index + 1}
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center text-gray-400 text-sm font-medium">
                          {index + 1}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <p className={`font-semibold ${isCompleted ? 'text-emerald-900' : isCurrent ? 'text-yellow-900' : 'text-gray-700'}`}>
                          {step.label}
                        </p>
                        {isCompleted && stepData?.completed_at && (
                          <span className="text-xs text-emerald-600 font-medium">
                            ✓ {new Date(stepData.completed_at).toLocaleDateString('de-DE')}
                          </span>
                        )}
                      </div>

                      <div className="flex gap-3 items-center">
                        <input
                          type="checkbox"
                          checked={isCompleted}
                          onChange={(e) => handleUpdatePipelineStep(step.key, e.target.checked, isDueDate)}
                          disabled={pipelineSaving}
                          className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                          title="Als erledigt markieren"
                        />
                        <input
                          type="date"
                          value={isDueDate || ''}
                          onChange={(e) => handleUpdatePipelineStep(step.key, isCompleted, e.target.value)}
                          disabled={pipelineSaving}
                          className="text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-yellow-400/40"
                          title="Fälligkeitsdatum"
                        />
                        {isDueDate && (
                          <span className="text-xs text-gray-500">
                            Fällig: {new Date(isDueDate).toLocaleDateString('de-DE')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {kontakt?.pipeline_stage === PIPELINE_STEPS[PIPELINE_STEPS.length - 1].key && (
              <div className="mt-6 p-4 bg-emerald-50 border-2 border-emerald-200 rounded-lg">
                <p className="text-sm font-semibold text-emerald-900">
                  🎉 Kontakt hat alle Prozessschritte abgeschlossen!
                </p>
              </div>
            )}
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
                {aktivitäten.map((akt, i) => {
                  // Icon basierend auf Activity-Type
                  const getActivityIcon = (type: string) => {
                    if (type.includes('klicktipp')) return '🔗'
                    if (type.includes('dialfire')) return '📞'
                    if (type.includes('task')) return '✓'
                    return '📝'
                  }
                  
                  const getActivityColor = (type: string) => {
                    if (type.includes('klicktipp')) return 'bg-blue-100 text-blue-600'
                    if (type.includes('dialfire')) return 'bg-purple-100 text-purple-600'
                    if (type.includes('task')) return 'bg-emerald-100 text-emerald-600'
                    return 'bg-yellow-100 text-yellow-600'
                  }
                  
                  return (
                    <div key={akt.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold flex-shrink-0 ${getActivityColor(akt.type)}`}>
                          {getActivityIcon(akt.type)}
                        </div>
                        {i < aktivitäten.length - 1 && <div className="w-0.5 h-8 bg-gray-200 mt-2" />}
                      </div>
                      <div className="flex-1 pt-1">
                        <p className="text-sm font-medium text-gray-900">{akt.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs text-gray-400">
                            {new Date(akt.created_at).toLocaleDateString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          {akt.type && (
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getActivityColor(akt.type)}`}>
                              {akt.type.replace('_', ' ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
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
                      <tr
                        key={aufgabe.id}
                        className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                        onClick={() => router.push(`/aufgaben/${aufgabe.id}`)}
                      >
                        <td className="px-6 py-3.5 text-yellow-600 font-medium hover:underline">{aufgabe.titel}</td>
                        <td className="px-6 py-3.5" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={aufgabe.status}
                            onChange={(e) => {
                              fetch(`/api/aufgaben/${aufgabe.id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ status: e.target.value }),
                              }).then(() => loadKontakt())
                            }}
                            className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${
                              aufgabe.status === 'offen'
                                ? 'bg-red-100 text-red-800'
                                : aufgabe.status === 'in_bearbeitung'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            <option value="offen">Offen</option>
                            <option value="in_bearbeitung">In Bearbeitung</option>
                            <option value="erledigt">Erledigt</option>
                          </select>
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

        {activeTab === 'automation' && (
          <AutomationControls
            contactId={kontakt.id}
            initialData={{
              automation_disabled: kontakt.automation_disabled ?? false,
              dialfire_campaign_auto: kontakt.dialfire_campaign_auto ?? true,
              dialfire_campaign_id: kontakt.dialfire_campaign_id,
              dialfire_task_auto: kontakt.dialfire_task_auto ?? true,
              dialfire_task_name_field: kontakt.dialfire_task_name_field,
              klicktipp_tags_auto: kontakt.klicktipp_tags_auto ?? true,
              klicktipp_tags_field: kontakt.klicktipp_tags_field,
            }}
          />
        )}

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
    </div>
  )
}
