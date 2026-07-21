'use client'
// Einzelnes Kontakt-Datenfeld (Anzeige + Edit-Modus) — aus ContactOverview
// extrahiert, damit Kacheln und Drawer dieselbe Feld-Komponente nutzen.
// data-testid="contact-field-{field}" wird von den Playwright-Tests verwendet.
import { memo } from 'react'

export interface FieldProps {
  label: string
  field: string
  type?: string
  options?: string[] | { value: string; label: string }[]
  value: any
  onChange: (field: string, value: any) => void
  isEditing: boolean
}

function normalizeOptions(options?: FieldProps['options']): { value: string; label: string }[] {
  if (!options) return []
  return options.map((opt) => (typeof opt === 'string' ? { value: opt, label: opt } : opt))
}

export const Field = memo(({ label, field, type = 'text', options, value, onChange, isEditing }: FieldProps) => {
  const normalizedOptions = normalizeOptions(options)

  if (!isEditing) {
    const displayValue = type === 'select'
      ? normalizedOptions.find((opt) => opt.value === value)?.label || value
      : value
    return (
      <div data-testid={`contact-field-${field}`}>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-sm text-gray-900 mt-1">{displayValue || '—'}</p>
      </div>
    )
  }

  if (type === 'select') {
    return (
      <div data-testid={`contact-field-${field}`}>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <select
          value={value || ''}
          onChange={(e) => onChange(field, e.target.value)}
          className="w-full px-2 py-1 mt-1 text-sm border-2 border-yellow-300 rounded bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-yellow-400"
        >
          <option value="">—</option>
          {normalizedOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      </div>
    )
  }

  return (
    <div data-testid={`contact-field-${field}`}>
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <input
        type={type}
        value={value || ''}
        onChange={(e) => onChange(field, type === 'number' ? (e.target.value ? parseInt(e.target.value) : null) : e.target.value)}
        className="w-full px-2 py-1 mt-1 text-sm border-2 border-yellow-300 rounded bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-yellow-400"
        placeholder="—"
      />
    </div>
  )
})

Field.displayName = 'Field'
