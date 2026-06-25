'use client'
import { useState, useEffect } from 'react'

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
}

interface SyncLogEntry {
  id: string
  created_at: string
  source: string
  count: number
  duplicates_skipped: number
  status: 'success' | 'warning' | 'error'
  message: string
  lead_names: string[]
  error_details?: Array<{ lead_id: string; email: string | null; error_message: string }>
  duplicate_details?: Array<{ facebook_id: string; email: string | null; existing_contact_id: string | null; action: string; reason: string }>
}

interface FacebookSyncConfig {
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

const INITIAL_SOURCES: SyncSource[] = [
  { id: 'facebook', name: 'Facebook Lead Ads', description: 'Leads direkt aus Facebook-Kampagnen', status: 'connected', count: 'Verbunden', lastSync: '—', autoInterval: 15 },
  { id: 'calendly', name: 'Calendly', description: 'Terminbuchungen automatisch als Leads', status: 'connected', count: 'Verbunden', lastSync: '—', autoInterval: 30 },
  { id: 'email', name: 'E-Mail (IMAP)', description: 'Eingehende Anfragen als Leads erkennen', status: 'warning', count: 'Konfiguration ausstehend', lastSync: '—', autoInterval: 60 },
  { id: 'csv', name: 'CSV-Import', description: 'Manuelle Datei-Importe', status: 'inactive', count: 'Manuell', lastSync: '—', autoInterval: 0 },
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
  const [syncLog, setSyncLog] = useState<SyncLogEntry[]>([])
  const [loadingLog, setLoadingLog] = useState(true)
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null)
  const [facebookConfig, setFacebookConfig] = useState<FacebookSyncConfig | null>(null)
  const [facebookPreviewEnabled, setFacebookPreviewEnabled] = useState(false)
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  // Load sync config for Facebook
  useEffect(() => {
    fetch('/api/sync-config')
      .then(r => r.json())
      .then(cfg => setFacebookConfig(cfg))
      .catch(console.error)
  }, [])

  // Load sync log from DB
  function loadSyncLog() {
    fetch('/api/sync-log?limit=20')
      .then(r => r.json())
      .then(res => { if (res.success) setSyncLog(res.data) })
      .catch(console.error)
      .finally(() => setLoadingLog(false))
  }

  useEffect(() => { loadSyncLog() }, [])

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
        fetch('/api/sync/facebook-leads')
          .then(r => r.json())
          .then(() => {
            setSources(prev => prev.map(s => s.id === id ? { ...s, lastSync: 'Gerade eben' } : s))
            loadSyncLog()
          })
          .catch(console.error)
          .finally(() => setSyncing(null))
      }
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
    } else {
      const minutes = intervalType === '15min' ? 15 : intervalType === '30min' ? 30 : 60
      setSources(prev => prev.map(s => s.id === id ? { ...s, autoInterval: minutes } : s))
    }
  }

  const facebookSource = sources.find(s => s.id === 'facebook')
  const isFacebookSyncing = syncing === 'facebook'
  const facebookEnabled = facebookConfig?.enabled || false
  const facebookInterval = facebookConfig?.interval_type || '15min'

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Synchronisation</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {syncLog.length > 0
              ? `Letzter Eintrag: ${new Date(syncLog[0].created_at).toLocaleDateString('de-DE')}, ${new Date(syncLog[0].created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {sources.map(source => {
          const cfg = STATUS_CFG[source.status]
          const isSyncing = syncing === source.id
          const isFacebook = source.id === 'facebook'
          const autoEnabled = isFacebook ? facebookEnabled : source.autoInterval > 0
          const displayInterval = isFacebook ? facebookInterval : (['15min', '30min', '60min', 'daily', 'weekly'].includes(String(source.autoInterval)) ? String(source.autoInterval) as IntervalType : '15min')

          return (
            <div key={source.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full ${cfg.dot} ${isSyncing ? 'animate-pulse' : ''}`} />
                    <h3 className="font-semibold text-[#1A1A1A] text-sm">{source.name}</h3>
                  </div>
                  <p className="text-xs text-gray-400">{source.description}</p>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${cfg.badge}`}>
                  {isSyncing ? 'Synchronisiere…' : cfg.label}
                </span>
              </div>
              <div className="bg-gray-50 rounded-lg px-4 py-3 mb-4">
                <p className="text-sm font-semibold text-[#1A1A1A]">{source.count}</p>
                <p className="text-xs text-gray-400 mt-0.5">Zuletzt: {source.lastSync}</p>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <button onClick={() => toggleAuto(source.id)}
                      className={`relative w-9 h-5 rounded-full transition-colors ${autoEnabled ? 'bg-[#FFC300]' : 'bg-gray-200'}`}>
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${autoEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                    <span className="text-xs text-gray-500">Auto</span>
                    {autoEnabled && (
                      <select value={displayInterval} onChange={e => setIntervalVal(source.id, e.target.value as IntervalType)}
                        className="text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none">
                        <option value="15min">alle 15 Min</option>
                        <option value="30min">alle 30 Min</option>
                        <option value="60min">alle 60 Min</option>
                        <option value="daily">täglich um 08:00 Uhr</option>
                        <option value="weekly">montags um 08:00 Uhr</option>
                      </select>
                    )}
                  </div>
                  <button onClick={() => handleSync(source.id)} disabled={isSyncing}
                    className="flex items-center gap-1.5 text-xs font-semibold border border-gray-200 hover:border-[#FFC300] hover:bg-[#FFC300]/5 text-[#1A1A1A] px-3 py-1.5 rounded-lg transition-all disabled:opacity-50">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                      strokeLinecap="round" strokeLinejoin="round" className={isSyncing ? 'animate-spin' : ''}>
                      <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                    </svg>
                    {isSyncing ? 'Läuft…' : 'Jetzt synchronisieren'}
                  </button>
                </div>
                {isFacebook && (
                  <div className="flex items-center gap-2.5 pt-2 border-t border-gray-100">
                    <button onClick={() => setFacebookPreviewEnabled(!facebookPreviewEnabled)}
                      className={`relative w-9 h-5 rounded-full transition-colors ${facebookPreviewEnabled ? 'bg-blue-400' : 'bg-gray-200'}`}>
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${facebookPreviewEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                    <span className="text-xs text-gray-500">Preview</span>
                    {facebookPreviewEnabled && (
                      <button onClick={() => handleSync(source.id, true)} disabled={previewLoading}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50">
                        {previewLoading ? (
                          <>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin">
                              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                            </svg>
                            Lädt…
                          </>
                        ) : (
                          <>👁 Preview laden</>
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Sync-Protokoll */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-[#1A1A1A]">Sync-Protokoll</h2>
            <p className="text-xs text-gray-400 mt-0.5">Jeder Eintrag zeigt Details zu Importen, Duplikaten und Fehlern</p>
          </div>
          <button onClick={loadSyncLog} className="text-xs text-gray-400 hover:text-[#1A1A1A] flex items-center gap-1 transition-colors">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            Aktualisieren
          </button>
        </div>

        {loadingLog ? (
          <div className="text-center py-12 text-gray-400 text-sm">Protokoll wird geladen…</div>
        ) : syncLog.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">Noch keine Synchronisationen protokolliert.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  {['Datum & Uhrzeit', 'Quelle', 'Importiert', 'Duplikate', 'Fehler', 'Status', 'Meldung'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-5 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {syncLog.map(entry => (
                  <div key={entry.id}>
                    <tr
                      onClick={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}
                      className="border-b border-gray-50 hover:bg-gray-50/40 transition-colors cursor-pointer">
                      <td className="px-5 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {new Date(entry.created_at).toLocaleDateString('de-DE')},{' '}
                        {new Date(entry.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
                      </td>
                      <td className="px-5 py-3 font-medium text-[#1A1A1A]">{entry.source}</td>
                      <td className="px-5 py-3 font-bold text-[#1A1A1A]">{entry.count}</td>
                      <td className="px-5 py-3">
                        {entry.duplicates_skipped > 0 ? (
                          <span className="text-xs font-medium text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded-full">
                            {entry.duplicates_skipped}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {entry.error_details && entry.error_details.length > 0 ? (
                          <span className="text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
                            {entry.error_details.length}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                          entry.status === 'success' ? 'bg-emerald-50 text-emerald-700' :
                          entry.status === 'warning' ? 'bg-yellow-50 text-yellow-700' :
                          'bg-red-50 text-red-700'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            entry.status === 'success' ? 'bg-emerald-500' :
                            entry.status === 'warning' ? 'bg-yellow-400' : 'bg-red-500'}`} />
                          {entry.status === 'success' ? '✓' : entry.status === 'warning' ? '⚠' : '✕'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-500 text-xs">{entry.message}</td>
                    </tr>
                    {/* Expandable Details */}
                    {expandedEntry === entry.id && (
                      <tr className="bg-gray-50/60 border-b border-gray-100">
                        <td colSpan={7} className="px-5 py-4">
                          <div className="space-y-3">
                            {/* Duplicate Details */}
                            {entry.duplicate_details && entry.duplicate_details.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-gray-600 mb-2">📋 Duplikate ({entry.duplicate_details.length})</p>
                                <div className="space-y-1 pl-4">
                                  {entry.duplicate_details.map((dup, i) => (
                                    <p key={i} className="text-xs text-gray-600">
                                      {dup.action === 'linked' ? '⟳' : '⊘'} {dup.email || dup.facebook_id} — {dup.reason}
                                    </p>
                                  ))}
                                </div>
                              </div>
                            )}
                            {/* Error Details */}
                            {entry.error_details && entry.error_details.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-red-600 mb-2">❌ Fehler ({entry.error_details.length})</p>
                                <div className="space-y-1 pl-4">
                                  {entry.error_details.map((err, i) => (
                                    <p key={i} className="text-xs text-red-600">
                                      {err.email || err.lead_id}: {err.error_message}
                                    </p>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </div>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
