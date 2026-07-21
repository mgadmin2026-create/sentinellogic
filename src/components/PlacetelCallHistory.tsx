'use client'

import { useCallback, useEffect, useState } from 'react'
import type { CallLog, PlacetelCallResult } from '@/types/placetel'

interface PlacetelCallHistoryProps {
  contactId: string
}
const STATUS_LABELS: Record<string, string> = {
  initiated: 'Gestartet',
  ringing: 'Klingelt',
  accepted: 'Angenommen',
  completed: 'Beendet',
  missed: 'Verpasst',
  blocked: 'Blockiert',
  voicemail: 'Mailbox',
  busy: 'Besetzt',
  canceled: 'Abgebrochen',
  unavailable: 'Nicht erreichbar',
  congestion: 'Netzfehler',
  failed: 'Fehlgeschlagen',
}

const RESULT_OPTIONS: Array<{ value: PlacetelCallResult; label: string }> = [
  { value: 'termin', label: 'Termin vereinbart' },
  { value: 'wiedervorlage', label: 'Wiedervorlage' },
  { value: 'kein_interesse', label: 'Kein Interesse' },
  { value: 'nicht_erreicht', label: 'Nicht erreicht' },
  { value: 'falsche_nummer', label: 'Falsche Nummer' },
  { value: 'sonstiges', label: 'Sonstiges' },
]

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—'
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes}:${String(remainder).padStart(2, '0')} min`
}

export function PlacetelCallHistory({ contactId }: PlacetelCallHistoryProps) {
  const [calls, setCalls] = useState<CallLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [result, setResult] = useState<PlacetelCallResult>('termin')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const loadCalls = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) setLoading(true)
      const response = await fetch(`/api/calls?contactId=${encodeURIComponent(contactId)}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => null) as { success?: boolean; data?: CallLog[]; error?: string } | null
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Anrufhistorie konnte nicht geladen werden')
      setCalls(payload.data || [])
      setError(null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Anrufhistorie konnte nicht geladen werden')
    } finally {
      setLoading(false)
    }
  }, [contactId])

  useEffect(() => {
    loadCalls(true)
    const interval = window.setInterval(() => loadCalls(false), 15_000)
    return () => window.clearInterval(interval)
  }, [loadCalls])

  function beginEditing(call: CallLog) {
    setEditingId(call.id)
    setResult(call.result || 'termin')
    setNotes(call.notes || '')
  }

  async function saveResult() {
    if (!editingId) return
    try {
      setSaving(true)
      const response = await fetch(`/api/calls/${editingId}/result`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result, notes }),
      })
      const payload = await response.json().catch(() => null) as { success?: boolean; error?: string } | null
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Ergebnis konnte nicht gespeichert werden')
      setEditingId(null)
      await loadCalls(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Ergebnis konnte nicht gespeichert werden')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4" data-testid="placetel-call-history">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Placetel-Anrufhistorie</h2>
          <p className="mt-1 text-sm text-gray-500">Status und Gesprächsergebnisse dieses Kontakts.</p>
        </div>
        <button
          type="button"
          onClick={() => loadCalls(true)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          Aktualisieren
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {loading ? (
        <p className="text-sm text-gray-400">Anrufe werden geladen…</p>
      ) : calls.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400">
          Noch keine Placetel-Anrufe vorhanden.
        </div>
      ) : (
        <div className="space-y-3">
          {calls.map((call) => {
            const remoteNumber = call.direction === 'incoming' ? call.from_number : call.to_number
            return (
              <div key={call.id} className="rounded-xl border border-gray-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-gray-900">
                      {call.direction === 'incoming' ? '↙ Eingehend' : '↗ Ausgehend'} · {remoteNumber || 'Nummer unbekannt'}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {new Date(call.started_at).toLocaleString('de-DE')} · Dauer {formatDuration(call.duration_seconds)}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    ['failed', 'missed', 'blocked', 'busy', 'canceled', 'unavailable', 'congestion'].includes(call.status)
                      ? 'bg-red-100 text-red-700'
                      : call.status === 'completed' || call.status === 'accepted'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {STATUS_LABELS[call.status] || call.status}
                  </span>
                </div>

                {editingId === call.id ? (
                  <div className="mt-4 grid gap-3 border-t border-gray-100 pt-4 sm:grid-cols-[220px_1fr_auto]">
                    <select
                      value={result}
                      onChange={(event) => setResult(event.target.value as PlacetelCallResult)}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    >
                      {RESULT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    <input
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      maxLength={2_000}
                      placeholder="Gesprächsnotiz (optional)"
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={saveResult}
                        disabled={saving}
                        className="rounded-lg bg-yellow-400 px-3 py-2 text-sm font-semibold text-gray-900 disabled:opacity-50"
                      >
                        {saving ? 'Speichert…' : 'Speichern'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600"
                      >
                        Abbrechen
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3">
                    <p className="text-sm text-gray-600">
                      {call.result
                        ? `${RESULT_OPTIONS.find((option) => option.value === call.result)?.label || call.result}${call.notes ? ` · ${call.notes}` : ''}`
                        : 'Gesprächsergebnis noch offen'}
                    </p>
                    <button
                      type="button"
                      onClick={() => beginEditing(call)}
                      className="text-sm font-medium text-yellow-700 hover:text-yellow-800"
                    >
                      {call.result ? 'Ergebnis bearbeiten' : 'Ergebnis erfassen'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
