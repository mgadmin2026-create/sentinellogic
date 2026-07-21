'use client'

import { useState } from 'react'

interface PlacetelCallButtonProps {
  contactId: string
  phoneMobile?: string
  phoneOffice?: string
  disabled?: boolean
  /** 'primary' = großer gelber Kopfzeilen-Button */
  variant?: 'default' | 'primary'
  /** Eigenes Button-Label, z.B. die Telefonnummer */
  label?: string
  menuAlign?: 'left' | 'right'
}
interface PhoneOption {
  field: 'phone_mobile' | 'phone_office'
  label: string
  number: string
}

export function PlacetelCallButton({
  contactId,
  phoneMobile,
  phoneOffice,
  disabled = false,
  variant = 'default',
  label,
  menuAlign = 'left',
}: PlacetelCallButtonProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [loadingField, setLoadingField] = useState<PhoneOption['field'] | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const phoneOptions: PhoneOption[] = [
    ...(phoneMobile ? [{ field: 'phone_mobile' as const, label: 'Mobil', number: phoneMobile }] : []),
    ...(phoneOffice ? [{ field: 'phone_office' as const, label: 'Büro', number: phoneOffice }] : []),
  ]

  if (phoneOptions.length === 0) return null

  async function initiateCall(option: PhoneOption) {
    try {
      setMenuOpen(false)
      setMessage(null)
      setLoadingField(option.field)

      const response = await fetch('/api/calls/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId, phoneField: option.field }),
      })
      const result = await response.json().catch(() => null) as { success?: boolean; error?: string } | null

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Placetel-Anruf konnte nicht gestartet werden')
      }

      setMessage({ type: 'success', text: 'Placetel verbindet den Anruf.' })
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Placetel-Anruf konnte nicht gestartet werden',
      })
    } finally {
      setLoadingField(null)
    }
  }

  return (
    <div className="relative flex items-center gap-2">
      <button
        type="button"
        data-testid="placetel-call-button"
        onClick={() => phoneOptions.length === 1 ? initiateCall(phoneOptions[0]) : setMenuOpen((open) => !open)}
        disabled={disabled || loadingField !== null}
        className={
          variant === 'primary'
            ? 'inline-flex items-center gap-1.5 rounded-lg bg-yellow-400 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-gray-900 transition-colors hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap'
            : 'inline-flex items-center gap-1.5 rounded-md bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50'
        }
        title="Anruf über Placetel starten"
      >
        {loadingField ? '⏳ Verbindet…' : label ?? '☎️ Placetel'}
      </button>

      {message && (
        <span
          className={`max-w-64 text-xs ${message.type === 'success' ? 'text-emerald-700' : 'text-red-700'}`}
          role="status"
        >
          {message.text}
        </span>
      )}

      {menuOpen && (
        <div className={`absolute ${menuAlign === 'right' ? 'right-0' : 'left-0'} top-full z-50 mt-1 w-56 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg`}>
          {phoneOptions.map((option) => (
            <button
              type="button"
              key={option.field}
              onClick={() => initiateCall(option)}
              className="block w-full border-b border-gray-100 px-3 py-2 text-left text-xs text-gray-700 last:border-b-0 hover:bg-gray-50"
            >
              <span className="block font-semibold">{option.label}</span>
              <span className="block truncate text-gray-500">{option.number}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
