'use client'

import { useState } from 'react'

interface SuperchatSyncButtonProps {
  contactId: string
  superchatId?: string | null
  lastSync?: string | null
  syncError?: string | null
  disabled?: boolean
  onSynchronized: () => Promise<void> | void
}

export function SuperchatSyncButton({
  contactId,
  superchatId,
  lastSync,
  syncError,
  disabled = false,
  onSynchronized,
}: SuperchatSyncButtonProps) {
  const [syncing, setSyncing] = useState(false)
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

  const statusText = lastSync
    ? `Zuletzt übertragen: ${new Date(lastSync).toLocaleString('de-DE')}`
    : superchatId
      ? 'Mit SuperChat verknüpft'
      : 'Noch nicht an SuperChat übertragen'

  return (
    <div className="space-y-2" data-testid="superchat-sync">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-700">
            SuperChat {superchatId ? '· verknüpft' : ''}
          </p>
          <p className="text-[11px] text-gray-400">{statusText}</p>
        </div>
        <button
          type="button"
          onClick={synchronize}
          disabled={syncing || disabled}
          className="shrink-0 rounded-lg bg-yellow-400 px-3 py-1.5 text-xs font-bold text-gray-900 transition-colors hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {syncing ? 'Übertrage…' : superchatId ? 'Aktualisieren' : 'Übertragen'}
        </button>
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
    </div>
  )
}
