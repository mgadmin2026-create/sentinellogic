'use client'
// Kachel "Erstgespräch" — sparten-spezifischer Leitfaden fürs erste
// Telefonat. Fragen sind auf bestehende contacts-Felder gemappt; der
// Mitarbeiter trägt die Antworten während des Anrufs direkt hier ein.
// Sammelt Änderungen lokal (wie ContactOverview) und speichert per Klick in
// einem Rutsch — kein Feld-für-Feld-Autosave, damit während des Telefonats
// nicht bei jedem Tastendruck ein Request rausgeht.
import { useState } from 'react'
import { Field } from '@/components/kontakt/Field'
import { ERSTGESPRAECH_LEITFAEDEN } from '@/data/erstgespraech-leitfaden'

interface ErstgespraechPanelProps {
  kontakt: Record<string, any>
  onSave: (changes: Record<string, unknown>) => Promise<void>
  onFolgeterminClick: () => void
}

export function ErstgespraechPanel({ kontakt, onSave, onFolgeterminClick }: ErstgespraechPanelProps) {
  const [edits, setEdits] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)
  const [gespeichert, setGespeichert] = useState(false)

  const sparte = kontakt.sparte as string | undefined
  const leitfaden = sparte ? ERSTGESPRAECH_LEITFAEDEN[sparte] : undefined

  function getValue(feld: string) {
    return edits[feld] !== undefined ? edits[feld] : kontakt[feld]
  }

  function handleChange(feld: string, value: any) {
    setEdits((prev) => ({ ...prev, [feld]: value }))
    setGespeichert(false)
  }

  async function handleSave() {
    if (Object.keys(edits).length === 0) return
    setSaving(true)
    try {
      await onSave(edits)
      setEdits({})
      setGespeichert(true)
      setTimeout(() => setGespeichert(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  if (!sparte) {
    return (
      <p className="text-sm text-gray-400">
        Für diesen Kontakt ist noch keine Sparte hinterlegt — der Leitfaden richtet sich nach der Sparte.
      </p>
    )
  }

  if (!leitfaden) {
    return (
      <p className="text-sm text-gray-400">
        Für Sparte „{sparte}" ist noch kein Leitfaden hinterlegt.
      </p>
    )
  }

  const dirty = Object.keys(edits).length > 0

  return (
    <div className="space-y-4">
      {leitfaden.fragen.map((frage, i) => (
        <div key={frage.id} className={i > 0 ? 'border-t border-gray-100 pt-3' : ''}>
          <p className="text-xs text-gray-500 italic mb-2">„{frage.frage}"</p>
          <div className="grid grid-cols-2 gap-3">
            {frage.felder.map((f) =>
              frage.nurAnzeige ? (
                <div key={f.feld}>
                  <p className="text-xs text-gray-500 font-medium">{f.label}</p>
                  <p className="text-sm text-gray-900 mt-1">{getValue(f.feld) || '—'}</p>
                </div>
              ) : f.typ === 'checkbox' ? (
                <label key={f.feld} className="flex items-center gap-2 mt-4">
                  <input
                    type="checkbox"
                    checked={!!getValue(f.feld)}
                    onChange={(e) => handleChange(f.feld, e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-900">{f.label}</span>
                </label>
              ) : (
                <Field
                  key={f.feld}
                  label={f.label}
                  field={f.feld}
                  type={f.typ || 'text'}
                  value={getValue(f.feld)}
                  onChange={handleChange}
                  isEditing
                />
              )
            )}
          </div>
        </div>
      ))}

      <div className="border-t border-gray-100 pt-3">
        <p className="text-xs text-gray-500 italic mb-2">„{leitfaden.abschluss}"</p>
        <button
          onClick={onFolgeterminClick}
          className="text-xs font-semibold px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
        >
          + Aufgabe: Folgetermin anlegen
        </button>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        {gespeichert && <span className="text-xs text-emerald-600">✓ Gespeichert</span>}
        {dirty && !gespeichert && <span className="text-xs text-amber-600">Ungespeicherte Änderungen</span>}
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className="text-xs font-semibold px-3 py-1.5 bg-[#FFC300] hover:bg-[#e6b000] disabled:opacity-40 disabled:cursor-not-allowed text-gray-900 rounded-lg transition-colors"
        >
          {saving ? 'Speichert…' : 'Antworten speichern'}
        </button>
      </div>
    </div>
  )
}
