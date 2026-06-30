'use client'

import { useState } from 'react'

interface DialfireInfo {
  dialfire_id?: string
  dialfire_campaign_id?: string
  dialfire_task_name_field?: string
  dialfire_last_call_at?: string
  dialfire_last_call_status?: string
  dialfire_call_duration?: number
  dialfire_retry_count?: number
  dialfire_disposition?: string
  dialfire_updated_at?: string
}

interface Props {
  kontakt: any
}

interface SyncResult {
  changed_fields?: string[]
  changes?: Record<string, { old: any; new: any }>
}

export function DialfireSyncPanel({ kontakt }: Props) {
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null)

  const dialfireInfo: DialfireInfo = {
    dialfire_id: kontakt.dialfire_id,
    dialfire_campaign_id: kontakt.dialfire_campaign_id,
    dialfire_task_name_field: kontakt.dialfire_task_name_field,
    dialfire_last_call_at: kontakt.dialfire_last_call_at,
    dialfire_last_call_status: kontakt.dialfire_last_call_status,
    dialfire_call_duration: kontakt.dialfire_call_duration,
    dialfire_retry_count: kontakt.dialfire_retry_count,
    dialfire_disposition: kontakt.dialfire_disposition,
    dialfire_updated_at: kontakt.dialfire_updated_at,
  }

  // Check if any Dialfire data exists
  const hasDialfireData = Object.values(dialfireInfo).some(v => v)

  async function handleManualSync() {
    if (!dialfireInfo.dialfire_id || !dialfireInfo.dialfire_campaign_id) {
      setSyncMessage({ type: 'error', text: 'Dialfire ID oder Campaign fehlt' })
      return
    }

    setSyncing(true)
    setSyncMessage(null)
    setLastSyncResult(null)

    try {
      const res = await fetch('/api/dialfire/pull-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_id: kontakt.id,
          dialfire_id: dialfireInfo.dialfire_id,
          campaign_id: dialfireInfo.dialfire_campaign_id,
        }),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        const fieldsText = data.result.changed_fields.length > 0
          ? data.result.changed_fields.join(', ')
          : 'keine'
        setSyncMessage({
          type: 'success',
          text: `✅ Sync erfolgreich: ${data.result.changed_fields.length} Felder aktualisiert`
        })
        setLastSyncResult(data.result)
        // Reload page after 3 seconds
        setTimeout(() => window.location.reload(), 3000)
      } else {
        setSyncMessage({ type: 'error', text: `❌ Sync fehlgeschlagen: ${data.error}` })
      }
    } catch (err) {
      setSyncMessage({ type: 'error', text: `❌ Fehler: ${String(err)}` })
    } finally {
      setSyncing(false)
    }
  }

  if (!hasDialfireData) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">📞 Dialfire Integration</h2>
        <div className="text-center py-8 text-gray-400">
          <p>Dieser Kontakt ist nicht mit Dialfire verbunden.</p>
          <p className="text-sm mt-2">Verbinden Sie den Kontakt mit einer Dialfire-Kampagne in der Übersicht.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            📞 Dialfire Integration
          </h2>
          <button
            onClick={handleManualSync}
            disabled={syncing}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm rounded-lg transition-colors"
          >
            {syncing ? '🔄 Syncing…' : '🔄 Manuell Sync'}
          </button>
        </div>

        {syncMessage && (
          <div
            className={`p-4 rounded-lg text-sm font-medium ${
              syncMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {syncMessage.text}
          </div>
        )}

      {/* Letzte Sync-Details */}
      {lastSyncResult && lastSyncResult.changed_fields && lastSyncResult.changed_fields.length > 0 && (
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-4 mt-4">
          <h4 className="text-sm font-semibold text-blue-900 mb-3">📋 Geänderte Felder:</h4>
          <div className="space-y-2">
            {lastSyncResult.changed_fields.map((field) => {
              const change = lastSyncResult.changes?.[field]
              return (
                <div key={field} className="text-sm text-blue-800 bg-white rounded p-2">
                  <div className="font-medium">{field}</div>
                  <div className="text-xs text-blue-700 mt-1">
                    <span className="line-through text-red-600">{change?.old || '—'}</span>
                    {' → '}
                    <span className="text-emerald-600">{change?.new || '—'}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      </div>

      {/* Last Call Info */}
      {dialfireInfo.dialfire_last_call_at && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            ☎️ Letzter Anruf
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 font-semibold mb-1">Zeitstempel</p>
              <p className="text-sm text-gray-900">
                {new Date(dialfireInfo.dialfire_last_call_at).toLocaleString('de-DE')}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-semibold mb-1">Status</p>
              <p className={`text-sm font-medium px-2 py-1 rounded-full inline-block ${
                dialfireInfo.dialfire_last_call_status === 'completed'
                  ? 'bg-emerald-100 text-emerald-800'
                  : dialfireInfo.dialfire_last_call_status === 'no_answer'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-gray-100 text-gray-800'
              }`}>
                {dialfireInfo.dialfire_last_call_status || '—'}
              </p>
            </div>
            {dialfireInfo.dialfire_call_duration && (
              <div>
                <p className="text-xs text-gray-500 font-semibold mb-1">Dauer</p>
                <p className="text-sm text-gray-900">{Math.round(dialfireInfo.dialfire_call_duration / 60)} min</p>
              </div>
            )}
            {dialfireInfo.dialfire_disposition && (
              <div>
                <p className="text-xs text-gray-500 font-semibold mb-1">Disposition</p>
                <p className="text-sm text-gray-900">{dialfireInfo.dialfire_disposition}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Retry Info */}
      {dialfireInfo.dialfire_retry_count !== undefined && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            🔄 Retry-Versuche
          </h3>
          <div>
            <p className="text-3xl font-bold text-purple-600">{dialfireInfo.dialfire_retry_count}</p>
            <p className="text-sm text-gray-500 mt-2">Anzahl der Anrufversuche</p>
          </div>
        </div>
      )}

      {/* Campaign Info */}
      {dialfireInfo.dialfire_campaign_id && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">⭐ Dialfire Info</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Dialfire ID:</span>
              <span className="text-sm font-mono text-gray-900">{dialfireInfo.dialfire_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Campaign ID:</span>
              <span className="text-sm font-mono text-gray-900">{dialfireInfo.dialfire_campaign_id}</span>
            </div>
            {dialfireInfo.dialfire_task_name_field && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Task Name:</span>
                <span className="text-sm font-mono text-gray-900">{dialfireInfo.dialfire_task_name_field}</span>
              </div>
            )}
            {dialfireInfo.dialfire_updated_at && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Letzter Sync:</span>
                <span className="text-sm text-gray-900">
                  {new Date(dialfireInfo.dialfire_updated_at).toLocaleString('de-DE')}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sync Instructions */}
      <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
        <h3 className="text-base font-semibold text-blue-900 mb-3">ℹ️ Wie funktioniert der Sync?</h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li>✓ Klicken Sie auf "Manuell Sync" um die neuesten Dialfire-Daten zu holen</li>
          <li>✓ Alle Änderungen werden mit Audit Trail geloggt</li>
          <li>✓ Anrufinformationen werden automatisch aktualisiert</li>
          <li>✓ Alle Änderungen erscheinen in der Notizen-Historie</li>
        </ul>
      </div>
    </div>
  )
}
