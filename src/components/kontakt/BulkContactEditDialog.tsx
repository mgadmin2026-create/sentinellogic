'use client'

import { useEffect, useMemo, useState } from 'react'

type BulkField = 'status' | 'assigned_user_id' | 'kontakt_typ' | 'tags' | 'sparten' | 'archive'
type BulkMode = 'set' | 'add' | 'remove'

interface Option { id: string; name: string }

interface Props {
  contactIds: string[]
  teamMembers: Option[]
  initialField?: BulkField
  onClose: () => void
  onCompleted: () => Promise<void> | void
}

const FIELD_LABELS: Record<BulkField, string> = {
  status: 'Status',
  assigned_user_id: 'Verantwortliche Person',
  kontakt_typ: 'Kontakttyp',
  tags: 'Tags',
  sparten: 'Sparten',
  archive: 'Archivieren',
}

const STATUS_OPTIONS = [
  { id: 'new', name: 'Neu' },
  { id: 'contacted', name: 'Kontaktiert' },
  { id: 'qualified', name: 'Qualifiziert' },
  { id: 'customer', name: 'Kunde' },
  { id: 'not_interested', name: 'Nicht interessiert' },
]

export function BulkContactEditDialog({ contactIds, teamMembers, initialField = 'status', onClose, onCompleted }: Props) {
  const [field, setField] = useState<BulkField>(initialField)
  const [mode, setMode] = useState<BulkMode>('set')
  const [value, setValue] = useState('')
  const [tags, setTags] = useState<Option[]>([])
  const [sparten, setSparten] = useState<Option[]>([])
  const [archiveTasks, setArchiveTasks] = useState(false)
  const [confirmation, setConfirmation] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ requested: number; updated: number; unchanged: number; skipped: number; failed: number } | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/kontakt-tags').then((response) => response.json()),
      fetch('/api/sparten').then((response) => response.json()),
    ]).then(([tagResponse, sparteResponse]) => {
      if (tagResponse.success) setTags(tagResponse.data ?? [])
      if (sparteResponse.success) setSparten(sparteResponse.data ?? [])
    }).catch(() => {})
  }, [])

  const options = useMemo(() => {
    if (field === 'status') return STATUS_OPTIONS
    if (field === 'assigned_user_id') return teamMembers
    if (field === 'kontakt_typ') return [{ id: 'privat', name: 'Privat' }, { id: 'gewerbe', name: 'Gewerbe' }]
    if (field === 'tags') return tags
    if (field === 'sparten') return sparten
    return []
  }, [field, sparten, tags, teamMembers])

  useEffect(() => {
    const nextMode: BulkMode = field === 'tags' || field === 'sparten' ? 'add' : 'set'
    setMode(nextMode)
    const nextOptions = field === 'status'
      ? STATUS_OPTIONS
      : field === 'assigned_user_id'
        ? teamMembers
        : field === 'kontakt_typ'
          ? [{ id: 'privat' }, { id: 'gewerbe' }]
          : field === 'tags'
            ? tags
            : field === 'sparten'
              ? sparten
              : []
    setValue(nextOptions[0]?.id ?? '')
    setConfirmation(false)
    setError('')
  }, [field, sparten, tags, teamMembers])

  const selectedOption = options.find((option) => option.id === value)
  const actionText = field === 'archive'
    ? 'archiviert'
    : field === 'assigned_user_id' && mode === 'remove'
      ? 'die Verantwortlichkeit entfernt'
    : mode === 'remove'
      ? `${FIELD_LABELS[field]} „${selectedOption?.name ?? ''}“ entfernt`
      : mode === 'add'
        ? `${FIELD_LABELS[field]} „${selectedOption?.name ?? ''}“ hinzugefügt`
      : `${FIELD_LABELS[field]} auf „${selectedOption?.name ?? ''}“ gesetzt`

  async function submit() {
    if (field !== 'archive' && mode !== 'remove' && !value) {
      setError('Bitte einen Wert auswählen.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch('/api/kontakte/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactIds,
          field,
          mode,
          value: field === 'archive' || (field === 'assigned_user_id' && mode === 'remove') ? null : value,
          archiveTasks,
          requestId: crypto.randomUUID(),
        }),
      })
      const json = await response.json()
      if (!response.ok || !json.data) throw new Error(json.error || 'Sammelbearbeitung fehlgeschlagen')
      setResult(json.data)
      await onCompleted()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Sammelbearbeitung fehlgeschlagen')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(event) => event.target === event.currentTarget && !submitting && onClose()}>
      <div data-testid="kontakte-sammelbearbeitung-dialog" role="dialog" aria-modal="true" aria-labelledby="bulk-edit-title" className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
        {result ? (
          <>
            <h2 id="bulk-edit-title" className="text-xl font-bold text-gray-900">Sammelbearbeitung abgeschlossen</h2>
            <p className="mt-1 text-sm text-gray-500">Die Auswahl wurde verarbeitet.</p>
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <ResultValue label="Geändert" value={result.updated} tone="green" />
              <ResultValue label="Unverändert" value={result.unchanged} />
              <ResultValue label="Übersprungen" value={result.skipped} />
              <ResultValue label="Fehler" value={result.failed} tone={result.failed ? 'red' : 'neutral'} />
            </div>
            <button type="button" onClick={onClose} className="mt-6 w-full rounded-lg bg-yellow-400 px-4 py-2.5 text-sm font-semibold text-gray-900 hover:bg-yellow-500">Schließen</button>
          </>
        ) : (
          <>
            <h2 id="bulk-edit-title" className="text-xl font-bold text-gray-900">Mehrere Kontakte bearbeiten</h2>
            <p className="mt-1 text-sm text-gray-500">{contactIds.length} Kontakte ausgewählt</p>

            <label className="mt-5 block text-xs font-semibold text-gray-700">Feld</label>
            <select data-testid="sammelbearbeitung-feld" value={field} onChange={(event) => setField(event.target.value as BulkField)} disabled={confirmation || submitting} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30">
              {Object.entries(FIELD_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>

            {(field === 'tags' || field === 'sparten') && (
              <div className="mt-4 grid grid-cols-2 gap-2" role="group" aria-label="Änderungsart">
                {(['add', 'remove'] as const).map((item) => (
                  <button key={item} type="button" disabled={confirmation || submitting} onClick={() => setMode(item)} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${mode === item ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200 bg-white text-gray-600'}`}>
                    {item === 'add' ? 'Hinzufügen' : 'Entfernen'}
                  </button>
                ))}
              </div>
            )}

            {field === 'assigned_user_id' && (
              <label className="mt-4 flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={mode === 'remove'} disabled={confirmation || submitting} onChange={(event) => setMode(event.target.checked ? 'remove' : 'set')} className="h-4 w-4 accent-yellow-500" />
                Verantwortlichkeit entfernen
              </label>
            )}

            {field !== 'archive' && !(field === 'assigned_user_id' && mode === 'remove') && (
              <>
                <label className="mt-4 block text-xs font-semibold text-gray-700">Wert</label>
                <select data-testid="sammelbearbeitung-wert" value={value} onChange={(event) => setValue(event.target.value)} disabled={confirmation || submitting} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30">
                  <option value="">Bitte auswählen…</option>
                  {options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                </select>
              </>
            )}

            {field === 'archive' && (
              <label className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-800">
                <input type="checkbox" checked={archiveTasks} disabled={confirmation || submitting} onChange={(event) => setArchiveTasks(event.target.checked)} className="h-4 w-4 accent-red-600" />
                Zugehörige offene Aufgaben ebenfalls archivieren
              </label>
            )}

            <div className={`mt-5 rounded-lg p-3 text-sm ${field === 'archive' ? 'bg-red-50 text-red-800' : 'bg-gray-50 text-gray-700'}`}>
              <strong>{confirmation ? 'Bitte bestätigen:' : 'Vorschau:'}</strong> Bei {contactIds.length} Kontakten wird {actionText}. Unveränderte Kontakte werden übersprungen.
            </div>
            {error && <p role="alert" className="mt-3 text-sm font-medium text-red-600">{error}</p>}

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" disabled={submitting} onClick={confirmation ? () => setConfirmation(false) : onClose} className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">{confirmation ? 'Zurück' : 'Abbrechen'}</button>
              {confirmation ? (
                <button type="button" disabled={submitting} onClick={submit} className={`rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-50 ${field === 'archive' ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-yellow-400 text-gray-900 hover:bg-yellow-500'}`}>{submitting ? 'Wird angewendet…' : 'Jetzt anwenden'}</button>
              ) : (
                <button type="button" onClick={() => value || field === 'archive' || mode === 'remove' ? setConfirmation(true) : setError('Bitte einen Wert auswählen.')} className="rounded-lg bg-yellow-400 px-4 py-2.5 text-sm font-semibold text-gray-900 hover:bg-yellow-500">Änderung prüfen</button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ResultValue({ label, value, tone = 'neutral' }: { label: string; value: number; tone?: 'neutral' | 'green' | 'red' }) {
  const colors = tone === 'green' ? 'bg-green-50 text-green-700' : tone === 'red' ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-700'
  return <div className={`rounded-lg p-3 text-center ${colors}`}><div className="text-xl font-bold">{value}</div><div className="text-xs">{label}</div></div>
}
