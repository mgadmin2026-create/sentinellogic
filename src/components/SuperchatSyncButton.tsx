'use client'

import { useState } from 'react'
import { normalizePhoneNumber } from '@/lib/phone'

interface SuperchatSyncButtonProps {
  contactId: string
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phoneMobile?: string | null
  phoneOffice?: string | null
  superchatId?: string | null
  lastSync?: string | null
  syncError?: string | null
  disabled?: boolean
  onSynchronized: () => Promise<void> | void
}

interface SuperchatCandidate {
  id: string
  displayName: string
  matchedBy: Array<'email' | 'phone'>
  matchedHandles: Array<{ type: 'email' | 'phone'; maskedValue: string }>
}

export function SuperchatSyncButton({
  contactId,
  firstName,
  lastName,
  email,
  phoneMobile,
  phoneOffice,
  superchatId,
  lastSync,
  syncError,
  disabled = false,
  onSynchronized,
}: SuperchatSyncButtonProps) {
  const [syncing, setSyncing] = useState(false)
  const [linking, setLinking] = useState(false)
  const [candidates, setCandidates] = useState<SuperchatCandidate[]>([])
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)
  const [message, setMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  async function synchronize() {
    setSyncing(true)
    setMessage(null)

    try {
      const response = await fetch(`/api/kontakte/${contactId}/superchat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const body = await response.json().catch(() => null)
      if (!response.ok || !body?.success) {
        throw new Error(body?.error || 'SuperChat-Übertragung fehlgeschlagen')
      }

      setMessage({
        type: 'success',
        text:
          body.data.operation === 'created'
            ? 'Kontakt wurde an SuperChat übertragen.'
            : 'SuperChat-Kontakt wurde aktualisiert.',
      })
      await onSynchronized()
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'SuperChat-Übertragung fehlgeschlagen',
      })
    } finally {
      setSyncing(false)
    }
  }

  async function findExisting() {
    setLinking(true)
    setMessage(null)

    try {
      const response = await fetch(`/api/kontakte/${contactId}/superchat/link-existing`)
      const body = await response.json().catch(() => null)
      if (!response.ok || !body?.success) {
        throw new Error(body?.error || 'SuperChat-Treffer konnten nicht geladen werden')
      }

      const found = Array.isArray(body.data?.candidates) ? body.data.candidates : []
      setCandidates(found)
      setSelectedCandidateId(found.length === 1 ? found[0].id : null)
      if (found.length === 0) setMessage({ type: 'error', text: 'Kein passender SuperChat-Kontakt gefunden.' })
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'SuperChat-Treffer konnten nicht geladen werden',
      })
    } finally {
      setLinking(false)
    }
  }

  async function linkSelected() {
    if (!selectedCandidateId) return
    setLinking(true)
    setMessage(null)
    try {
      const response = await fetch(`/api/kontakte/${contactId}/superchat/link-existing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ superchatId: selectedCandidateId }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok || !body?.success) {
        throw new Error(body?.error || 'Ausgewählter SuperChat-Kontakt konnte nicht verknüpft werden')
      }
      const matchedBy = Array.isArray(body.data?.matchedBy)
        ? body.data.matchedBy.map((value: string) => value === 'phone' ? 'Telefonnummer' : 'E-Mail-Adresse').join(' und ')
        : 'Kontaktweg'
      setCandidates([])
      setSelectedCandidateId(null)
      setMessage({ type: 'success', text: `Bestehender SuperChat-Kontakt wurde über ${matchedBy} verknüpft.` })
      await onSynchronized()
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Ausgewählter SuperChat-Kontakt konnte nicht verknüpft werden',
      })
    } finally {
      setLinking(false)
    }
  }

  const statusText = lastSync
    ? `Zuletzt übertragen: ${new Date(lastSync).toLocaleString('de-DE')}`
    : superchatId
      ? 'Mit SuperChat verknüpft'
      : 'Noch nicht an SuperChat übertragen'

  function buildSuperchatUrl(): string | null {
    const mobile = normalizePhoneNumber(phoneMobile)
    const office = normalizePhoneNumber(phoneOffice)
    const normalizedEmail = email?.trim().toLowerCase()
    const params = new URLSearchParams()

    if (mobile) {
      params.set('wa', mobile.replace(/^\+/, ''))
    } else if (office) {
      params.set('sms', office.replace(/^\+/, ''))
    } else if (normalizedEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      params.set('email', normalizedEmail)
    } else {
      return null
    }

    if (firstName?.trim()) params.set('firstname', firstName.trim())
    if (lastName?.trim()) params.set('lastname', lastName.trim())
    return `https://app.superchat.de/inbox/find/?${params.toString()}`
  }

  const superchatUrl = superchatId ? buildSuperchatUrl() : null

  return (
    <div className="space-y-2" data-testid="superchat-sync">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-700">
            SuperChat {superchatId ? '· verknüpft' : ''}
          </p>
          <p className="text-[11px] text-gray-400">{statusText}</p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          {!superchatId && (
            <button
              type="button"
              onClick={findExisting}
              disabled={syncing || linking || disabled}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {linking ? 'Suche…' : 'Bestehenden suchen'}
            </button>
          )}
          <button
            type="button"
            onClick={synchronize}
            disabled={syncing || linking || disabled}
            className="rounded-lg bg-yellow-400 px-3 py-1.5 text-xs font-bold text-gray-900 transition-colors hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {syncing ? 'Übertrage…' : superchatId ? 'Aktualisieren' : 'Übertragen'}
          </button>
        </div>
      </div>

      {!superchatId && candidates.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-gray-800">SuperChat-Treffer auswählen</p>
              <p className="mt-0.5 text-[11px] text-gray-500">
                {candidates.length === 1 ? 'Ein eindeutiger Treffer wurde gefunden.' : `${candidates.length} mögliche Kontakte wurden gefunden.`}
              </p>
            </div>
            <button type="button" onClick={() => { setCandidates([]); setSelectedCandidateId(null) }} className="text-xs text-gray-400 hover:text-gray-700" aria-label="Trefferliste schließen">✕</button>
          </div>

          <div className="space-y-2">
            {candidates.map((candidate) => (
              <label
                key={candidate.id}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border bg-white p-3 transition-colors ${selectedCandidateId === candidate.id ? 'border-yellow-400 ring-2 ring-yellow-200' : 'border-gray-200 hover:border-gray-300'}`}
              >
                <input
                  type="radio"
                  name={`superchat-candidate-${contactId}`}
                  value={candidate.id}
                  checked={selectedCandidateId === candidate.id}
                  onChange={() => setSelectedCandidateId(candidate.id)}
                  className="mt-0.5 h-4 w-4 accent-yellow-500"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-gray-800">{candidate.displayName}</span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    {candidate.matchedHandles.map((handle) => (
                      <span key={`${handle.type}-${handle.maskedValue}`} className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                        {handle.type === 'email' ? 'E-Mail' : 'Telefon'}: {handle.maskedValue}
                      </span>
                    ))}
                  </span>
                  <span className="mt-1.5 block font-mono text-[10px] text-gray-400" title={candidate.id}>
                    ID: {candidate.id.length > 25 ? `${candidate.id.slice(0, 24)}…` : candidate.id}
                  </span>
                </span>
              </label>
            ))}
          </div>

          {candidates.length > 1 && (
            <p className="mt-2 text-[10px] leading-relaxed text-orange-700">
              Bitte anhand des Namens und des markierten Kontaktwegs bewusst auswählen. Ohne Auswahl wird nichts verändert.
            </p>
          )}
          <button
            type="button"
            onClick={linkSelected}
            disabled={!selectedCandidateId || linking}
            className="mt-3 w-full rounded-lg bg-yellow-400 px-3 py-2 text-xs font-bold text-gray-900 hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {linking ? 'Wird verknüpft…' : 'Ausgewählten Kontakt verbinden'}
          </button>
        </div>
      )}

      {(message || (!lastSync && syncError)) && (
        <p
          role="status"
          className={`text-xs ${
            (message?.type || 'error') === 'success' ? 'text-emerald-700' : 'text-red-700'
          }`}
        >
          {message?.text || syncError}
        </p>
      )}
      {superchatUrl && (
        <a
          href={superchatUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex text-xs font-semibold text-yellow-700 hover:text-yellow-800 hover:underline"
        >
          Nachrichtenfeld in SuperChat öffnen ↗
        </a>
      )}
    </div>
  )
}
