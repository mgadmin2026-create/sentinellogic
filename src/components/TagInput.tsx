'use client'
// Freitext-Tag-Eingabe mit Autocomplete gegen bestehende Tags (Enter zum Hinzufügen)
import { useEffect, useRef, useState } from 'react'

export interface Tag {
  id: string
  name: string
}

interface TagInputProps {
  value: Tag[]
  onChange: (tags: Tag[]) => void
  placeholder?: string
}

export function TagInput({ value, onChange, placeholder = 'Tag hinzufügen…' }: TagInputProps) {
  const [text, setText] = useState('')
  const [suggestions, setSuggestions] = useState<Tag[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!text.trim()) {
      setSuggestions([])
      return
    }
    const timeout = setTimeout(() => {
      fetch(`/api/kontakt-tags?search=${encodeURIComponent(text.trim())}`)
        .then((r) => r.json())
        .then((res) => {
          if (res.success) {
            setSuggestions(res.data.filter((t: Tag) => !value.some((v) => v.id === t.id)))
          }
        })
        .catch(() => {})
    }, 200)
    return () => clearTimeout(timeout)
  }, [text, value])

  async function addTag(name: string) {
    const trimmed = name.trim()
    if (!trimmed) return
    if (value.some((t) => t.name.toLowerCase() === trimmed.toLowerCase())) {
      setText('')
      setShowSuggestions(false)
      return
    }
    try {
      const res = await fetch('/api/kontakt-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      const data = await res.json()
      if (data.success) {
        onChange([...value, data.data])
      }
    } catch {
      // Netzwerkfehler ignorieren, Tag bleibt einfach nicht gesetzt
    }
    setText('')
    setSuggestions([])
    setShowSuggestions(false)
  }

  function removeTag(id: string) {
    onChange(value.filter((t) => t.id !== id))
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex flex-wrap items-center gap-1.5 px-2 py-1.5 border border-gray-200 rounded-lg bg-white focus-within:ring-2 focus-within:ring-yellow-400/40">
        {value.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-800 rounded-full px-2.5 py-1 text-xs font-medium"
          >
            {tag.name}
            <button
              type="button"
              onClick={() => removeTag(tag.id)}
              className="text-yellow-700 hover:text-yellow-900"
              aria-label={`Tag ${tag.name} entfernen`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={text}
          onChange={(e) => { setText(e.target.value); setShowSuggestions(true) }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addTag(text)
            } else if (e.key === 'Backspace' && !text && value.length > 0) {
              removeTag(value[value.length - 1].id)
            }
          }}
          placeholder={value.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[100px] text-sm outline-none py-0.5"
        />
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => addTag(s.name)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-yellow-50 transition-colors"
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
