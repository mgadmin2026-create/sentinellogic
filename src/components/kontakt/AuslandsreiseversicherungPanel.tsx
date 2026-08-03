'use client'
// Kachel "Auslandsreiseversicherung" — zeigt/editiert die zwei
// Custom-Fragen aus dem KinderProfis-Facebook-Formular (Formular-ID
// 3169048349946307). Nur sichtbar bei sparte === 'Auslandsreiseversicherung'.
// Speichert wie ErstgespraechPanel per Klick, kein Feld-für-Feld-Autosave.
import { useState } from 'react'
import { Field } from '@/components/kontakt/Field'

interface AuslandsreiseversicherungPanelProps {
  kontakt: Record<string, any>
  onSave: (changes: Record<string, unknown>) => Promise<void>
}

const ANZAHL_PERSONEN_OPTIONEN = [
  { value: '2_personen', label: '2 Personen' },
  { value: '3_personen', label: '3 Personen' },
  { value: 'oder_mehr', label: 'oder mehr' },
]

const REISEZEITPUNKT_OPTIONEN = [
  { value: 'innerhalb_der_nächsten_4_wochen', label: 'Innerhalb der nächsten 4 Wochen' },
  { value: 'in_den_nächsten_3_monaten', label: 'In den nächsten 3 Monaten' },
  { value: 'später', label: 'Später' },
]

export function AuslandsreiseversicherungPanel({ kontakt, onSave }: AuslandsreiseversicherungPanelProps) {
  const [edits, setEdits] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)
  const [gespeichert, setGespeichert] = useState(false)

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

  const dirty = Object.keys(edits).length > 0

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Anzahl Personen"
          field="anzahl_personen"
          type="select"
          options={ANZAHL_PERSONEN_OPTIONEN}
          value={getValue('anzahl_personen')}
          onChange={handleChange}
          isEditing
        />
        <Field
          label="Reisezeitpunkt"
          field="reisezeitpunkt"
          type="select"
          options={REISEZEITPUNKT_OPTIONEN}
          value={getValue('reisezeitpunkt')}
          onChange={handleChange}
          isEditing
        />
      </div>
      <div className="flex items-center justify-end gap-2">
        {gespeichert && <span className="text-xs text-emerald-600">✓ Gespeichert</span>}
        {dirty && !gespeichert && <span className="text-xs text-amber-600">Ungespeicherte Änderungen</span>}
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className="text-xs font-semibold px-3 py-1.5 bg-[#FFC300] hover:bg-[#e6b000] disabled:opacity-40 disabled:cursor-not-allowed text-gray-900 rounded-lg transition-colors"
        >
          {saving ? 'Speichert…' : 'Speichern'}
        </button>
      </div>
    </div>
  )
}
