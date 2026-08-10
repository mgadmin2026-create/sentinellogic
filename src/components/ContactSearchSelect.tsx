'use client'
import { useEffect, useRef, useState } from 'react'

export interface ContactSearchSelectOption {
  id: string
  first_name: string
  last_name: string
  email?: string | null
}

interface Props {
  kontakte: ContactSearchSelectOption[]
  value?: string
  onChange: (id: string | undefined, kontakt?: ContactSearchSelectOption) => void
  placeholder?: string
  clearLabel?: string
  testId?: string
}

// Ersetzt ein natives <select> für die Kontaktzuordnung: bei mittlerweile
// hunderten Kontakten ist eine reine Dropdown-Liste nicht mehr bedienbar,
// daher Freitextsuche über Vor-/Nachname mit Klick-Auswahl.
export function ContactSearchSelect({
  kontakte,
  value,
  onChange,
  placeholder = 'Kontakt suchen…',
  clearLabel = 'Kein Kontakt',
  testId,
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = kontakte.find((k) => k.id === value)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filtered = query.trim()
    ? kontakte.filter((k) => `${k.first_name} ${k.last_name}`.toLowerCase().includes(query.trim().toLowerCase()))
    : kontakte

  function selectContact(k?: ContactSearchSelectOption) {
    onChange(k?.id, k)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={containerRef} className="relative" data-testid={testId}>
      <input
        type="text"
        value={open ? query : selected ? `${selected.first_name} ${selected.last_name}` : ''}
        onChange={(e) => {
          setQuery(e.target.value)
          if (!open) setOpen(true)
        }}
        onFocus={() => {
          setOpen(true)
          setQuery('')
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setOpen(false)
            setQuery('')
          }
        }}
        placeholder={selected ? undefined : placeholder}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 text-sm"
      />
      {open && (
        <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
          <button
            type="button"
            onClick={() => selectContact(undefined)}
            className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
          >
            {clearLabel}
          </button>
          {filtered.length === 0 && <p className="px-3 py-2 text-sm text-gray-400">Keine Treffer</p>}
          {filtered.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => selectContact(k)}
              className="w-full text-left px-3 py-2 text-sm text-gray-900 hover:bg-yellow-50"
            >
              {k.first_name} {k.last_name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
