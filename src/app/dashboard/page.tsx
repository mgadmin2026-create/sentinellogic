'use client'
// Mitarbeiterdashboard — personalisierte Startseite: bündelt eigene Kontakte,
// überfällige/heute fällige Aufgaben und Aktivitäten statt globaler KPIs mit
// Platzhalterwerten (siehe CLAUDE.md Roadmap Phase A "Mitarbeiterdashboard").
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { STATUS_LABELS, STATUS_COLORS } from '@/data/mock'
import { getLatestRelease } from '@/data/release-notes'
import { ReleaseNotificationBanner } from '@/components/ReleaseNotificationBanner'
import { KontaktImportModal } from '@/components/KontaktImportModal'
import { KontaktEditModal } from '@/components/KontaktEditModal'
import { AufgabenEditModal } from '@/components/AufgabenEditModal'
import { getActivityIcon, getActivityColor } from '@/components/kontakt/AktivitaetenPanel'
import { PIPELINE_STEPS } from '@/components/kontakt/ProzessPanel'
import { isAdmin } from '@/lib/roles'

interface CurrentUser {
  id: string
  name: string
  email: string
  role: string
}

interface Kontakt {
  id: string
  first_name: string
  last_name: string
  company_name?: string
  status: 'new' | 'contacted' | 'qualified' | 'customer'
  pipeline_stage?: string
  assigned_user_id?: string
  created_at: string
}

interface Aufgabe {
  id: string
  contact_id?: string
  contact?: { first_name: string; last_name: string } | null
  titel: string
  status: 'offen' | 'in_bearbeitung' | 'erledigt'
  priorität: 'niedrig' | 'mittel' | 'hoch'
  fällig: string
  archived_at?: string | null
}

interface Aktivität {
  id: string
  type: string
  description: string
  created_at: string
  contact?: { id: string; first_name: string; last_name: string; company_name?: string } | null
  user?: { name: string } | null
}

const PRIORITÄT_CHIP: Record<string, string> = {
  hoch: 'bg-red-100 text-red-700',
  mittel: 'bg-orange-100 text-orange-700',
  niedrig: 'bg-gray-100 text-gray-600',
}
const PRIORITÄT_LABELS: Record<string, string> = { hoch: 'Hoch', mittel: 'Mittel', niedrig: 'Niedrig' }

function todayStr() {
  return new Date().toISOString().split('T')[0]
}
function isOverdue(a: Aufgabe) {
  return a.status !== 'erledigt' && a.fällig < todayStr()
}
function isDueToday(a: Aufgabe) {
  return a.status !== 'erledigt' && a.fällig === todayStr()
}
function daysOverdue(fällig: string) {
  const diff = Math.floor((new Date(todayStr()).getTime() - new Date(fällig).getTime()) / 86_400_000)
  return Math.max(1, diff)
}

export default function DashboardPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [viewMode, setViewMode] = useState<'me' | 'team'>('me')
  const [kontakte, setKontakte] = useState<Kontakt[]>([])
  const [aufgaben, setAufgaben] = useState<Aufgabe[]>([])
  const [aktivitäten, setAktivitäten] = useState<Aktivität[]>([])
  const [loading, setLoading] = useState(true)
  const [showBanner, setShowBanner] = useState(true)
  const [csvModalOpen, setCsvModalOpen] = useState(false)
  const [newKontaktModalOpen, setNewKontaktModalOpen] = useState(false)
  const [newAufgabeModalOpen, setNewAufgabeModalOpen] = useState(false)

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((res) => { if (res.success) setCurrentUser(res.data) })
      .catch(() => {})
  }, [])

  const loadData = useCallback(async (uid: string | null) => {
    setLoading(true)
    const scope = uid ? `&assigned_user_id=${uid}` : ''
    try {
      const [kRes, aRes, actRes] = await Promise.all([
        fetch(`/api/kontakte?limit=1000&includeArchived=false${scope}`).then((r) => r.json()),
        fetch(`/api/aufgaben?limit=1000${scope}`).then((r) => r.json()),
        fetch(`/api/aktivitaeten?limit=6${scope}`).then((r) => r.json()),
      ])
      if (kRes.success) setKontakte(kRes.data)
      if (aRes.success) setAufgaben(aRes.data)
      if (actRes.success) setAktivitäten(actRes.data)
    } catch (err) {
      console.error('[Dashboard] Laden fehlgeschlagen:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!currentUser) return
    loadData(viewMode === 'me' ? currentUser.id : null)
  }, [currentUser, viewMode, loadData])

  function reload() {
    if (!currentUser) return
    loadData(viewMode === 'me' ? currentUser.id : null)
  }

  async function handleCompleteTask(id: string) {
    setAufgaben((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'erledigt' } : a)))
    try {
      await fetch(`/api/aufgaben/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'erledigt' }),
      })
    } catch (err) {
      console.error('[Dashboard] Aufgabe abschließen fehlgeschlagen:', err)
    }
    reload()
  }

  async function handleSaveAufgabe(form: any) {
    const res = await fetch('/api/aufgaben', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'Fehler beim Speichern')
    setNewAufgabeModalOpen(false)
    reload()
  }

  async function handleSaveKontakt(form: any) {
    const res = await fetch('/api/kontakte', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Fehler beim Speichern')
    }
    setNewKontaktModalOpen(false)
    reload()
  }

  const openTasks = aufgaben.filter((a) => !a.archived_at)
  const overdueTasks = openTasks.filter(isOverdue).sort((a, b) => a.fällig.localeCompare(b.fällig))
  const todayTasks = openTasks.filter(isDueToday)
  const focusTasks = [...overdueTasks, ...todayTasks].slice(0, 7)

  const totalKontakte = kontakte.length
  const customerCount = kontakte.filter((k) => k.status === 'customer').length
  const abschlussquote = totalKontakte > 0 ? Math.round((customerCount / totalKontakte) * 100) : 0

  const pipelineCounts = PIPELINE_STEPS.map((step) => ({
    ...step,
    count: kontakte.filter((k) => k.pipeline_stage === step.key).length,
  }))
  const maxPipelineCount = Math.max(1, ...pipelineCounts.map((p) => p.count))

  const stepIndex = (stage?: string) => Math.max(0, PIPELINE_STEPS.findIndex((s) => s.key === stage))
  const meineKontakte = [...kontakte]
    .sort((a, b) => stepIndex(b.pipeline_stage) - stepIndex(a.pipeline_stage) || b.created_at.localeCompare(a.created_at))
    .slice(0, 6)

  const latestRelease = getLatestRelease()
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Guten Morgen' : hour < 18 ? 'Guten Tag' : 'Guten Abend'
  const firstName = currentUser?.name?.split(' ')[0] ?? ''
  const dateLabel = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const admin = isAdmin(currentUser?.role)

  return (
    <div>
      {showBanner && latestRelease && (
        <ReleaseNotificationBanner release={latestRelease} onDismiss={() => setShowBanner(false)} />
      )}

      <div className="p-4 md:p-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-[#1A1A1A]">
              {greeting}{firstName ? `, ${firstName}` : ''}
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              {dateLabel}
              {!loading && (overdueTasks.length > 0 || todayTasks.length > 0) && (
                <> · {overdueTasks.length > 0 && <span className="text-red-600 font-medium">{overdueTasks.length} Aufgabe{overdueTasks.length !== 1 ? 'n' : ''} überfällig</span>}
                {overdueTasks.length > 0 && todayTasks.length > 0 && ', '}
                {todayTasks.length > 0 && <span className="font-medium">{todayTasks.length} heute fällig</span>}</>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {admin && (
              <div className="flex items-center bg-white border border-gray-200 rounded-lg p-0.5 gap-0.5">
                <button
                  onClick={() => setViewMode('me')}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${viewMode === 'me' ? 'bg-[#1A1A1A] text-white' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Meine Ansicht
                </button>
                <button
                  onClick={() => setViewMode('team')}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${viewMode === 'team' ? 'bg-[#1A1A1A] text-white' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Team
                </button>
              </div>
            )}
            <button
              onClick={() => setCsvModalOpen(true)}
              className="flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-[#1A1A1A] font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Import
            </button>
            <button
              onClick={() => setNewKontaktModalOpen(true)}
              className="flex items-center gap-2 bg-[#FFC300] hover:bg-[#e6b000] text-[#1A1A1A] font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Neuer Kontakt
            </button>
          </div>
        </div>

        {/* KPI-Reihe */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{viewMode === 'me' ? 'Meine Kontakte' : 'Kontakte gesamt'}</p>
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
              </div>
            </div>
            <p className="text-2xl font-extrabold text-[#1A1A1A]">{loading ? '—' : totalKontakte}</p>
            <p className="text-xs text-gray-400 mt-1">in aktiver Betreuung</p>
          </div>
          <div className={`bg-white rounded-xl border p-4 ${overdueTasks.length > 0 ? 'border-red-200' : 'border-gray-200'}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Überfällig</p>
              <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              </div>
            </div>
            <p className="text-2xl font-extrabold text-[#1A1A1A]">{loading ? '—' : overdueTasks.length}</p>
            <p className={`text-xs mt-1 ${overdueTasks.length > 0 ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
              {overdueTasks.length > 0 ? 'jetzt bearbeiten' : 'alles im Zeitplan'}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Heute fällig</p>
              <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2"><path d="M9 11l3 3L22 4" /><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
            </div>
            <p className="text-2xl font-extrabold text-[#1A1A1A]">{loading ? '—' : todayTasks.length}</p>
            <p className="text-xs text-gray-400 mt-1">
              {todayTasks.filter((t) => t.priorität === 'hoch').length > 0 ? `${todayTasks.filter((t) => t.priorität === 'hoch').length} hohe Priorität` : 'für heute'}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Abschlussquote</p>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
              </div>
            </div>
            <p className="text-2xl font-extrabold text-[#1A1A1A]">{loading ? '—' : `${abschlussquote}%`}</p>
            <p className="text-xs text-gray-400 mt-1">{customerCount} Kunden von {totalKontakte} Kontakten</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1.55fr_1fr] gap-4 items-start">
          {/* Linke Spalte */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
                <h2 className="font-semibold text-[#1A1A1A] flex items-center gap-2">
                  🎯 Heute im Fokus
                  {focusTasks.length > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-100 text-red-700 text-[11px] font-bold">
                      {overdueTasks.length + todayTasks.length}
                    </span>
                  )}
                </h2>
                <Link href="/aufgaben" className="text-sm text-gray-500 hover:text-[#1A1A1A] font-medium">Alle Aufgaben →</Link>
              </div>
              {loading ? (
                <p className="text-center text-gray-400 py-10 text-sm">Wird geladen…</p>
              ) : focusTasks.length === 0 ? (
                <p className="text-center text-gray-400 py-10 text-sm">Keine überfälligen oder heute fälligen Aufgaben — gut gemacht.</p>
              ) : (
                focusTasks.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 px-5 py-3 border-b border-gray-50 last:border-0">
                    <button
                      onClick={() => handleCompleteTask(t.id)}
                      aria-label="Als erledigt markieren"
                      className="w-[18px] h-[18px] rounded-md border-2 border-gray-300 hover:border-emerald-500 flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#1A1A1A] truncate">{t.titel}</p>
                      <div className="text-xs text-gray-500 flex items-center gap-1.5 flex-wrap mt-0.5">
                        {t.contact_id && t.contact && (
                          <Link href={`/kontakte/${t.contact_id}`} className="font-semibold text-gray-600 hover:underline">
                            {t.contact.first_name} {t.contact.last_name}
                          </Link>
                        )}
                        <span className={`inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full ${PRIORITÄT_CHIP[t.priorität]}`}>
                          {PRIORITÄT_LABELS[t.priorität]}
                        </span>
                      </div>
                    </div>
                    {isOverdue(t) ? (
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-red-50 text-red-700 flex-shrink-0 whitespace-nowrap">
                        Überfällig · {daysOverdue(t.fällig)} Tag{daysOverdue(t.fällig) !== 1 ? 'e' : ''}
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-orange-50 text-orange-700 flex-shrink-0">Heute</span>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
                <h2 className="font-semibold text-[#1A1A1A]">👤 {viewMode === 'me' ? 'Meine Kontakte' : 'Kontakte'}</h2>
                <Link href="/kontakte" className="text-sm text-gray-500 hover:text-[#1A1A1A] font-medium">Alle {totalKontakte} →</Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['Name', 'Status', 'Fortschritt', 'Erstellt'].map((h) => (
                        <th key={h} className="text-left text-[10.5px] font-bold text-gray-400 uppercase tracking-wide px-5 py-2.5">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={4} className="text-center text-gray-400 py-10 text-sm">Wird geladen…</td></tr>
                    ) : meineKontakte.length === 0 ? (
                      <tr><td colSpan={4} className="text-center text-gray-400 py-10 text-sm">Keine Kontakte zugewiesen.</td></tr>
                    ) : meineKontakte.map((k) => {
                      const idx = stepIndex(k.pipeline_stage)
                      return (
                        <tr key={k.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                          <td className="px-5 py-2.5">
                            <Link href={`/kontakte/${k.id}`} className="font-semibold text-[#1A1A1A] hover:underline">
                              {k.first_name} {k.last_name}
                            </Link>
                            {k.company_name && <div className="text-xs text-gray-500">{k.company_name}</div>}
                          </td>
                          <td className="px-5 py-2.5">
                            {k.status && STATUS_LABELS[k.status] ? (
                              <span className={`inline-flex text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[k.status]}`}>{STATUS_LABELS[k.status]}</span>
                            ) : (
                              <span className="text-gray-300 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-5 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className="w-14 h-1.5 rounded-full bg-gray-100 overflow-hidden inline-block">
                                <span className="block h-full bg-[#FFC300]" style={{ width: `${((idx + 1) / PIPELINE_STEPS.length) * 100}%` }} />
                              </span>
                              <span className="text-xs text-gray-400">{idx + 1}/{PIPELINE_STEPS.length}</span>
                            </div>
                          </td>
                          <td className="px-5 py-2.5 text-gray-500 text-xs">{new Date(k.created_at).toLocaleDateString('de-DE')}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Rechte Spalte */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
                <h2 className="font-semibold text-[#1A1A1A]">📝 Letzte Aktivitäten</h2>
              </div>
              <div className="px-5 py-2">
                {loading ? (
                  <p className="text-center text-gray-400 py-8 text-sm">Wird geladen…</p>
                ) : aktivitäten.length === 0 ? (
                  <p className="text-center text-gray-400 py-8 text-sm">Noch keine Aktivitäten.</p>
                ) : (
                  aktivitäten.map((akt) => (
                    <div key={akt.id} className="flex items-start gap-2.5 py-2.5 border-b border-gray-50 last:border-0">
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 text-xs ${getActivityColor(akt.type)}`}>
                        {getActivityIcon(akt.type)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs leading-relaxed text-[#1A1A1A]">
                          {akt.contact && (
                            <Link href={`/kontakte/${akt.contact.id}`} className="font-bold hover:underline">
                              {akt.contact.first_name} {akt.contact.last_name}
                            </Link>
                          )}{akt.contact ? ' — ' : ''}{akt.description}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {new Date(akt.created_at).toLocaleDateString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200">
              <div className="px-5 py-3.5 border-b border-gray-100">
                <h2 className="font-semibold text-[#1A1A1A]">📊 {viewMode === 'me' ? 'Meine Pipeline' : 'Team-Pipeline'}</h2>
              </div>
              <div className="py-2.5">
                {pipelineCounts.map((step, i) => (
                  <div key={step.key} className="flex items-center gap-2.5 px-5 py-1.5">
                    <span className="text-[11px] text-gray-500 w-[104px] flex-shrink-0 truncate" title={step.label}>{i + 1}. {step.label}</span>
                    <span className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <span className="block h-full bg-[#FFC300] rounded-full" style={{ width: `${(step.count / maxPipelineCount) * 100}%` }} />
                    </span>
                    <span className="text-[11px] font-bold text-gray-500 w-5 text-right flex-shrink-0">{step.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200">
              <div className="px-5 py-3.5 border-b border-gray-100">
                <h2 className="font-semibold text-[#1A1A1A]">⚡ Schnellzugriff</h2>
              </div>
              <div className="grid grid-cols-2 gap-2 p-4">
                <button
                  onClick={() => setNewKontaktModalOpen(true)}
                  className="flex flex-col items-start gap-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg p-3 text-left transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></svg>
                  <span className="text-xs font-bold text-[#1A1A1A]">Neuer Kontakt</span>
                </button>
                <button
                  onClick={() => setNewAufgabeModalOpen(true)}
                  className="flex flex-col items-start gap-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg p-3 text-left transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2"><path d="M9 11l3 3L22 4" /><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span className="text-xs font-bold text-[#1A1A1A]">Neue Aufgabe</span>
                </button>
                <Link
                  href="/kalender"
                  className="flex flex-col items-start gap-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg p-3 text-left transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                  <span className="text-xs font-bold text-[#1A1A1A]">Termin planen</span>
                </Link>
                <button
                  onClick={() => setCsvModalOpen(true)}
                  className="flex flex-col items-start gap-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg p-3 text-left transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                  <span className="text-xs font-bold text-[#1A1A1A]">CSV importieren</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <KontaktImportModal isOpen={csvModalOpen} onClose={() => setCsvModalOpen(false)} onImported={reload} />
      <KontaktEditModal kontakt={null} isOpen={newKontaktModalOpen} onClose={() => setNewKontaktModalOpen(false)} onSave={handleSaveKontakt} />
      <AufgabenEditModal aufgabe={null} isOpen={newAufgabeModalOpen} onClose={() => setNewAufgabeModalOpen(false)} onSave={handleSaveAufgabe} />
    </div>
  )
}
