'use client'
// Kontakt-Detail-Seite als Kachel-Workspace: fixierte Kopfzeile (Identität +
// Tags/Notizen), Prozess-Stepper, Daten-Kacheln links, Arbeits-Spalte rechts.
// Jede Kachel zeigt den Überblick — Drawer tragen die vollständigen Felder
// bzw. die komplette Historie (kein Feld geht verloren).
import { useState, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { AufgabenEditModal } from '@/components/AufgabenEditModal'
import { AutomationControls } from '@/components/AutomationControls'
import { ContactOverview } from '@/components/ContactOverview'
import { StickyContactHeader } from '@/components/StickyContactHeader'
import { NotesHistory } from '@/components/NotesHistory'
import { DialfireSyncPanel } from '@/components/DialfireSyncPanel'
import { DialfireResponseTable } from '@/components/DialfireResponseTable'
import { KontaktDokumenteTab } from '@/components/KontaktDokumenteTab'
import { KontaktVertraegeTab } from '@/components/KontaktVertraegeTab'
import { ContactEmailModal } from '@/components/ContactEmailModal'
import { type Tag } from '@/components/TagInput'
import { PlacetelCallHistory } from '@/components/PlacetelCallHistory'
import { SuperchatSyncButton } from '@/components/SuperchatSyncButton'
import { Drawer } from '@/components/kontakt/Drawer'
import { ProzessPanel, PIPELINE_STEPS } from '@/components/kontakt/ProzessPanel'
import { AktivitaetenPanel, type Aktivität } from '@/components/kontakt/AktivitaetenPanel'
import { AufgabenPanel, type KontaktAufgabe } from '@/components/kontakt/AufgabenPanel'
import { CommentThread } from '@/components/kontakt/CommentThread'
import { HelpButton } from '@/components/help/HelpButton'
import { BeitragsuebersichtPanel } from '@/components/kontakt/BeitragsuebersichtPanel'
import { ErstgespraechPanel } from '@/components/kontakt/ErstgespraechPanel'
import { CallPrepPanel } from '@/components/kontakt/CallPrepPanel'
import { AuslandsreiseversicherungPanel } from '@/components/kontakt/AuslandsreiseversicherungPanel'
import { berechneSummen } from '@/lib/beitragsuebersicht-calc'
import { ZYKLUS_LABEL } from '@/lib/beitragsuebersicht-zyklus'
import type { Beitragsuebersicht } from '@/types/beitragsuebersicht'

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
  hausnummer?: string
  anrede?: string
  postal_code?: string
  city?: string
  country?: string
  website?: string
  source?: string
  status: 'new' | 'contacted' | 'qualified' | 'customer' | 'not_interested'
  pipeline_stage?: string
  pipeline_steps?: Array<{
    key: string
    done: boolean
    completed_at?: string
    due_date?: string
  }>
  assigned_user_id?: string
  assigned_user?: { name: string } | null
  qualität?: string
  bestandskunde?: boolean
  notes?: string
  klicktipp_id?: string
  klicktipp_tags?: string[]
  klicktipp_last_sync?: string
  klicktipp_email_status?: string | null
  klicktipp_status_updated_at?: string | null
  dialfire_id?: string
  dialfire_campaign?: string
  dialfire_last_sync?: string
  dialfire_task_name?: string
  superchat_id?: string | null
  superchat_last_sync?: string | null
  superchat_sync_error?: string | null
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
  prüfung_grund?: string
  krankenversicherung_status?: string
  situation?: string
  anzahl_personen?: string
  reisezeitpunkt?: string
  usa_kanada_eingeschlossen?: string
  rechtsform?: string
  sparte?: string
  versicherungsgesellschaft?: string
  seit_wann_gewerbe?: string
  geburtstag_gf_inhaber?: string
  inhaltssumme?: string
  dialfire_updated_at?: string
  dialfire_sync_error?: string
  kontakt_typ?: 'privat' | 'gewerbe'
  beitragsuebersicht?: Beitragsuebersicht
  geburtstag?: string
  geschlecht?: string
  jahreseinkommen?: string
  groesse?: number
  gewicht?: number
  gesundheitszustand?: string
  seit_wann_selbststaendig?: string
  dienstverhaltnis?: string
  versicherungsgesellschaft_1?: string
  leistungen_1?: string
  aktueller_beitrag_1?: string
  iban_1?: string
  versicherungsgesellschaft_2?: string
  leistungen_2?: string
  aktueller_beitrag_2?: string
  iban_2?: string
  versicherungsgesellschaft_3?: string
  leistungen_3?: string
  aktueller_beitrag_3?: string
  iban_3?: string
  versicherungsgesellschaft_4?: string
  leistungen_4?: string
  aktueller_beitrag_4?: string
  iban_4?: string
  versicherungsgesellschaft_5?: string
  leistungen_5?: string
  aktueller_beitrag_5?: string
  iban_5?: string
  notizen_2?: string
  created_at: string
  archived_at?: string | null
  tags?: { id: string; name: string }[]
}

interface KontaktSparte {
  is_primary: boolean
  sparte: {
    id: string
    name: string
    leitfaden_titel: string | null
    leitfaden_fragen: Array<{
      id: string
      frage: string
      felder: Array<{ feld: string; label: string; typ?: 'text' | 'date' | 'number' | 'checkbox' }>
      nurAnzeige?: boolean
    }>
    leitfaden_abschluss: string | null
  }
}

type Aufgabe = KontaktAufgabe & {
  triggered_by_process_step?: string
  amis_task_type?: 'person_create' | 'person_create_quote'
  amis_status?: 'person_created' | 'quoted' | 'error' | null
  amis_quote_number?: string | null
  amis_premium?: string | null
  amis_processed_at?: string | null
  fällig: string
}

type DrawerId =
  | 'edit'
  | 'prozess'
  | 'aktivitaeten'
  | 'aufgaben'
  | 'dokumente'
  | 'vertraege'
  | 'placetel'
  | 'dialfire'
  | 'automation'
  | 'beitragsuebersicht'
  | 'erstgespraech'
  | 'call-prep'
  | 'kommentare'

function fmtEuroKachel(n: number): string {
  return n.toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' €'
}

export default function KontaktDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const kontaktId = params.id as string
  const requestedReturnTo = searchParams.get('returnTo')
  const returnTo = requestedReturnTo?.startsWith('/kontakte') ? requestedReturnTo : '/kontakte'

  const [kontakt, setKontakt] = useState<Kontakt | null>(null)
  const [loading, setLoading] = useState(true)
  const [openDrawer, setOpenDrawer] = useState<DrawerId | null>(null)
  const [editSection, setEditSection] = useState<string | undefined>(undefined)
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [editingAufgabe, setEditingAufgabe] = useState<Aufgabe | null>(null)
  // Vorbelegte "Neue Aufgabe" (z.B. Titel "Beratungstermin" aus dem Erstgespräch) —
  // getrennt von editingAufgabe, damit handleSaveAufgabe weiterhin korrekt POST statt
  // PATCH wählt (die Unterscheidung dort hängt an editingAufgabe, nicht am Vorhandensein
  // eines Titels).
  const [newTaskDefaults, setNewTaskDefaults] = useState<Aufgabe | null>(null)
  const [notes, setNotes] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)
  const [aktivitäten, setAktivitäten] = useState<Aktivität[]>([])
  const [aufgaben, setAufgaben] = useState<Aufgabe[]>([])
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [archiveTasksToo, setArchiveTasksToo] = useState(false)
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [beitragsMailFile, setBeitragsMailFile] = useState<File | null>(null)
  const [pipelineSaving, setPipelineSaving] = useState(false)
  const [dialfireResponse, setDialfireResponse] = useState<Record<string, any> | null>(null)
  const [dialfireSnapshot, setDialfireSnapshot] = useState<any>(null)
  const [amisCreating, setAmisCreating] = useState<'person_create' | 'person_create_quote' | null>(null)
  const [amisMessage, setAmisMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [kontaktTags, setKontaktTags] = useState<{ id: string; name: string }[]>([])
  const [kontaktSparten, setKontaktSparten] = useState<KontaktSparte[]>([])

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
        setKontaktTags(data.tags || [])
        setKontaktSparten(data.sparten || [])

        // Load Dialfire response snapshot
        if (data.dialfire_id) {
          try {
            const snapRes = await fetch(`/api/dialfire-sync/${data.id}/snapshot`)
            const snapJson = await snapRes.json()
            if (snapJson.success && snapJson.data) {
              setDialfireResponse(snapJson.data.dialfire_flat_view)
              setDialfireSnapshot(snapJson.data)
            }
          } catch (err) {
            console.error('Fehler beim Laden der Dialfire Response:', err)
          }
        }
      }
    } catch (err) {
      console.error('Fehler beim Laden des Kontakts:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveNotes(newNotes: string) {
    try {
      setNotesSaving(true)
      const res = await fetch(`/api/kontakte/${kontaktId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: newNotes }),
      })
      if (!res.ok) throw new Error('Fehler beim Speichern')
      await loadKontakt()
    } catch (err) {
      console.error('Fehler:', err)
    } finally {
      setNotesSaving(false)
    }
  }

  async function handleSaveErstgespraech(changes: Record<string, unknown>) {
    const res = await fetch(`/api/kontakte/${kontaktId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(changes),
    })
    if (!res.ok) throw new Error('Fehler beim Speichern')
    await loadKontakt()
  }

  async function handleArchiveKontakt(archiveTasks: boolean) {
    try {
      const res = await fetch(`/api/kontakte/${kontaktId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archiveTasks }),
      })
      if (!res.ok) throw new Error('Fehler beim Archivieren')
      router.push(returnTo)
    } catch (err) {
      console.error('Fehler beim Archivieren:', err)
    }
  }

  async function handleTagsChange(tags: Tag[]) {
    setKontaktTags(tags)
    try {
      await fetch(`/api/kontakte/${kontaktId}/tags`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagIds: tags.map((t) => t.id) }),
      })
    } catch (err) {
      console.error('Fehler beim Speichern der Tags:', err)
    }
  }

  async function handleUpdatePipelineStep(stepKey: string, done: boolean, dueDate?: string) {
    if (!kontakt) return
    try {
      setPipelineSaving(true)
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

  async function handleSaveAufgabe(form: any) {
    try {
      const url = editingAufgabe ? `/api/aufgaben/${editingAufgabe.id}` : '/api/aufgaben'
      const method = editingAufgabe ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.error || 'Fehler beim Speichern')
      }
      setTaskModalOpen(false)
      setEditingAufgabe(null)
      setNewTaskDefaults(null)
      await loadKontakt()
    } catch (err: any) {
      throw err
    }
  }

  async function handleTaskStatusChange(id: string, status: string) {
    try {
      await fetch(`/api/aufgaben/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      await loadKontakt()
    } catch (err) {
      console.error('Fehler:', err)
    }
  }

  async function handleSaveOverview(changes: Record<string, any>) {
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
    }
  }

  async function handleCreateAmisTask(taskType: 'person_create' | 'person_create_quote') {
    try {
      setAmisCreating(taskType)
      setAmisMessage(null)
      const res = await fetch(`/api/kontakte/${kontaktId}/amis-now`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskType }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'AMIS-Aufgabe konnte nicht erstellt werden')
      }
      setAmisMessage({ type: 'ok', text: 'AMIS.NOW Aufgabe wurde erstellt und wartet auf den Agenten.' })
      await loadKontakt()
    } catch (err: any) {
      setAmisMessage({ type: 'error', text: err?.message || 'AMIS-Aufgabe konnte nicht erstellt werden' })
    } finally {
      setAmisCreating(null)
    }
  }

  function openEditDrawer(section?: string) {
    setEditSection(section)
    setOpenDrawer('edit')
  }

  function openNewTask() {
    setEditingAufgabe(null)
    setNewTaskDefaults(null)
    setTaskModalOpen(true)
  }

  function openNewTaskWithTitle(titel: string, fälligInTagen = 0) {
    const fällig = new Date()
    fällig.setDate(fällig.getDate() + fälligInTagen)
    setEditingAufgabe(null)
    setNewTaskDefaults({
      contact_id: kontaktId,
      titel,
      beschreibung: '',
      fällig: fällig.toISOString().split('T')[0],
      priorität: 'mittel',
      status: 'offen',
    } as Aufgabe)
    setTaskModalOpen(true)
  }

  function openEditTask(aufgabe: KontaktAufgabe) {
    setEditingAufgabe(aufgabe as Aufgabe)
    setTaskModalOpen(true)
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
        <Link href={returnTo} className="text-yellow-600 hover:underline mt-2 inline-block">
          ← Zurück zur Übersicht
        </Link>
      </div>
    )
  }

  const fullName = `${kontakt.first_name} ${kontakt.last_name}`
  const latestAmisTask = aufgaben
    .filter((aufgabe) => aufgabe.triggered_by_process_step === 'amis_now')
    .sort((a, b) => String(b.amis_processed_at || b.created_at || b.fällig || '').localeCompare(String(a.amis_processed_at || a.created_at || a.fällig || '')))[0]
  const amisStatusLabel = latestAmisTask?.amis_status === 'quoted'
    ? 'Angebot berechnet'
    : latestAmisTask?.amis_status === 'person_created'
      ? 'Person angelegt'
      : latestAmisTask?.amis_status === 'error'
        ? 'Fehler'
        : latestAmisTask?.status === 'in_bearbeitung'
          ? 'In Bearbeitung'
          : latestAmisTask?.status === 'offen'
            ? 'Wartet auf Agent'
            : latestAmisTask
              ? 'Erledigt'
              : 'Keine AMIS-Aufgabe'

  const offeneAufgaben = aufgaben
    .filter((a) => a.status !== 'erledigt')
    .sort((a, b) => String(a.fällig || '').localeCompare(String(b.fällig || '')))
  const nextTask = offeneAufgaben[0]
  const nextTaskOverdue = nextTask && new Date(nextTask.fällig) < new Date()

  const pkvContracts = [1, 2, 3, 4, 5]
    .map((i) => ({
      nr: i,
      gesellschaft: (kontakt as any)[`versicherungsgesellschaft_${i}`],
      leistungen: (kontakt as any)[`leistungen_${i}`],
      beitrag: (kontakt as any)[`aktueller_beitrag_${i}`],
    }))
    .filter((c) => c.gesellschaft || c.leistungen || c.beitrag)

  const adresseZeile = [
    [kontakt.street, kontakt.hausnummer].filter(Boolean).join(' '),
    [kontakt.postal_code, kontakt.city].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(', ')

  const currentStepIndex = Math.max(0, PIPELINE_STEPS.findIndex(s => s.key === kontakt.pipeline_stage))
  const doneStepCount = (kontakt.pipeline_steps || []).filter((s: any) => s.done).length
  const isLastStep = currentStepIndex === PIPELINE_STEPS.length - 1

  return (
    <div>
      <StickyContactHeader
        contactId={kontaktId}
        firstName={kontakt.first_name}
        lastName={kontakt.last_name}
        companyName={kontakt.company_name}
        email={kontakt.email}
        phoneMobile={kontakt.phone_mobile}
        phoneOffice={kontakt.phone_office}
        superchatId={kontakt.superchat_id}
        status={kontakt.status}
        qualität={kontakt.qualität}
        geburtstag={kontakt.geburtstag}
        assignedUserName={kontakt.assigned_user?.name}
        onEmailClick={() => setEmailModalOpen(true)}
        onEditClick={() => openEditDrawer()}
        onDelete={() => setDeleteConfirm(true)}
        onHistoryClick={() => setOpenDrawer('aktivitaeten')}
        onCallPrepClick={() => setOpenDrawer('call-prep')}
        onProcessClick={() => setOpenDrawer('prozess')}
        onCommentsClick={() => setOpenDrawer('kommentare')}
        isArchived={!!kontakt.archived_at}
        tags={kontaktTags}
        onTagsChange={handleTagsChange}
        notes={notes}
        notesSaving={notesSaving}
        onSaveNotes={handleSaveNotes}
        amisStatusLabel={amisStatusLabel}
        latestAmisTask={latestAmisTask}
        handleCreateAmisTask={handleCreateAmisTask}
        amisCreating={amisCreating}
      />

      <ContactEmailModal
        open={emailModalOpen || beitragsMailFile !== null}
        contactId={kontaktId}
        defaultTo={kontakt.email}
        contactName={fullName}
        contact={{
          first_name: kontakt.first_name,
          last_name: kontakt.last_name,
          company_name: kontakt.company_name,
          email: kontakt.email,
          phone_mobile: kontakt.phone_mobile,
          phone_office: kontakt.phone_office,
          versicherungsgesellschaft: kontakt.versicherungsgesellschaft,
          sparte: kontakt.sparte,
        }}
        initialAttachments={beitragsMailFile ? [beitragsMailFile] : undefined}
        initialTemplateName={beitragsMailFile ? 'Beitragsübersicht' : undefined}
        attachmentCategory={beitragsMailFile ? 'Beitragsübersicht' : undefined}
        onClose={() => { setEmailModalOpen(false); setBeitragsMailFile(null) }}
        onSent={() => loadKontakt()}
      />

      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* AMIS.NOW Message */}
        {amisMessage && (
          <div className={`mb-4 p-4 rounded-lg border ${amisMessage.type === 'ok' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
            <p className={`text-sm font-medium ${amisMessage.type === 'ok' ? 'text-emerald-700' : 'text-red-700'}`}>
              {amisMessage.text}
            </p>
          </div>
        )}

        {/* Kachelraster */}
        <div className="grid lg:grid-cols-[1.55fr_1fr] gap-4 items-start">
          {/* Linke Spalte: Daten-Kacheln */}
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Kontakt */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-semibold text-gray-900">👤 Kontakt</h3>
                  <HelpButton articleId="kontakt-detail.kontakt-kachel" />
                </div>
                <button
                  onClick={() => openEditDrawer('grunddaten')}
                  className="text-xs text-yellow-600 hover:text-yellow-700 font-semibold"
                >
                  Bearbeiten
                </button>
              </div>
              <dl className="text-sm space-y-1.5">
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-400">Mobil</dt>
                  <dd className="text-gray-900 truncate">{kontakt.phone_mobile || '—'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-400">Büro</dt>
                  <dd className="text-gray-900 truncate">{kontakt.phone_office || '—'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-400">Adresse</dt>
                  <dd className="text-gray-900 truncate text-right">{adresseZeile || '—'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-400">Typ</dt>
                  <dd className="text-gray-900">{kontakt.kontakt_typ === 'privat' ? '👤 Privat' : '🏢 Gewerbe'}</dd>
                </div>
              </dl>
            </div>

            {/* Unternehmen */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-semibold text-gray-900">🏢 Unternehmen</h3>
                  <HelpButton articleId="kontakt-detail.unternehmen-kachel" />
                </div>
                <button
                  onClick={() => openEditDrawer('unternehmen')}
                  className="text-xs text-yellow-600 hover:text-yellow-700 font-semibold"
                >
                  Bearbeiten
                </button>
              </div>
              <dl className="text-sm space-y-1.5">
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-400">Branche</dt>
                  <dd className="text-gray-900 truncate">{kontakt.industry || '—'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-400">Rechtsform</dt>
                  <dd className="text-gray-900">{kontakt.rechtsform || '—'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-400">Mitarbeiter</dt>
                  <dd className="text-gray-900">{kontakt.mitarbeitanzahl ?? '—'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-400">Jahresumsatz</dt>
                  <dd className="text-gray-900 truncate">{kontakt.jahresumsatz || '—'}</dd>
                </div>
              </dl>
            </div>

            {/* Versicherung & Verträge */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 sm:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-semibold text-gray-900">🛡️ Versicherung & Verträge</h3>
                  <HelpButton articleId="kontakt-detail.versicherung-vertraege" />
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setOpenDrawer('vertraege')}
                    className="text-xs text-yellow-600 hover:text-yellow-700 font-semibold"
                  >
                    Verträge →
                  </button>
                  <button
                    onClick={() => openEditDrawer('versicherung')}
                    className="text-xs text-yellow-600 hover:text-yellow-700 font-semibold"
                  >
                    Bearbeiten
                  </button>
                </div>
              </div>
              <div className="grid sm:grid-cols-3 gap-x-6 gap-y-1.5 text-sm mb-1">
                <div className="flex justify-between gap-3">
                  <span className="text-gray-400">Sparten</span>
                  <span className="text-gray-900 truncate">
                    {kontaktSparten.length > 0 ? kontaktSparten.map((z) => z.sparte.name).join(', ') : '—'}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-400">Prüfgrund</span>
                  <span className="text-gray-900 truncate">{kontakt.prüfung_grund || '—'}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-400">Vorversicherung</span>
                  <span className="text-gray-900 truncate">{kontakt.versicherungsgesellschaft || '—'}</span>
                </div>
              </div>
              {pkvContracts.length > 0 && (
                <table className="w-full text-xs mt-3 border-t border-gray-100 pt-2">
                  <thead>
                    <tr className="text-left text-gray-400">
                      <th className="font-medium py-1">#</th>
                      <th className="font-medium py-1">Gesellschaft</th>
                      <th className="font-medium py-1">Leistungen</th>
                      <th className="font-medium py-1">Beitrag €/M</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pkvContracts.map((c) => (
                      <tr key={c.nr} className="text-gray-700 border-t border-gray-50">
                        <td className="py-1">{c.nr}</td>
                        <td className="py-1">{c.gesellschaft || '—'}</td>
                        <td className="py-1">{c.leistungen || '—'}</td>
                        <td className="py-1">{c.beitrag || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {kontaktSparten.some((z) => z.sparte.name === 'Auslandsreiseversicherung') && (
                <div className="border-t border-gray-100 mt-3 pt-3">
                  <AuslandsreiseversicherungPanel kontakt={kontakt} onSave={handleSaveOverview} />
                </div>
              )}
            </div>

            {/* Beitragsübersicht */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 sm:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-semibold text-gray-900">📊 Beitragsübersicht</h3>
                  <HelpButton articleId="kontakt-detail.beitragsuebersicht" />
                </div>
                <button
                  onClick={() => setOpenDrawer('beitragsuebersicht')}
                  className="text-xs text-yellow-600 hover:text-yellow-700 font-semibold"
                >
                  Bearbeiten →
                </button>
              </div>
              {kontakt.beitragsuebersicht ? (
                (() => {
                  const summen = berechneSummen(kontakt.beitragsuebersicht)
                  const kachelZyklusLabel = ZYKLUS_LABEL[kontakt.beitragsuebersicht.zyklus ?? 'jaehrlich']
                  return (
                    <div className="flex items-center gap-5 flex-wrap">
                      <div>
                        <div className="text-lg font-bold text-gray-900 tabular-nums">{fmtEuroKachel(summen.sumAlt)}</div>
                        <div className="text-[11px] text-gray-400 uppercase tracking-wide">Beitrag bisher / {kachelZyklusLabel}</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-gray-900 tabular-nums">{fmtEuroKachel(summen.sumNeu)}</div>
                        <div className="text-[11px] text-gray-400 uppercase tracking-wide">Angebot Allianz / {kachelZyklusLabel}</div>
                      </div>
                      {summen.ersparnisProJahr > 0 ? (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold px-2.5 py-1 rounded-full">
                          ✓ Ersparnis {fmtEuroKachel(summen.ersparnisProJahr)} / Jahr
                        </span>
                      ) : summen.mehrbeitragProMonat > 0 ? (
                        <span className="bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold px-2.5 py-1 rounded-full">
                          Mehrbeitrag {fmtEuroKachel(summen.mehrbeitragProMonat)} / Monat
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Kein Unterschied</span>
                      )}
                    </div>
                  )
                })()
              ) : (
                <p className="text-sm text-gray-400">Noch keine Beitragsübersicht angelegt.</p>
              )}
            </div>

            {/* Dokumente */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-semibold text-gray-900">📎 Dokumente</h3>
                  <HelpButton articleId="kontakt-detail.dokumente" />
                </div>
                <button
                  onClick={() => setOpenDrawer('dokumente')}
                  className="text-xs text-yellow-600 hover:text-yellow-700 font-semibold"
                >
                  Öffnen →
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">Upload, Kategorien & Google-Drive-Ablage</p>
            </div>

            {/* Telefonie & Sync */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-1.5 mb-2.5">
                <h3 className="text-sm font-semibold text-gray-900">☎️ Telefonie & Sync</h3>
                <HelpButton articleId="kontakt-detail.telefonie-sync" />
              </div>
              <div className="text-sm space-y-1.5">
                <button
                  onClick={() => setOpenDrawer('placetel')}
                  className="flex justify-between w-full text-left hover:text-yellow-700 group"
                >
                  <span className="text-gray-700 group-hover:text-yellow-700">Placetel-Anrufe</span>
                  <span className="text-yellow-600 text-xs font-semibold">→</span>
                </button>
                <button
                  onClick={() => setOpenDrawer('dialfire')}
                  className="flex justify-between w-full text-left hover:text-yellow-700 group"
                >
                  <span className="text-gray-700 group-hover:text-yellow-700">
                    Dialfire {kontakt.dialfire_id ? '· verknüpft' : ''}
                  </span>
                  <span className="text-yellow-600 text-xs font-semibold">→</span>
                </button>
                <button
                  onClick={() => setOpenDrawer('automation')}
                  className="flex justify-between w-full text-left hover:text-yellow-700 group"
                >
                  <span className="text-gray-700 group-hover:text-yellow-700">
                    Automation {kontakt.automation_disabled ? '· pausiert' : '· aktiv'}
                  </span>
                  <span className="text-yellow-600 text-xs font-semibold">→</span>
                </button>
                <div className="border-t border-gray-100 pt-2 mt-2">
                  <SuperchatSyncButton
                    contactId={kontakt.id}
                    firstName={kontakt.first_name}
                    lastName={kontakt.last_name}
                    email={kontakt.email}
                    phoneMobile={kontakt.phone_mobile}
                    phoneOffice={kontakt.phone_office}
                    superchatId={kontakt.superchat_id}
                    lastSync={kontakt.superchat_last_sync}
                    syncError={kontakt.superchat_sync_error}
                    disabled={!!kontakt.archived_at}
                    onSynchronized={loadKontakt}
                  />
                </div>
                <button
                  onClick={() => openEditDrawer('integrations')}
                  className="flex justify-between w-full text-left hover:text-yellow-700 group"
                >
                  <span className="text-gray-700 group-hover:text-yellow-700">KlickTipp & Integrations</span>
                  <span className="text-yellow-600 text-xs font-semibold">→</span>
                </button>
              </div>
            </div>
          </div>

          {/* Rechte Spalte: Arbeit */}
          <div className="flex flex-col gap-4">
            {/* Erstgespräch */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-semibold text-gray-900">🎙️ Erstgespräch</h3>
                  <HelpButton articleId="kontakt-detail.erstgespraech" />
                </div>
                <button
                  onClick={() => setOpenDrawer('erstgespraech')}
                  aria-label="Erstgespräch bearbeiten"
                  className="text-xs text-yellow-600 hover:text-yellow-700 font-semibold"
                >
                  Bearbeiten
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {kontaktSparten.length === 0
                  ? 'Keine Sparte hinterlegt'
                  : kontaktSparten.length === 1
                    ? kontaktSparten[0].sparte.leitfaden_fragen.length > 0
                      ? `Leitfaden: ${kontaktSparten[0].sparte.name}`
                      : `Kein Leitfaden für Sparte „${kontaktSparten[0].sparte.name}"`
                    : `${kontaktSparten.length} Sparten: ${kontaktSparten.map((z) => z.sparte.name).join(', ')}`}
              </p>
            </div>

            {/* Nächste Aufgabe */}
            <div className="bg-white rounded-xl border-2 border-yellow-400 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-semibold text-gray-900">✓ Nächste Aufgabe</h3>
                  <HelpButton articleId="kontakt-detail.naechste-aufgabe" />
                </div>
                {nextTask && nextTaskOverdue && (
                  <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    Überfällig
                  </span>
                )}
              </div>
              {nextTask ? (
                <>
                  <button
                    onClick={() => openEditTask(nextTask)}
                    className="text-sm font-semibold text-gray-900 hover:text-yellow-700 text-left"
                  >
                    {nextTask.titel}
                  </button>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Fällig {new Date(nextTask.fällig).toLocaleDateString('de-DE')}
                    {nextTask.assigned_user?.name ? ` · ${nextTask.assigned_user.name}` : ''}
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-400">Keine offenen Aufgaben.</p>
              )}
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {nextTask && (
                  <button
                    onClick={() => handleTaskStatusChange(nextTask.id, 'erledigt')}
                    className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                  >
                    ✓ Erledigt
                  </button>
                )}
                <button
                  onClick={openNewTask}
                  className="text-yellow-600 hover:text-yellow-700 text-xs font-semibold"
                >
                  + Neue Aufgabe
                </button>
                <button
                  onClick={() => setOpenDrawer('aufgaben')}
                  className="ml-auto text-gray-500 hover:text-gray-900 text-xs font-medium"
                >
                  Historie ({aufgaben.length}) →
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <Link href={returnTo} className="text-gray-500 hover:text-gray-900 text-sm font-medium">
            ← Zurück zur Übersicht
          </Link>
        </div>
      </div>

      {/* ===================== Drawer ===================== */}

      <Drawer
        isOpen={openDrawer === 'edit'}
        title="✏️ Kontakt bearbeiten — alle Felder"
        onClose={() => setOpenDrawer(null)}
        widthClass="max-w-3xl"
      >
        <ContactOverview
          kontakt={kontakt}
          onSave={handleSaveOverview}
          isEditing
          onEditChange={(editing) => {
            if (!editing) setOpenDrawer(null)
          }}
          initialSection={editSection}
        />
      </Drawer>

      <Drawer
        isOpen={openDrawer === 'prozess'}
        title="🎯 Vertriebsprozess"
        onClose={() => setOpenDrawer(null)}
      >
        <ProzessPanel
          pipelineStage={kontakt.pipeline_stage}
          pipelineSteps={kontakt.pipeline_steps}
          saving={pipelineSaving}
          onNextStep={handleNextStep}
          onUpdateStep={handleUpdatePipelineStep}
        />
      </Drawer>

      <Drawer
        isOpen={openDrawer === 'aktivitaeten'}
        title="📋 Kontakthistorie"
        onClose={() => setOpenDrawer(null)}
      >
        <AktivitaetenPanel aktivitäten={aktivitäten} />
      </Drawer>

      <Drawer
        isOpen={openDrawer === 'kommentare'}
        title="💬 Kommentare"
        onClose={() => setOpenDrawer(null)}
      >
        <CommentThread entityType="contact" entityId={kontaktId} />
      </Drawer>

      <Drawer
        isOpen={openDrawer === 'erstgespraech'}
        title="🎙️ Erstgespräch"
        onClose={() => setOpenDrawer(null)}
        widthClass="max-w-3xl"
      >
        <ErstgespraechPanel
          kontakt={kontakt}
          sparten={kontaktSparten}
          onSave={handleSaveErstgespraech}
          onSaveNotes={handleSaveNotes}
          onFolgeterminClick={() => openNewTaskWithTitle('Beratungstermin')}
        />
      </Drawer>

      <Drawer
        isOpen={openDrawer === 'call-prep'}
        title="🧠 Anruf vorbereiten"
        onClose={() => setOpenDrawer(null)}
      >
        <CallPrepPanel kontaktId={kontaktId} istGewerbe={kontakt.kontakt_typ !== 'privat'} />
      </Drawer>

      <Drawer
        isOpen={openDrawer === 'aufgaben'}
        title="✓ Aufgaben für diesen Kontakt"
        onClose={() => setOpenDrawer(null)}
      >
        <AufgabenPanel
          aufgaben={aufgaben}
          onStatusChange={handleTaskStatusChange}
          onEditTask={openEditTask}
          onNewTask={openNewTask}
        />
      </Drawer>

      <Drawer
        isOpen={openDrawer === 'dokumente'}
        title="📎 Dokumente"
        onClose={() => setOpenDrawer(null)}
        widthClass="max-w-3xl"
      >
        <KontaktDokumenteTab
          kontaktId={kontaktId}
          primarySparte={kontaktSparten.find((z) => z.is_primary)?.sparte.name ?? kontakt?.sparte}
          onCreateFolgeaufgabe={(titel, fälligInTagen) => openNewTaskWithTitle(titel, fälligInTagen)}
        />
      </Drawer>

      <Drawer
        isOpen={openDrawer === 'beitragsuebersicht'}
        title="📊 Beitragsübersicht bearbeiten"
        onClose={() => setOpenDrawer(null)}
        widthClass="max-w-[1400px]"
      >
        <BeitragsuebersichtPanel
          kontaktId={kontaktId}
          kontaktTyp={kontakt.kontakt_typ === 'privat' ? 'privat' : 'gewerbe'}
          initialData={kontakt.beitragsuebersicht}
          onSave={handleSaveOverview}
          onClose={() => setOpenDrawer(null)}
          onSendMail={(file) => { setBeitragsMailFile(file); setOpenDrawer(null) }}
        />
      </Drawer>

      <Drawer
        isOpen={openDrawer === 'vertraege'}
        title="📋 Verträge"
        onClose={() => setOpenDrawer(null)}
        widthClass="max-w-3xl"
      >
        <KontaktVertraegeTab kontaktId={kontaktId} />
      </Drawer>

      <Drawer
        isOpen={openDrawer === 'placetel'}
        title="☎️ Placetel-Anrufe"
        onClose={() => setOpenDrawer(null)}
      >
        <PlacetelCallHistory contactId={kontaktId} />
      </Drawer>

      <Drawer
        isOpen={openDrawer === 'dialfire'}
        title="📞 Dialfire"
        onClose={() => setOpenDrawer(null)}
        widthClass="max-w-3xl"
      >
        <div className="space-y-8">
          <DialfireResponseTable
            flatView={dialfireResponse}
            lastCallInfo={undefined}
            changedFields={dialfireSnapshot?.changed_fields || []}
          />
          <div>
            <h3 className="text-base font-semibold text-gray-900 mb-4">Sync-Zusammenfassung</h3>
            <DialfireSyncPanel kontakt={kontakt} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900 mb-4">Anruf-Notizen (Historie)</h3>
            <NotesHistory contactId={kontakt.id} />
          </div>
        </div>
      </Drawer>

      <Drawer
        isOpen={openDrawer === 'automation'}
        title="⚡ Automation"
        onClose={() => setOpenDrawer(null)}
        widthClass="max-w-3xl"
      >
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
            klicktipp_id: kontakt.klicktipp_id,
            klicktipp_last_sync: kontakt.klicktipp_last_sync,
          }}
        />
      </Drawer>

      {/* ===================== Modals ===================== */}

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
                onClick={() => { setDeleteConfirm(false); setArchiveTasksToo(false) }}
                className="flex-1 border border-gray-200 text-gray-600 font-medium text-sm px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={() => handleArchiveKontakt(archiveTasksToo)}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors"
              >
                Ja, archivieren
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Aufgabe anlegen/bearbeiten */}
      <AufgabenEditModal
        kontaktId={kontaktId}
        aufgabe={editingAufgabe || newTaskDefaults}
        isOpen={taskModalOpen}
        onClose={() => {
          setTaskModalOpen(false)
          setEditingAufgabe(null)
          setNewTaskDefaults(null)
        }}
        onSave={handleSaveAufgabe}
      />
    </div>
  )
}
