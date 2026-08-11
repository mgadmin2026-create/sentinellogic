'use client'
// Kachel "Erstgespräch" — sparten-spezifischer Leitfaden fürs erste
// Telefonat. Fragen sind auf bestehende contacts-Felder gemappt; der
// Mitarbeiter trägt die Antworten während des Anrufs direkt hier ein.
// Sammelt Änderungen lokal (wie ContactOverview) und speichert per Klick in
// einem Rutsch — kein Feld-für-Feld-Autosave, damit während des Telefonats
// nicht bei jedem Tastendruck ein Request rausgeht.
import { useRef, useState } from 'react'
import { Field } from '@/components/kontakt/Field'

interface LeitfadenFeld {
  feld: string
  label: string
  typ?: 'text' | 'date' | 'number' | 'checkbox'
}

interface LeitfadenFrage {
  id: string
  frage: string
  felder: LeitfadenFeld[]
  nurAnzeige?: boolean
}

interface KontaktSparte {
  is_primary: boolean
  sparte: {
    id: string
    name: string
    leitfaden_titel: string | null
    leitfaden_fragen: LeitfadenFrage[]
    leitfaden_abschluss: string | null
  }
}

interface ErstgespraechPanelProps {
  kontakt: Record<string, any>
  sparten: KontaktSparte[]
  onSave: (changes: Record<string, unknown>) => Promise<void>
  onSaveNotes: (notes: string) => Promise<void>
  onFolgeterminClick: () => void
}

export function ErstgespraechPanel({ kontakt, sparten, onSave, onSaveNotes, onFolgeterminClick }: ErstgespraechPanelProps) {
  const [edits, setEdits] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)
  const [gespeichert, setGespeichert] = useState(false)
  const [includeEmptyPdfFields, setIncludeEmptyPdfFields] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)

  const [notizenDraft, setNotizenDraft] = useState(kontakt.notes || '')
  const [notizenSaving, setNotizenSaving] = useState(false)
  const notizenDirty = notizenDraft !== (kontakt.notes || '')

  const topRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const sparteMitLeitfaden = sparten.filter((z) => z.sparte.leitfaden_fragen.length > 0)
  const mehrfach = sparten.length > 1

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

  async function handleSaveNotizen() {
    setNotizenSaving(true)
    try {
      await onSaveNotes(notizenDraft)
    } finally {
      setNotizenSaving(false)
    }
  }

  async function downloadPdf() {
    setPdfLoading(true)
    try {
      if (Object.keys(edits).length > 0) await handleSave()
      if (notizenDirty) await handleSaveNotizen()
      const response = await fetch(`/api/kontakte/${kontakt.id}/erstgespraech/pdf?includeEmpty=${includeEmptyPdfFields}`)
      if (!response.ok) throw new Error('PDF konnte nicht erstellt werden')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `Erstgespraech-${kontakt.first_name}-${kontakt.last_name}.pdf`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('[Erstgespräch] PDF-Download fehlgeschlagen:', error)
    } finally {
      setPdfLoading(false)
    }
  }

  const dirty = Object.keys(edits).length > 0

  return (
    <div>
      <div ref={topRef} />

      {/* Grundlegende Kontaktinfo — direkt editierbar, Teil derselben Antworten-Speicherung */}
      <div className="grid grid-cols-2 gap-3 pb-3 mb-3 border-b border-gray-100">
        <Field label="Vorname" field="first_name" value={getValue('first_name')} onChange={handleChange} isEditing />
        <Field label="Nachname" field="last_name" value={getValue('last_name')} onChange={handleChange} isEditing />
        <Field label="E-Mail" field="email" type="email" value={getValue('email')} onChange={handleChange} isEditing />
        <Field label="Telefon" field="phone_mobile" value={getValue('phone_mobile')} onChange={handleChange} isEditing />
      </div>

      {/* Notizen — dieselbe Spalte wie im Kopfbereich (contacts.notes) */}
      <div className="pb-3 mb-3 border-b border-gray-100">
        <p className="text-xs text-gray-500 font-medium mb-1">Notizen</p>
        <textarea
          value={notizenDraft}
          onChange={(e) => setNotizenDraft(e.target.value)}
          placeholder="Notizen zum Anruf…"
          rows={3}
          className="w-full px-2 py-1.5 text-sm border-2 border-yellow-300 rounded bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-yellow-400"
        />
        {notizenDirty && (
          <button
            onClick={handleSaveNotizen}
            disabled={notizenSaving}
            className="mt-1.5 text-xs font-semibold px-3 py-1 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-gray-700 rounded-lg transition-colors"
          >
            {notizenSaving ? 'Speichert…' : 'Notiz speichern'}
          </button>
        )}
      </div>

      {sparten.length === 0 ? (
        <p className="text-sm text-gray-400">
          Für diesen Kontakt ist noch keine Sparte hinterlegt — der Leitfaden richtet sich nach der Sparte.
        </p>
      ) : sparteMitLeitfaden.length === 0 ? (
        <p className="text-sm text-gray-400">
          {sparten.length === 1
            ? `Für Sparte „${sparten[0].sparte.name}" ist noch kein Leitfaden hinterlegt.`
            : `Für die zugeordneten Sparten (${sparten.map((z) => z.sparte.name).join(', ')}) ist noch kein Leitfaden hinterlegt.`}
        </p>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
              title="Zum Ende springen"
            >
              ↓ Zum Ende
            </button>
          </div>

          {sparteMitLeitfaden.map((z, sIdx) => (
            <div key={z.sparte.id} className={sIdx > 0 ? 'border-t-2 border-gray-200 pt-4' : ''}>
              {mehrfach && (
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">{z.sparte.name}</h4>
              )}
              <div className="space-y-4">
                {z.sparte.leitfaden_fragen.map((frage, i) => (
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

                {z.sparte.leitfaden_abschluss && (
                  <p className="text-xs text-gray-500 italic pt-1">„{z.sparte.leitfaden_abschluss}"</p>
                )}
              </div>
            </div>
          ))}

          <div className="border-t border-gray-100 pt-3">
            <button
              onClick={onFolgeterminClick}
              className="text-xs font-semibold px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
            >
              + Aufgabe: Folgetermin anlegen
            </button>
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              onClick={() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
              title="Zum Anfang springen"
            >
              ↑ Zum Anfang
            </button>
            <div className="flex items-center gap-2">
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

          <div ref={bottomRef} />
        </div>
      )}

      <div className="mt-5 border-t border-gray-200 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={includeEmptyPdfFields}
              onChange={(event) => setIncludeEmptyPdfFields(event.target.checked)}
              className="rounded border-gray-300 text-yellow-500 focus:ring-yellow-400"
            />
            Leere Felder im PDF ausgeben
          </label>
          <button
            type="button"
            onClick={downloadPdf}
            disabled={pdfLoading}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {pdfLoading ? 'PDF wird erstellt…' : '⬇ Erstgespräch als PDF'}
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-gray-400">Enthält ausschließlich die im Erstgespräch angezeigten Felder.</p>
      </div>
    </div>
  )
}
