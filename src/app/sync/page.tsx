'use client'
import { useState, useEffect, useRef, Fragment } from 'react'
import Link from 'next/link'
import { HelpButton } from '@/components/help/HelpButton'
import { SyncStatusBadge } from '@/components/SyncStatusBadge'
import { AutomatisierungenTabs } from '@/components/automatisierungen/AutomatisierungenTabs'

type SyncStatus = 'connected' | 'warning' | 'inactive'
type IntervalType = '15min' | '30min' | '60min' | 'daily' | 'weekly'

interface SyncSource {
  id: string
  name: string
  description: string
  status: SyncStatus
  count: string
  lastSync: string
  autoInterval: number
  // Kein echtes Backend vorhanden (siehe INITIAL_SOURCES) -- Kachel wird
  // abgeblendet dargestellt statt eine funktionierende Integration
  // vorzutäuschen.
  disabled?: boolean
}

interface SourceSyncConfig {
  enabled: boolean
  interval_type: IntervalType
  daily_hour: number
  weekly_day: number
  weekly_hour: number
  last_sync_at: string | null
  next_sync_at: string | null
}

interface PreviewResult {
  mode: string
  totalLeads: number
  formId: string
  leads: Array<{
    facebook_id: string
    first_name: string
    last_name: string
    email: string
    branche?: string
    versicherungstyp?: string
  }>
}

// sync_runs-gestützte Gesundheitsdaten (Phase 4 der Sync-Architektur-
// Vereinheitlichung) — ersetzen die vorher rein hartcodierten status/count-
// Werte für Facebook/Dialfire-Pull und speisen die 4 neuen reaktiven
// Kacheln (KlickTipp, Dialfire-Push, SuperChat, STRATO-Kalender).
interface IntegrationHealth {
  total: number
  success: number
  failed: number
  retrying: number
  lastRun: string | null
  lastStatus: string | null
}

interface SyncRun {
  id: string
  run_kind: 'batch' | 'item'
  integration: string
  trigger_type: string
  status: string
  attempt_count: number
  max_attempts: number
  error_class: string | null
  error_detail: string | null
  started_at: string
  finished_at: string | null
  next_retry_at: string | null
  contact: { id: string; first_name: string | null; last_name: string | null } | null
}

// UI-Kachel-ID → sync_runs.integration-Schlüssel. Getrennt gehalten, weil
// die bestehende "Dialfire"-Kachel (id 'dialfire') den Pull meint
// (integration 'dialfire_pull'), während 'dialfire' als integration-Wert
// bereits für den Push (KlickTipp-Regel → Dialfire-Kampagne) vergeben ist —
// die neue reaktive Push-Kachel bekommt deshalb die UI-ID 'dialfire_push'.
const INTEGRATION_KEY: Record<string, string> = {
  facebook: 'facebook',
  dialfire: 'dialfire_pull',
  klicktipp: 'klicktipp',
  dialfire_push: 'dialfire',
  superchat: 'superchat',
  strato_calendar: 'strato_calendar',
  strato_mail: 'strato_mail',
  klicktipp_webhook: 'klicktipp_webhook',
}

const INTEGRATION_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  dialfire_pull: 'Dialfire (Pull)',
  dialfire: 'Dialfire (Push)',
  klicktipp: 'KlickTipp',
  superchat: 'SuperChat',
  strato_calendar: 'STRATO-Kalender',
  strato_mail: 'STRATO-Mail',
  klicktipp_webhook: 'KlickTipp-Webhook',
  csv_import: 'CSV-Import',
}

// Detailaufschlüsselung für eine Batch-Zeile (Facebook, Dialfire-Pull,
// CSV-Import) — lazy nachgeladen beim Aufklappen, siehe batch-detail.ts.
interface BatchDetailItem {
  id: string
  label: string
  status: string
  attemptCount: number
  maxAttempts: number
  note?: string
  errorMessage?: string
}

interface BatchDetail {
  summary: string
  items: BatchDetailItem[]
}

// Integrationen ohne Retry-Handler (retry-handlers.ts) -- "Retry jetzt" wird
// für diese in der Lauf-Tabelle nicht angeboten, sonst würde der Klick nur
// mit "kein Retry-Handler" fehlschlagen. STRATO-Mail bewusst ohne Auto-Retry
// (E-Mail-Versand ist nicht idempotent, siehe strato-mail-sync.ts).
const NON_RETRYABLE_INTEGRATIONS = new Set(['strato_mail'])

interface ReactiveIntegration {
  id: string
  name: string
  description: string
}

const REACTIVE_INTEGRATIONS: ReactiveIntegration[] = [
  { id: 'klicktipp', name: 'KlickTipp', description: 'Kontakte und Tags aus Regeln automatisch übertragen' },
  { id: 'dialfire_push', name: 'Dialfire (Push)', description: 'Kontakte aus Regeln an Dialfire-Kampagnen übertragen' },
  { id: 'superchat', name: 'SuperChat', description: 'Kontakte manuell an SuperChat übertragen' },
  { id: 'strato_calendar', name: 'STRATO-Kalender', description: 'Termine beidseitig mit STRATO synchronisieren' },
  { id: 'strato_mail', name: 'STRATO-Mail', description: 'E-Mail-Versand über das STRATO-Postfach (Kontakt-Mails, Termin-Einladungen)' },
  { id: 'klicktipp_webhook', name: 'KlickTipp-Webhook', description: 'Eingehende KlickTipp-Ereignisse (Tags, Bounces, Kampagnen) verarbeiten' },
]

function healthStatus(health: IntegrationHealth | undefined): SyncStatus {
  if (!health || health.total === 0) return 'connected'
  return health.failed > 0 ? 'warning' : 'connected'
}

function healthCountText(health: IntegrationHealth | undefined): string {
  if (!health || health.total === 0) return 'Verbunden'
  return health.failed > 0
    ? `${health.failed} Fehler in den letzten ${health.total} Läufen`
    : `${health.success} von ${health.total} Läufen erfolgreich`
}

function healthLastSyncText(health: IntegrationHealth | undefined): string {
  if (!health?.lastRun) return '—'
  const d = new Date(health.lastRun)
  return `${d.toLocaleDateString('de-DE')}, ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`
}

// Ableitung für die Kachel-Badges — nutzt dasselbe Status-Vokabular wie die
// Automatisierungs-Läufe-Tabelle (SyncStatusBadge/classifyRunStatus) statt
// des separaten STATUS_CFG, um die Kacheln optisch konsistent zu machen.
function tileRunStatus(health: IntegrationHealth | undefined): 'success' | 'failed' | null {
  if (!health || health.total === 0) return null
  return health.failed > 0 ? 'failed' : 'success'
}

const INITIAL_SOURCES: SyncSource[] = [
  { id: 'facebook', name: 'Facebook Lead Ads', description: 'Leads direkt aus Facebook-Kampagnen', status: 'connected', count: 'Verbunden', lastSync: '—', autoInterval: 15 },
  { id: 'calendly', name: 'Calendly', description: 'Terminbuchungen automatisch als Leads', status: 'inactive', count: 'Nicht angebunden', lastSync: '—', autoInterval: 0, disabled: true },
  { id: 'email', name: 'E-Mail (IMAP)', description: 'Eingehende Anfragen als Leads erkennen', status: 'inactive', count: 'Nicht angebunden', lastSync: '—', autoInterval: 0, disabled: true },
  { id: 'csv', name: 'CSV-Import', description: 'Manuelle Datei-Importe', status: 'inactive', count: 'Manuell', lastSync: '—', autoInterval: 0 },
  { id: 'dialfire', name: 'Dialfire', description: 'Anruf-Ergebnisse aus dem Callcenter in verbundene Kontakte übernehmen', status: 'connected', count: 'Verbunden', lastSync: '—', autoInterval: 0 },
]

const STATUS_CFG: Record<SyncStatus, { label: string; dot: string; badge: string }> = {
  connected: { label: 'Verbunden', dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700' },
  warning: { label: 'Warnung', dot: 'bg-yellow-400', badge: 'bg-yellow-50 text-yellow-700' },
  inactive: { label: 'Manuell', dot: 'bg-gray-300', badge: 'bg-gray-100 text-gray-500' },
}

const INTERVAL_LABELS: Record<IntervalType, string> = {
  '15min': 'alle 15 Min',
  '30min': 'alle 30 Min',
  '60min': 'alle 60 Min',
  'daily': 'täglich um 08:00 Uhr',
  'weekly': 'montags um 08:00 Uhr',
}

export default function SyncPage() {
  const [sources, setSources] = useState<SyncSource[]>(INITIAL_SOURCES)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [facebookConfig, setFacebookConfig] = useState<SourceSyncConfig | null>(null)
  const [dialfireConfig, setDialfireConfig] = useState<SourceSyncConfig | null>(null)
  const [facebookPreviewEnabled, setFacebookPreviewEnabled] = useState(false)
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const [health, setHealth] = useState<Record<string, IntegrationHealth>>({})
  const [runs, setRuns] = useState<SyncRun[]>([])
  const [runsLoading, setRunsLoading] = useState(true)
  const [runsFilter, setRunsFilter] = useState<{ integration: string; status: string }>({ integration: '', status: '' })
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [runsToast, setRunsToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [retryAllLoading, setRetryAllLoading] = useState<string | null>(null)
  const [superchatReconcileLoading, setSuperchatReconcileLoading] = useState(false)
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null)
  const [runDetails, setRunDetails] = useState<Record<string, BatchDetail | null>>({})
  const [detailLoading, setDetailLoading] = useState<string | null>(null)
  const runsSectionRef = useRef<HTMLDivElement | null>(null)

  // Load sync config for Facebook + Dialfire
  useEffect(() => {
    fetch('/api/sync-config')
      .then(r => r.json())
      .then(cfg => setFacebookConfig(cfg))
      .catch(console.error)
    fetch('/api/dialfire-sync-config')
      .then(r => r.json())
      .then(cfg => setDialfireConfig(cfg))
      .catch(console.error)
  }, [])

  // Gesundheitsdaten für die Kacheln
  function loadHealth() {
    fetch('/api/sync-runs/summary')
      .then(r => r.json())
      .then(res => { if (res.success) setHealth(res.data) })
      .catch(console.error)
  }

  useEffect(() => { loadHealth() }, [])

  // Automatisierungs-Läufe (neu laden, sobald sich die Filter ändern)
  function loadRuns() {
    setRunsLoading(true)
    const params = new URLSearchParams()
    if (runsFilter.integration) params.set('integration', runsFilter.integration)
    if (runsFilter.status) params.set('status', runsFilter.status)
    params.set('limit', '500')
    fetch(`/api/sync-runs?${params.toString()}`)
      .then(r => r.json())
      .then(res => { if (res.success) setRuns(res.data.runs) })
      .catch(console.error)
      .finally(() => setRunsLoading(false))
  }

  useEffect(() => { loadRuns() }, [runsFilter.integration, runsFilter.status])

  function zeigeLaeufeFuer(integration: string) {
    setRunsFilter({ integration, status: '' })
    runsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // "Jetzt synchronisieren" für ereignisgetriggerte Integrationen: führt alle
  // aktuell wartenden Wiederholungen sofort aus, statt auf den nächsten
  // Cron-Tick zu warten (siehe processRetries() in retry-handlers.ts).
  async function handleRetryAll(integrationKey: string) {
    setRetryAllLoading(integrationKey)
    try {
      const res = await fetch('/api/sync-runs/retry-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ integration: integrationKey }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Fehlgeschlagen')
      zeigeToast(
        'success',
        json.processed > 0
          ? `${json.processed} wartende${json.processed === 1 ? 'r Lauf wurde' : ' Läufe wurden'} erneut ausgeführt`
          : 'Keine wartenden Läufe zum Wiederholen gefunden'
      )
      loadHealth()
      loadRuns()
    } catch (err) {
      zeigeToast('error', err instanceof Error ? err.message : 'Fehlgeschlagen')
    } finally {
      setRetryAllLoading(null)
    }
  }

  async function handleSuperchatReconcile() {
    setSuperchatReconcileLoading(true)
    try {
      const res = await fetch('/api/maintenance/superchat-link-existing', { method: 'POST' })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Bestandsabgleich fehlgeschlagen')
      const data = json.data
      zeigeToast(
        'success',
        `SuperChat-Abgleich: ${data.examined} geprüft, ${data.linked} verbunden, ${data.notFound} nicht gefunden, ${data.ambiguous} mehrdeutig, ${data.databaseConflicts} Datenbankkonflikte`
      )
    } catch (err) {
      zeigeToast('error', err instanceof Error ? err.message : 'Bestandsabgleich fehlgeschlagen')
    } finally {
      setSuperchatReconcileLoading(false)
    }
  }

  // Klick auf eine Batch-Zeile in der Automatisierungs-Läufe-Tabelle —
  // lädt die Detailaufschlüsselung (importierte Kontakte, Duplikate,
  // Fehler) einmalig nach und cached sie für erneutes Auf-/Zuklappen.
  function toggleExpand(run: SyncRun) {
    if (run.run_kind !== 'batch') return
    if (expandedRunId === run.id) {
      setExpandedRunId(null)
      return
    }
    setExpandedRunId(run.id)
    if (run.id in runDetails) return
    setDetailLoading(run.id)
    fetch(`/api/sync-runs/${run.id}/detail`)
      .then(r => r.json())
      .then(res => setRunDetails(prev => ({ ...prev, [run.id]: res.success ? res.data : null })))
      .catch(() => setRunDetails(prev => ({ ...prev, [run.id]: null })))
      .finally(() => setDetailLoading(null))
  }

  function zeigeToast(type: 'success' | 'error', msg: string) {
    setRunsToast({ type, msg })
    setTimeout(() => setRunsToast(null), 12000)
  }

  async function handleRetry(runId: string) {
    setActionLoading(runId)
    try {
      const res = await fetch(`/api/sync-runs/${runId}/retry`, { method: 'POST' })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Retry fehlgeschlagen')
      zeigeToast('success', 'Erneut ausgeführt')
      loadRuns()
    } catch (err) {
      zeigeToast('error', err instanceof Error ? err.message : 'Retry fehlgeschlagen')
    } finally {
      setActionLoading(null)
    }
  }

  async function handlePause(runId: string) {
    setActionLoading(runId)
    try {
      const res = await fetch(`/api/sync-runs/${runId}/pause`, { method: 'POST' })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Pausieren fehlgeschlagen')
      zeigeToast('success', 'Wiederholung pausiert')
      loadRuns()
    } catch (err) {
      zeigeToast('error', err instanceof Error ? err.message : 'Pausieren fehlgeschlagen')
    } finally {
      setActionLoading(null)
    }
  }

  function handleSync(id: string, preview: boolean = false) {
    if (id === 'facebook') {
      if (preview) {
        setPreviewLoading(true)
        fetch('/api/sync/facebook-leads-list')
          .then(r => r.json())
          .then(data => setPreviewResult(data))
          .catch(console.error)
          .finally(() => setPreviewLoading(false))
      } else {
        setSyncing(id)
        const startTime = Date.now()
        fetch('/api/sync/facebook-leads')
          .then(r => r.json())
          .then((data) => {
            setSources(prev => prev.map(s => s.id === id ? { ...s, lastSync: 'Gerade eben' } : s))
            loadHealth()
            loadRuns()
            return data
          })
          .catch(console.error)
          .finally(() => {
            // Minimum 2 seconds loading feedback
            const elapsed = Date.now() - startTime
            const delay = Math.max(0, 2000 - elapsed)
            setTimeout(() => setSyncing(null), delay)
          })
      }
    } else if (id === 'dialfire') {
      setSyncing(id)
      const startTime = Date.now()
      fetch('/api/sync/dialfire-pull')
        .then(r => r.json())
        .then((data) => {
          setSources(prev => prev.map(s => s.id === id ? { ...s, lastSync: 'Gerade eben' } : s))
          loadHealth()
          loadRuns()
          return data
        })
        .catch(console.error)
        .finally(() => {
          const elapsed = Date.now() - startTime
          const delay = Math.max(0, 2000 - elapsed)
          setTimeout(() => setSyncing(null), delay)
        })
    } else {
      setSyncing(id)
      setTimeout(() => {
        setSyncing(null)
        setSources(prev => prev.map(s => s.id === id ? { ...s, lastSync: 'Gerade eben' } : s))
      }, 1800)
    }
  }

  function toggleAuto(id: string) {
    if (id === 'facebook' && facebookConfig) {
      const newEnabled = !facebookConfig.enabled
      fetch('/api/sync-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newEnabled, interval_type: facebookConfig.interval_type }),
      })
        .then(r => r.json())
        .then(cfg => setFacebookConfig(cfg))
        .catch(console.error)
    } else if (id === 'dialfire' && dialfireConfig) {
      const newEnabled = !dialfireConfig.enabled
      fetch('/api/dialfire-sync-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newEnabled, interval_type: dialfireConfig.interval_type }),
      })
        .then(r => r.json())
        .then(cfg => setDialfireConfig(cfg))
        .catch(console.error)
    } else {
      setSources(prev => prev.map(s =>
        s.id === id ? { ...s, autoInterval: s.autoInterval > 0 ? 0 : (s.id === 'facebook' ? 15 : s.id === 'calendly' ? 30 : 60) } : s
      ))
    }
  }

  function setIntervalVal(id: string, intervalType: IntervalType) {
    if (id === 'facebook' && facebookConfig) {
      fetch('/api/sync-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true, interval_type: intervalType }),
      })
        .then(r => r.json())
        .then(cfg => setFacebookConfig(cfg))
        .catch(console.error)
    } else if (id === 'dialfire' && dialfireConfig) {
      fetch('/api/dialfire-sync-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true, interval_type: intervalType }),
      })
        .then(r => r.json())
        .then(cfg => setDialfireConfig(cfg))
        .catch(console.error)
    } else {
      const minutes = intervalType === '15min' ? 15 : intervalType === '30min' ? 30 : 60
      setSources(prev => prev.map(s => s.id === id ? { ...s, autoInterval: minutes } : s))
    }
  }

  const facebookEnabled = facebookConfig?.enabled || false
  const facebookInterval = facebookConfig?.interval_type || '15min'
  const dialfireEnabled = dialfireConfig?.enabled || false
  const dialfireInterval = dialfireConfig?.interval_type || '30min'

  return (
    <div className="p-8">
      <AutomatisierungenTabs />
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="text-2xl font-bold text-[#1A1A1A]">Synchronisation</h1>
            <HelpButton articleId="sync.overview" />
          </div>
          <p className="text-gray-500 text-sm mt-0.5">
            {runs.length > 0
              ? `Letzter Eintrag: ${new Date(runs[0].started_at).toLocaleDateString('de-DE')}, ${new Date(runs[0].started_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`
              : 'Noch keine Synchronisation'}
          </p>
        </div>
        <button
          onClick={() => sources.forEach(s => s.status !== 'inactive' && handleSync(s.id))}
          className="flex items-center gap-2 bg-[#1A1A1A] hover:bg-[#333] text-white font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          Alle synchronisieren
        </button>
      </div>

      {/* Preview Results */}
      {previewResult && (
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-blue-900">👁 Facebook Preview</h3>
              <p className="text-sm text-blue-700 mt-1">{previewResult.totalLeads} Leads würden importiert</p>
            </div>
            <button onClick={() => setPreviewResult(null)} className="text-blue-400 hover:text-blue-600">✕</button>
          </div>
          {previewResult.totalLeads > 0 && (
            <div className="bg-white rounded-lg p-4 max-h-80 overflow-y-auto">
              <div className="space-y-2">
                {previewResult.leads.slice(0, 20).map(lead => (
                  <div key={lead.facebook_id} className="flex items-start justify-between py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{lead.first_name} {lead.last_name}</p>
                      <p className="text-xs text-gray-500">{lead.email}</p>
                      {(lead.branche || lead.versicherungstyp) && (
                        <p className="text-xs text-blue-600 mt-0.5">{lead.branche && `Branche: ${lead.branche}`} {lead.versicherungstyp && `• Versicherung: ${lead.versicherungstyp}`}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {previewResult.totalLeads > 20 && (
                <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-100">
                  ... und {previewResult.totalLeads - 20} weitere Leads
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Quellen-Kacheln */}
      <div className="mb-2">
        <h2 className="font-semibold text-[#1A1A1A] text-sm">Zeitgesteuerte Verbindungen</h2>
        <p className="text-xs text-gray-400 mt-0.5">Laufen automatisch nach Zeitplan, zusätzlich manuell auslösbar</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8 items-stretch">
        {sources.map(source => {
          const isFacebook = source.id === 'facebook'
          const isDialfire = source.id === 'dialfire'
          const isHealthBacked = isFacebook || isDialfire
          const sourceHealth = isHealthBacked ? health[INTEGRATION_KEY[source.id]] : undefined
          const isSyncing = syncing === source.id
          const effectiveStatus = isHealthBacked && !isSyncing ? healthStatus(sourceHealth) : source.status
          const cfg = STATUS_CFG[effectiveStatus]
          const countText = isHealthBacked ? healthCountText(sourceHealth) : source.count
          const lastSyncText = isHealthBacked ? healthLastSyncText(sourceHealth) : source.lastSync
          const autoEnabled = isFacebook ? facebookEnabled : isDialfire ? dialfireEnabled : source.autoInterval > 0
          const displayInterval = isFacebook ? facebookInterval : isDialfire ? dialfireInterval : (['15min', '30min', '60min', 'daily', 'weekly'].includes(String(source.autoInterval)) ? String(source.autoInterval) as IntervalType : '15min')

          return (
            <div key={source.id} className={`bg-white rounded-xl border border-gray-200 shadow-sm p-4 h-full flex flex-col ${source.disabled ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {!isHealthBacked && <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />}
                    <h3 className="font-semibold text-[#1A1A1A] text-sm truncate">{source.name}</h3>
                  </div>
                  <p className="text-xs text-gray-400 line-clamp-2">{source.description}</p>
                </div>
                {isHealthBacked ? (
                  isSyncing ? (
                    <span className="flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">Synchronisiere…</span>
                  ) : tileRunStatus(sourceHealth) === null ? (
                    <span className="flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">Noch keine Läufe</span>
                  ) : (
                    <span className="flex-shrink-0"><SyncStatusBadge status={tileRunStatus(sourceHealth)!} /></span>
                  )
                ) : (
                  <span className={`flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.badge}`}>{cfg.label}</span>
                )}
              </div>
              <div className="bg-gray-50 rounded-lg px-3 py-2 mb-3">
                <p className="text-sm font-semibold text-[#1A1A1A] truncate">{countText}</p>
                <p className="text-xs text-gray-400 mt-0.5">Zuletzt: {lastSyncText}</p>
              </div>
              <div className="flex flex-col gap-2 mt-auto">
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={() => toggleAuto(source.id)} disabled={source.disabled}
                    className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 disabled:cursor-not-allowed ${autoEnabled ? 'bg-[#FFC300]' : 'bg-gray-200'}`}>
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${autoEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                  <span className="text-xs text-gray-500 flex-shrink-0">Auto</span>
                  {autoEnabled && !source.disabled && (
                    <select value={displayInterval} onChange={e => setIntervalVal(source.id, e.target.value as IntervalType)}
                      className="text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none min-w-0">
                      <option value="15min">alle 15 Min</option>
                      <option value="30min">alle 30 Min</option>
                      <option value="60min">alle 60 Min</option>
                      <option value="daily">täglich um 08:00 Uhr</option>
                      <option value="weekly">montags um 08:00 Uhr</option>
                    </select>
                  )}
                </div>
                <button onClick={() => handleSync(source.id)} disabled={isSyncing || source.disabled}
                  className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold border border-gray-200 hover:border-[#FFC300] hover:bg-[#FFC300]/5 text-[#1A1A1A] px-3 py-1.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:bg-transparent">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    strokeLinecap="round" strokeLinejoin="round" className={isSyncing ? 'animate-spin' : ''}>
                    <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                  </svg>
                  {isSyncing ? 'Läuft…' : 'Jetzt synchronisieren'}
                </button>
                {isFacebook && facebookEnabled && facebookConfig?.next_sync_at && (
                  <p className="text-xs text-gray-400 truncate">
                    Nächster Sync: {new Date(facebookConfig.next_sync_at).toLocaleDateString('de-DE')},{' '}
                    {new Date(facebookConfig.next_sync_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
                  </p>
                )}
                {isDialfire && dialfireEnabled && dialfireConfig?.next_sync_at && (
                  <p className="text-xs text-gray-400 truncate">
                    Nächster Sync: {new Date(dialfireConfig.next_sync_at).toLocaleDateString('de-DE')},{' '}
                    {new Date(dialfireConfig.next_sync_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
                  </p>
                )}
                <div className="flex items-center justify-between gap-2">
                  {isHealthBacked ? (
                    <button
                      onClick={() => zeigeLaeufeFuer(INTEGRATION_KEY[source.id])}
                      className="text-xs text-gray-400 hover:text-[#1A1A1A] underline underline-offset-2"
                    >
                      Läufe ansehen
                    </button>
                  ) : <span />}
                  {isFacebook && (
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setFacebookPreviewEnabled(!facebookPreviewEnabled)}
                        className={`relative w-7 h-4 rounded-full transition-colors ${facebookPreviewEnabled ? 'bg-blue-400' : 'bg-gray-200'}`}>
                        <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${facebookPreviewEnabled ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                      </button>
                      {facebookPreviewEnabled ? (
                        <button onClick={() => handleSync(source.id, true)} disabled={previewLoading}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50">
                          {previewLoading ? 'Lädt…' : '👁 Vorschau'}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">Preview</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Ereignisgetriggerte Integrationen — kein Zeitplan, ausgelöst durch Regel-Anwendung, Button-Klick oder Kalenderänderung */}
      <div className="mb-2">
        <h2 className="font-semibold text-[#1A1A1A] text-sm">Ereignisgetriggerte Integrationen</h2>
        <p className="text-xs text-gray-400 mt-0.5">Werden nicht zeitgesteuert ausgeführt, sondern durch Regeln, Klicks oder Kalenderänderungen</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8 items-stretch">
        {REACTIVE_INTEGRATIONS.map(source => {
          const sourceHealth = health[INTEGRATION_KEY[source.id]]
          const runStatus = tileRunStatus(sourceHealth)
          const isRetrying = retryAllLoading === source.id
          const isNonRetryable = NON_RETRYABLE_INTEGRATIONS.has(INTEGRATION_KEY[source.id])
          return (
            <div key={source.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 h-full flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-[#1A1A1A] text-sm mb-1 truncate">{source.name}</h3>
                  <p className="text-xs text-gray-400 line-clamp-2">{source.description}</p>
                </div>
                {runStatus === null ? (
                  <span className="flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">Noch keine Läufe</span>
                ) : (
                  <span className="flex-shrink-0"><SyncStatusBadge status={runStatus} /></span>
                )}
              </div>
              <div className="bg-gray-50 rounded-lg px-3 py-2 mb-3">
                <p className="text-sm font-semibold text-[#1A1A1A] truncate">{healthCountText(sourceHealth)}</p>
                <p className="text-xs text-gray-400 mt-0.5">Zuletzt: {healthLastSyncText(sourceHealth)}</p>
              </div>
              <div className="flex flex-col gap-2 mt-auto">
                {source.id === 'superchat' && (
                  <button
                    onClick={handleSuperchatReconcile}
                    disabled={superchatReconcileLoading}
                    className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold border border-[#FFC300] bg-[#FFC300]/10 text-[#1A1A1A] px-3 py-1.5 rounded-lg transition-all hover:bg-[#FFC300]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {superchatReconcileLoading ? 'Bestand wird abgeglichen…' : 'Bestehende Kontakte verbinden'}
                  </button>
                )}
                {isNonRetryable ? (
                  <button
                    disabled
                    title="E-Mail-Versand kann nicht automatisch wiederholt werden — nicht idempotent. Bitte betroffenen Kontakt manuell prüfen."
                    className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold border border-gray-200 text-gray-300 px-3 py-1.5 rounded-lg cursor-not-allowed"
                  >
                    Jetzt synchronisieren
                  </button>
                ) : (
                  <button
                    onClick={() => handleRetryAll(INTEGRATION_KEY[source.id])}
                    disabled={isRetrying}
                    title="Führt alle aktuell wartenden Wiederholungen sofort aus (löst keinen neuen Abgleich für bereits erfolgreiche Kontakte aus)"
                    className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold border border-gray-200 hover:border-[#FFC300] hover:bg-[#FFC300]/5 text-[#1A1A1A] px-3 py-1.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:bg-transparent"
                  >
                    {isRetrying ? 'Läuft…' : 'Jetzt synchronisieren'}
                  </button>
                )}
                <button
                  onClick={() => zeigeLaeufeFuer(INTEGRATION_KEY[source.id])}
                  className="self-center text-xs text-gray-400 hover:text-[#1A1A1A] underline underline-offset-2"
                >
                  Läufe ansehen
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Automatisierungs-Läufe — die eine, vereinheitlichte sync_runs-Tabelle
          über alle Integrationen inkl. CSV-Import. Batch-Zeilen (Facebook,
          Dialfire-Pull, CSV-Import) sind aufklappbar und zeigen dieselbe
          Aufschlüsselung wie früher das separate Sync-Protokoll (importierte
          Kontakte, Duplikate, Fehler), siehe batch-detail.ts. */}
      <div ref={runsSectionRef} className="bg-white rounded-xl border border-gray-200 shadow-sm mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-[#1A1A1A]">Automatisierungs-Läufe</h2>
            <p className="text-xs text-gray-400 mt-0.5">Einzelne Sync-Versuche über alle Integrationen, mit Fehlerdetail und Wiederholung</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={runsFilter.integration}
              onChange={e => setRunsFilter(f => ({ ...f, integration: e.target.value }))}
              className="text-xs border border-gray-200 rounded px-2 py-1.5 bg-white focus:outline-none"
            >
              <option value="">Alle Integrationen</option>
              <option value="facebook">Facebook</option>
              <option value="dialfire_pull">Dialfire (Pull)</option>
              <option value="dialfire">Dialfire (Push)</option>
              <option value="klicktipp">KlickTipp</option>
              <option value="superchat">SuperChat</option>
              <option value="strato_calendar">STRATO-Kalender</option>
              <option value="strato_mail">STRATO-Mail</option>
              <option value="klicktipp_webhook">KlickTipp-Webhook</option>
              <option value="csv_import">CSV-Import</option>
            </select>
            <select
              value={runsFilter.status}
              onChange={e => setRunsFilter(f => ({ ...f, status: e.target.value }))}
              className="text-xs border border-gray-200 rounded px-2 py-1.5 bg-white focus:outline-none"
            >
              <option value="">Alle Status</option>
              <option value="success">Erfolgreich</option>
              <option value="failed">Fehlgeschlagen</option>
              <option value="dead_letter">Fehlgeschlagen (kein Retry)</option>
              <option value="retrying">Wird wiederholt</option>
              <option value="skipped">Pausiert</option>
            </select>
            <button onClick={loadRuns} className="text-xs text-gray-400 hover:text-[#1A1A1A] flex items-center gap-1 transition-colors">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
              Aktualisieren
            </button>
          </div>
        </div>

        {runsLoading ? (
          <div className="text-center py-12 text-gray-400 text-sm">Läufe werden geladen…</div>
        ) : runs.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">Keine Läufe für diese Filter.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  {['Zeitpunkt', 'Integration', 'Typ', 'Kontakt', 'Status', 'Versuch', 'Aktionen'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-5 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {runs.map(run => {
                  const isBatch = run.run_kind === 'batch'
                  const isExpanded = expandedRunId === run.id
                  const detail = runDetails[run.id]
                  return (
                    <Fragment key={run.id}>
                      <tr
                        onClick={() => toggleExpand(run)}
                        className={`border-b border-gray-50 transition-colors ${isBatch ? 'cursor-pointer hover:bg-gray-50/60' : 'hover:bg-gray-50/40'}`}
                      >
                        <td className="px-5 py-3 text-gray-500 text-xs whitespace-nowrap">
                          {new Date(run.started_at).toLocaleDateString('de-DE')},{' '}
                          {new Date(run.started_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
                        </td>
                        <td className="px-5 py-3 font-medium text-[#1A1A1A] text-xs whitespace-nowrap">
                          {INTEGRATION_LABELS[run.integration] ?? run.integration}
                        </td>
                        <td className="px-5 py-3 text-gray-500 text-xs">
                          {isBatch ? (
                            <span className="inline-flex items-center gap-1">
                              <span className={`inline-block transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▸</span>
                              Batch
                            </span>
                          ) : (
                            'Einzelvorgang'
                          )}
                        </td>
                        <td className="px-5 py-3 text-xs">
                          {run.contact ? (
                            <Link
                              href={`/kontakte/${run.contact.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-gray-700 hover:text-yellow-600"
                            >
                              {[run.contact.first_name, run.contact.last_name].filter(Boolean).join(' ') || 'Ohne Namen'}
                            </Link>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <SyncStatusBadge status={run.status} detail={run.error_detail} />
                        </td>
                        <td className="px-5 py-3 text-gray-500 text-xs whitespace-nowrap">{run.attempt_count}/{run.max_attempts}</td>
                        <td className="px-5 py-3">
                          {run.run_kind === 'item' && (run.status === 'retrying' || run.status === 'dead_letter') && (
                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              {!NON_RETRYABLE_INTEGRATIONS.has(run.integration) && (
                                <button
                                  onClick={() => handleRetry(run.id)}
                                  disabled={actionLoading === run.id}
                                  className="text-xs font-semibold text-[#1A1A1A] border border-gray-200 hover:border-[#FFC300] hover:bg-[#FFC300]/5 px-2 py-1 rounded transition-all disabled:opacity-50"
                                >
                                  {actionLoading === run.id ? '…' : 'Retry jetzt'}
                                </button>
                              )}
                              {run.status === 'retrying' && (
                                <button
                                  onClick={() => handlePause(run.id)}
                                  disabled={actionLoading === run.id}
                                  className="text-xs text-gray-500 hover:text-gray-800 disabled:opacity-50"
                                >
                                  Pause
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                      {isBatch && isExpanded && (
                        <tr className="bg-gray-50/60 border-b border-gray-100">
                          <td colSpan={7} className="px-5 py-4">
                            {detailLoading === run.id ? (
                              <p className="text-xs text-gray-400">Details werden geladen…</p>
                            ) : !detail ? (
                              <p className="text-xs text-gray-400">Keine weiteren Details verfügbar.</p>
                            ) : (
                              <div className="space-y-2">
                                {detail.summary && (
                                  <p className="text-xs text-gray-600">{detail.summary}</p>
                                )}
                                {detail.items.length === 0 ? (
                                  <p className="text-xs text-gray-400">Keine weiteren Details verfügbar.</p>
                                ) : (
                                  <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
                                    {detail.items.map((item, i) => (
                                      <div
                                        key={item.id || i}
                                        onClick={(e) => e.stopPropagation()}
                                        className="flex items-center justify-between gap-3 py-1.5 border-b border-gray-100 last:border-0"
                                      >
                                        <div className="min-w-0 flex-1">
                                          <span className="text-xs text-gray-700 truncate block">{item.label}</span>
                                          {(item.note || item.errorMessage) && (
                                            <span className={`text-[11px] ${item.errorMessage ? 'text-red-500' : 'text-gray-400'}`}>
                                              {item.errorMessage || item.note}
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                          <SyncStatusBadge status={item.status} detail={item.errorMessage} />
                                          {item.id && (item.status === 'retrying' || item.status === 'dead_letter') && !NON_RETRYABLE_INTEGRATIONS.has(run.integration) && (
                                            <button
                                              onClick={() => handleRetry(item.id)}
                                              disabled={actionLoading === item.id}
                                              className="text-[11px] font-semibold text-[#1A1A1A] border border-gray-200 hover:border-[#FFC300] hover:bg-[#FFC300]/5 px-2 py-0.5 rounded transition-all disabled:opacity-50"
                                            >
                                              {actionLoading === item.id ? '…' : 'Retry'}
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {runsToast && (
        <div
          className={`fixed top-4 right-4 z-50 rounded-lg border px-4 py-2.5 text-sm shadow-lg ${
            runsToast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {runsToast.msg}
        </div>
      )}
    </div>
  )
}
