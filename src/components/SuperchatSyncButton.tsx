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

  async function linkExisting() {
    setLinking(true)
    setMessage(null)

    try {
      const response = await fetch(`/api/kontakte/${contactId}/superchat/link-existing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const body = await response.json().catch(() => null)
      if (!response.ok || !body?.success) {
        throw new Error(body?.error || 'Bestehender SuperChat-Kontakt konnte nicht verknüpft werden')
      }

      const matchedBy = Array.isArray(body.data?.matchedBy)
        ? body.data.matchedBy.map((value: string) => value === 'phone' ? 'Telefonnummer' : 'E-Mail-Adresse').join(' und ')
        : 'Kontaktweg'
      setMessage({ type: 'success', text: `Bestehender SuperChat-Kontakt wurde über ${matchedBy} verknüpft.` })
      await onSynchronized()
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Bestehender SuperChat-Kontakt konnte nicht verknüpft werden',
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
              onClick={linkExisting}
              disabled={syncing || linking || disabled}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {linking ? 'Suche…' : 'Bestehenden verbinden'}
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
