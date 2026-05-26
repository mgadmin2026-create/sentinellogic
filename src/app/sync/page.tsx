'use client'
// Synchronisation — Quellen-Kacheln + Auto-Sync Toggle + Sync-Log
import { useState } from 'react'
import { MOCK_SYNC_LOG } from '@/data/mock'

type SyncStatus = 'connected' | 'warning' | 'inactive'

interface SyncSource {
  id: string
  name: string
  description: string
  status: SyncStatus
  count: string
  lastSync: string
  autoInterval: number // Minuten, 0 = manuell
}

const INITIAL_SOURCES: SyncSource[] = [
  {
    id: 'facebook',
    name: 'Facebook Lead Ads',
    description: 'Leads direkt aus Facebook-Kampagnen',
    status: 'connected',
    count: '47 Leads synchronisiert',
    lastSync: 'Heute, 08:00 Uhr',
    autoInterval: 15,
  },
  {
    id: 'calendly',
    name: 'Calendly',
    description: 'Terminbuchungen automatisch als Leads',
    status: 'connected',
    count: '12 Termine synchronisiert',
    lastSync: 'Heute, 07:30 Uhr',
    autoInterval: 30,
  },
  {
    id: 'email',
    name: 'E-Mail (IMAP)',
    description: 'Eingehende Anfragen als Leads erkennen',
    status: 'warning',
    count: '3 neue Leads erkannt',
    lastSync: 'Gestern, 16:00 Uhr',
    autoInterval: 60,
  },
  {
    id: 'csv',
    name: 'CSV-Import',
    description: 'Manuelle Datei-Importe',
    status: 'inactive',
    count: 'Manuell',
    lastSync: 'Vor 4 Tagen',
    autoInterval: 0,
  },
]

const STATUS_CONFIG: Record<SyncStatus, { label: string; dot: string; badge: string }> = {
  connected: { label: 'Verbunden', dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700' },
  warning: { label: 'Warnung', dot: 'bg-yellow-400', badge: 'bg-yellow-50 text-yellow-700' },
  inactive: { label: 'Manuell', dot: 'bg-gray-300', badge: 'bg-gray-100 text-gray-500' },
}

export default function SyncPage() {
  const [sources, setSources] = useState<SyncSource[]>(INITIAL_SOURCES)
  const [syncing, setSyncing] = useState<string | null>(null)

  function handleSync(id: string) {
    setSyncing(id)
    setTimeout(() => {
      setSyncing(null)
      setSources((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, lastSync: 'Gerade eben', count: s.count } : s
        )
      )
    }, 1800)
  }

  function toggleAuto(id: string) {
    setSources((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, autoInterval: s.autoInterval > 0 ? 0 : (s.id === 'facebook' ? 15 : s.id === 'calendly' ? 30 : 60) }
          : s
      )
    )
  }

  function setInterval(id: string, minutes: number) {
    setSources((prev) =>
      prev.map((s) => (s.id === id ? { ...s, autoInterval: minutes } : s))
    )
  }

  const syncLogEntries = MOCK_SYNC_LOG

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Synchronisation</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Letzte Synchronisation: <span className="text-[#1A1A1A] font-medium">vor 2 Stunden</span>
          </p>
        </div>
        <button
          onClick={() => sources.forEach((s) => s.status !== 'inactive' && handleSync(s.id))}
          className="flex items-center gap-2 bg-[#1A1A1A] hover:bg-[#333] text-white font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          Alle synchronisieren
        </button>
      </div>

      {/* Quellen-Kacheln */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {sources.map((source) => {
          const cfg = STATUS_CONFIG[source.status]
          const isSyncing = syncing === source.id
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

              <div className="flex items-center justify-between">
                {/* Auto-Sync Toggle */}
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => toggleAuto(source.id)}
                    className={`relative w-9 h-5 rounded-full transition-colors ${
                      source.autoInterval > 0 ? 'bg-[#FFC300]' : 'bg-gray-200'
                    }`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      source.autoInterval > 0 ? 'translate-x-4' : 'translate-x-0.5'
                    }`} />
                  </button>
                  <span className="text-xs text-gray-500">Auto</span>
                  {source.autoInterval > 0 && (
                    <select
                      value={source.autoInterval}
                      onChange={(e) => setInterval(source.id, parseInt(e.target.value))}
                      className="text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-[#FFC300]/40"
                    >
                      <option value={15}>alle 15 Min</option>
                      <option value={30}>alle 30 Min</option>
                      <option value={60}>alle 60 Min</option>
                    </select>
                  )}
                </div>

                {/* Sync Button */}
                <button
                  onClick={() => handleSync(source.id)}
                  disabled={isSyncing}
                  className="flex items-center gap-1.5 text-xs font-semibold border border-gray-200 hover:border-[#FFC300] hover:bg-[#FFC300]/5 text-[#1A1A1A] px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                >
                  <svg
                    width="12" height="12"
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    strokeLinecap="round" strokeLinejoin="round"
                    className={isSyncing ? 'animate-spin' : ''}
                  >
                    <polyline points="23 4 23 10 17 10" />
                    <polyline points="1 20 1 14 7 14" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                  </svg>
                  {isSyncing ? 'Läuft…' : 'Jetzt synchronisieren'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Sync-Log Tabelle */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-[#1A1A1A]">Sync-Protokoll</h2>
          <p className="text-xs text-gray-400 mt-0.5">Letzte 10 Synchronisationsereignisse</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                {['Datum & Uhrzeit', 'Quelle', 'Leads', 'Status', 'Meldung'].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-5 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {syncLogEntries.map((entry) => (
                <tr key={entry.id} className="border-b border-gray-50 hover:bg-gray-50/40 transition-colors">
                  <td className="px-5 py-3 text-gray-500 text-xs">
                    {new Date(entry.date).toLocaleDateString('de-DE')},{' '}
                    {new Date(entry.date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-5 py-3 font-medium text-[#1A1A1A]">{entry.source}</td>
                  <td className="px-5 py-3 text-[#1A1A1A] font-semibold">{entry.count}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                      entry.status === 'success' ? 'bg-emerald-50 text-emerald-700' :
                      entry.status === 'warning' ? 'bg-yellow-50 text-yellow-700' :
                      'bg-red-50 text-red-700'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        entry.status === 'success' ? 'bg-emerald-500' :
                        entry.status === 'warning' ? 'bg-yellow-400' : 'bg-red-500'
                      }`} />
                      {entry.status === 'success' ? 'Erfolgreich' : entry.status === 'warning' ? 'Warnung' : 'Fehler'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500">{entry.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
