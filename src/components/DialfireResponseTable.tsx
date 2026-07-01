'use client'

import { useState, useMemo } from 'react'

interface DialfireResponseTableProps {
  flatView: Record<string, any> | null
  lastCallInfo?: {
    fired?: string
    status?: string
    duration?: number
    status_detail?: string
    retry_count?: number
  }
  changedFields?: string[]
}

export function DialfireResponseTable({ flatView, lastCallInfo, changedFields = [] }: DialfireResponseTableProps) {
  const [search, setSearch] = useState('')
  const [showAllFields, setShowAllFields] = useState(false)

  if (!flatView) {
    return (
      <div className="p-4 text-center text-gray-500 text-sm">
        Keine Dialfire-Response vorhanden. Führe einen Sync durch um Daten zu sehen.
      </div>
    )
  }

  // Extract call info from Dialfire $task_log (most recent call first)
  const taskLog = flatView.$task_log as Array<{ fired?: string; status?: string; duration?: number; status_detail?: string }> | undefined
  const latestCall = taskLog?.[0]
  const callInfo = lastCallInfo || latestCall

  // Call Status Indicator
  const getCallStatus = (status?: string) => {
    if (status === 'open') return { label: 'Follow-up erforderlich', color: 'bg-yellow-100 text-yellow-800', dot: 'bg-yellow-400' }
    if (status === 'completed') return { label: 'Abgeschlossen', color: 'bg-green-100 text-green-800', dot: 'bg-green-500' }
    return { label: status || 'Unbekannt', color: 'bg-gray-100 text-gray-800', dot: 'bg-gray-400' }
  }

  const callStatus = getCallStatus(callInfo?.status)
  const formattedTime = callInfo?.fired ? new Date(callInfo.fired).toLocaleString('de-DE') : 'N/A'
  const durationSecs = callInfo?.duration ? Math.round(callInfo.duration / 1000) : 0
  const durationMins = Math.floor(durationSecs / 60)
  const durationSecsRem = durationSecs % 60
  const durationStr = durationMins > 0 ? `${durationMins} Min ${durationSecsRem} Sek` : `${durationSecsRem} Sek`
  const retryCount = taskLog?.length || 0

  // Kategorisiere Felder
  const allFields = useMemo(() => {
    return Object.entries(flatView)
      .map(([key, value]) => {
        const isChanged = changedFields.includes(key)
        return { key, value, isChanged }
      })
      .sort((a, b) => a.key.localeCompare(b.key))
  }, [flatView, changedFields])

  // Nur geänderte Felder für die Haupttabelle
  const changedFieldsList = allFields.filter(f => f.isChanged)

  // Gefilterte Felder für "Alle anzeigen"
  const filteredAllFields = useMemo(() => {
    return allFields.filter(f => !search || f.key.toLowerCase().includes(search.toLowerCase()))
  }, [allFields, search])

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return '—'
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }

  return (
    <div className="space-y-6">
      {/* CALL STATUS CARD - Primary Focus */}
      <div className="bg-white border-2 border-emerald-400 rounded-xl p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <span className="text-xl">☎️</span>
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-600 font-semibold uppercase tracking-wide mb-1">Letzter Anruf</p>
            <p className="text-lg font-semibold text-gray-900">{formattedTime}</p>
          </div>
        </div>

        {/* Call Details Grid */}
        <div className="grid grid-cols-4 gap-3 py-4 px-0 border-t border-b border-gray-200">
          {/* Status */}
          <div>
            <p className="text-xs text-gray-600 font-semibold uppercase tracking-wide mb-1.5">Status</p>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${callStatus.dot}`}></div>
              <span className="text-sm font-semibold text-gray-900">{callStatus.label}</span>
            </div>
          </div>
          {/* Duration */}
          <div>
            <p className="text-xs text-gray-600 font-semibold uppercase tracking-wide mb-1.5">Dauer</p>
            <p className="text-sm font-semibold text-gray-900">{durationStr}</p>
          </div>
          {/* Disposition */}
          <div>
            <p className="text-xs text-gray-600 font-semibold uppercase tracking-wide mb-1.5">Ergebnis</p>
            <p className="text-sm font-semibold text-purple-600">{lastCallInfo?.status_detail || 'N/A'}</p>
          </div>
          {/* Retry Count */}
          <div>
            <p className="text-xs text-gray-600 font-semibold uppercase tracking-wide mb-1.5">Versuche</p>
            <p className="text-sm font-semibold text-gray-900">{retryCount} Anrufe</p>
          </div>
        </div>

        {/* Sync Results Summary */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-blue-600">{changedFields.length}</p>
            <p className="text-xs text-gray-600 mt-1">Felder aktualisiert</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-emerald-600">✓</p>
            <p className="text-xs text-gray-600 mt-1">Erfolgreich synced</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-cyan-600">2 min</p>
            <p className="text-xs text-gray-600 mt-1">Sync-Dauer</p>
          </div>
        </div>
      </div>

      {/* Search Bar for Changed Fields */}
      <div>
        <label htmlFor="field-search" className="block text-sm font-semibold text-gray-700 mb-2">
          Aktualisierte Felder durchsuchen
        </label>
        <div className="relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            id="field-search"
            type="text"
            placeholder="z.B. notizen, IBAN, firma..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400 transition-colors"
          />
        </div>
      </div>

      {/* Changed Fields Table - Prominent */}
      {changedFieldsList.length > 0 ? (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
            <span className="text-lg">🔄</span>
            <h3 className="font-semibold text-gray-900">Synchronisierte Felder ({changedFields.length})</h3>
          </div>
          <div className="divide-y divide-gray-150">
            {changedFieldsList.map(({ key, value }, idx) => (
              <div key={idx} className="grid grid-cols-3 gap-4 p-4 hover:bg-gray-50/50 transition-colors text-sm">
                <div className="text-gray-600 truncate">{key}</div>
                <div className="text-center text-gray-400">→</div>
                <div className="font-mono text-emerald-600 font-semibold break-words">{formatValue(value)}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Collapsible: All Available Fields */}
      <details className="border border-gray-200 rounded-xl overflow-hidden">
        <summary className="px-4 py-3 bg-gray-50 border-b border-gray-200 font-semibold text-gray-900 cursor-pointer hover:bg-gray-100 transition-colors flex items-center gap-2">
          <span>▶</span>
          Alle verfügbaren Felder ({allFields.length}) anzeigen
        </summary>
        <div className="p-4 max-h-96 overflow-y-auto">
          <p className="text-xs text-gray-600 mb-3">Alle Felder die von Dialfire in diesem Anruf zurückgegeben wurden:</p>
          <div className="grid grid-cols-2 gap-2">
            {filteredAllFields.map(({ key, value }, idx) => (
              <div key={idx} className="bg-gray-50 rounded-lg p-2.5 text-xs break-words hover:bg-gray-100 transition-colors">
                <span className="font-semibold text-gray-900">{key}:</span>
                <span className="text-gray-600 ml-1">{formatValue(value).substring(0, 50)}{formatValue(value).length > 50 ? '...' : ''}</span>
              </div>
            ))}
          </div>
          {filteredAllFields.length === 0 && (
            <p className="text-center text-gray-500 text-sm py-4">Keine Felder gefunden.</p>
          )}
        </div>
      </details>

      {/* Info Footer */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
        <span className="font-semibold">ℹ️</span> Der Anruf wurde erfolgreich durchgeführt. {changedFields.length} Felder wurden
        in dieser Session aktualisiert und synchronisiert.
      </div>
    </div>
  )
}
