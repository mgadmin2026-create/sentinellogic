'use client'
// Drawer-Inhalt für die Beitragsübersicht — Sparten-Vergleich bisheriger vs.
// Allianz-Beitrag, abgeleitet aus der Excel-Vorlage "Beitragsuebersicht_Vorlage_
// Allianz_Guen". Eine laufende Übersicht pro Kontakt (keine Versionierung):
// jeder Speichervorgang überschreibt den bisherigen Stand.
import { useEffect, useState } from 'react'
import { SPARTEN_PRIVAT, SPARTEN_GEWERBE, KFZ_FLOTTE_SPARTE } from '@/data/beitragsuebersicht-sparten'
import { emptyPosition, emptyFahrzeug, type Beitragsuebersicht, type BeitragsPosition } from '@/types/beitragsuebersicht'
import { berechneDifferenz, berechneSummen, effektiveWerte, summeFahrzeuge } from '@/lib/beitragsuebersicht-calc'

interface BeitragsuebersichtPanelProps {
  kontaktId: string
  kontaktTyp: 'privat' | 'gewerbe'
  initialData?: Beitragsuebersicht | null
  onSave: (changes: Record<string, unknown>) => Promise<void>
  onClose: () => void
}

function buildInitial(kontaktTyp: 'privat' | 'gewerbe'): Beitragsuebersicht {
  const sparten = kontaktTyp === 'privat' ? SPARTEN_PRIVAT : SPARTEN_GEWERBE
  return {
    datum: new Date().toISOString().slice(0, 10),
    flotte_aktiv: false,
    positionen: sparten.map((s) => emptyPosition(s, s === KFZ_FLOTTE_SPARTE)),
    fahrzeuge: [],
  }
}

function fmtEuro(n: number): string {
  return n.toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' €'
}

function DifferenzCell({ position, data }: { position: BeitragsPosition; data: Beitragsuebersicht }) {
  const { alt, neu } = effektiveWerte(position, data.fahrzeuge, data.flotte_aktiv)
  const diff = berechneDifferenz(alt, neu)
  if (diff.kind === 'leer') return <span className="text-gray-300">—</span>
  if (diff.kind === 'neu') return <span className="text-blue-600 font-semibold text-xs">NEU</span>
  return (
    <span className={`font-semibold tabular-nums ${diff.betrag >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
      {diff.betrag > 0 ? '+' : ''}
      {fmtEuro(diff.betrag)}
    </span>
  )
}

export function BeitragsuebersichtPanel({ kontaktId, kontaktTyp, initialData, onSave, onClose }: BeitragsuebersichtPanelProps) {
  const [data, setData] = useState<Beitragsuebersicht>(initialData ?? buildInitial(kontaktTyp))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setData(initialData ?? buildInitial(kontaktTyp))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kontaktId])

  function updatePosition(idx: number, patch: Partial<BeitragsPosition>) {
    setData((d) => ({ ...d, positionen: d.positionen.map((p, i) => (i === idx ? { ...p, ...patch } : p)) }))
  }

  function addPosition() {
    setData((d) => ({ ...d, positionen: [...d.positionen, emptyPosition('')] }))
  }

  function removePosition(idx: number) {
    setData((d) => ({ ...d, positionen: d.positionen.filter((_, i) => i !== idx) }))
  }

  function updateFahrzeug(idx: number, patch: Partial<typeof data.fahrzeuge[number]>) {
    setData((d) => ({ ...d, fahrzeuge: d.fahrzeuge.map((f, i) => (i === idx ? { ...f, ...patch } : f)) }))
  }

  function addFahrzeug() {
    setData((d) => ({ ...d, fahrzeuge: [...d.fahrzeuge, emptyFahrzeug()] }))
  }

  function removeFahrzeug(idx: number) {
    setData((d) => ({ ...d, fahrzeuge: d.fahrzeuge.filter((_, i) => i !== idx) }))
  }

  const summen = berechneSummen(data)
  const fahrzeugSum = summeFahrzeuge(data.fahrzeuge)

  async function handleSubmit() {
    setSaving(true)
    try {
      await onSave({ beitragsuebersicht: { ...data, datum: new Date().toISOString().slice(0, 10) } })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  function handlePdf() {
    window.open(`/api/kontakte/${kontaktId}/beitragsuebersicht/pdf`, '_blank')
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        Eine laufende Übersicht pro Kontakt — beim Speichern wird der bisherige Stand überschrieben, nicht versioniert.
      </p>

      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full text-xs min-w-[900px]">
          <thead>
            <tr className="bg-gray-50 text-gray-500">
              <th className="text-left font-semibold uppercase tracking-wide px-2 py-2">Sparte</th>
              <th className="text-left font-semibold uppercase tracking-wide px-2 py-2">Versicherer alt</th>
              <th className="text-left font-semibold uppercase tracking-wide px-2 py-2">Alt €/J.</th>
              <th className="text-left font-semibold uppercase tracking-wide px-2 py-2">Neu €/J.</th>
              <th className="text-left font-semibold uppercase tracking-wide px-2 py-2">Differenz</th>
              <th className="text-left font-semibold uppercase tracking-wide px-2 py-2">Beginn</th>
              <th className="text-left font-semibold uppercase tracking-wide px-2 py-2">Ablauf</th>
              <th className="text-left font-semibold uppercase tracking-wide px-2 py-2">Bemerkung</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {data.positionen.map((p, idx) => {
              const isFlotteZeile = !!p.ist_flotte_zeile
              const flotteLocked = isFlotteZeile && data.flotte_aktiv
              return (
                <tr key={idx} className="border-t border-gray-100">
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={p.sparte}
                      onChange={(e) => updatePosition(idx, { sparte: e.target.value })}
                      className="w-full min-w-[150px] px-1.5 py-1 border border-transparent hover:border-gray-200 focus:border-yellow-400 rounded text-xs focus:outline-none"
                      placeholder="Sparte…"
                    />
                    {isFlotteZeile && <span className="text-gray-400 text-[10px] ml-1">(Flotte)</span>}
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={p.versicherer_alt}
                      onChange={(e) => updatePosition(idx, { versicherer_alt: e.target.value })}
                      className="w-full min-w-[100px] px-1.5 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400"
                      placeholder="–"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    {flotteLocked ? (
                      <strong className="tabular-nums">{fmtEuro(fahrzeugSum.alt)}</strong>
                    ) : (
                      <input
                        type="number"
                        value={p.beitrag_alt ?? ''}
                        onChange={(e) => updatePosition(idx, { beitrag_alt: e.target.value === '' ? null : Number(e.target.value) })}
                        className="w-20 px-1.5 py-1 border border-gray-200 rounded text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-yellow-400"
                        placeholder="–"
                      />
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {flotteLocked ? (
                      <strong className="tabular-nums">{fmtEuro(fahrzeugSum.neu)}</strong>
                    ) : (
                      <input
                        type="number"
                        value={p.beitrag_neu ?? ''}
                        onChange={(e) => updatePosition(idx, { beitrag_neu: e.target.value === '' ? null : Number(e.target.value) })}
                        className="w-20 px-1.5 py-1 border border-gray-200 rounded text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-yellow-400"
                        placeholder="–"
                      />
                    )}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <DifferenzCell position={p} data={data} />
                  </td>
                  <td className="px-2 py-1.5">
                    {isFlotteZeile ? (
                      <span className="text-gray-300">—</span>
                    ) : (
                      <input
                        type="date"
                        value={p.beginn ?? ''}
                        onChange={(e) => updatePosition(idx, { beginn: e.target.value || null })}
                        className="w-[118px] px-1.5 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400"
                      />
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {isFlotteZeile ? (
                      <span className="text-gray-300">—</span>
                    ) : (
                      <input
                        type="date"
                        value={p.ablauf ?? ''}
                        onChange={(e) => updatePosition(idx, { ablauf: e.target.value || null })}
                        className="w-[118px] px-1.5 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400"
                      />
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {flotteLocked ? (
                      <span className="text-gray-400 text-[11px]">Details siehe Flotte ({data.fahrzeuge.length} Fahrzeuge)</span>
                    ) : (
                      <input
                        type="text"
                        value={p.bemerkung}
                        onChange={(e) => updatePosition(idx, { bemerkung: e.target.value })}
                        className="w-full min-w-[140px] px-1.5 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400"
                        placeholder="–"
                      />
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {!isFlotteZeile && (
                      <button
                        onClick={() => removePosition(idx)}
                        aria-label="Sparte entfernen"
                        className="text-gray-300 hover:text-red-500"
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <button
        onClick={addPosition}
        className="w-full border border-dashed border-gray-300 hover:border-yellow-400 text-gray-500 hover:text-gray-900 text-xs py-2 rounded-lg transition-colors"
      >
        + Sparte hinzufügen
      </button>

      {kontaktTyp === 'gewerbe' && (
        <>
          <label className="flex items-start gap-2.5 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={data.flotte_aktiv}
              onChange={(e) => setData((d) => ({ ...d, flotte_aktiv: e.target.checked }))}
              className="mt-0.5 rounded border-gray-300 text-yellow-500 focus:ring-yellow-400"
            />
            <span>
              Flottenblatt nutzen (ab 4 Fahrzeugen) — wie im Original: bei 1–3 Fahrzeugen einfach direkt in der Zeile
              „{KFZ_FLOTTE_SPARTE}“ oben eintragen.
            </span>
          </label>

          {data.flotte_aktiv && (
            <div>
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full text-xs min-w-[600px]">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500">
                      <th className="text-left font-semibold uppercase tracking-wide px-2 py-2">Kennzeichen</th>
                      <th className="text-left font-semibold uppercase tracking-wide px-2 py-2">Fahrzeug</th>
                      <th className="text-left font-semibold uppercase tracking-wide px-2 py-2">Alt €/J.</th>
                      <th className="text-left font-semibold uppercase tracking-wide px-2 py-2">Neu €/J.</th>
                      <th className="text-left font-semibold uppercase tracking-wide px-2 py-2">Differenz</th>
                      <th className="text-left font-semibold uppercase tracking-wide px-2 py-2">Bemerkung</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.fahrzeuge.map((f, idx) => {
                      const diff = berechneDifferenz(f.beitrag_alt, f.beitrag_neu)
                      return (
                        <tr key={idx} className="border-t border-gray-100">
                          <td className="px-2 py-1.5">
                            <input
                              type="text"
                              value={f.kennzeichen}
                              onChange={(e) => updateFahrzeug(idx, { kennzeichen: e.target.value })}
                              className="w-24 px-1.5 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="text"
                              value={f.fahrzeug}
                              onChange={(e) => updateFahrzeug(idx, { fahrzeug: e.target.value })}
                              className="w-full min-w-[140px] px-1.5 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              value={f.beitrag_alt ?? ''}
                              onChange={(e) => updateFahrzeug(idx, { beitrag_alt: e.target.value === '' ? null : Number(e.target.value) })}
                              className="w-20 px-1.5 py-1 border border-gray-200 rounded text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-yellow-400"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              value={f.beitrag_neu ?? ''}
                              onChange={(e) => updateFahrzeug(idx, { beitrag_neu: e.target.value === '' ? null : Number(e.target.value) })}
                              className="w-20 px-1.5 py-1 border border-gray-200 rounded text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-yellow-400"
                            />
                          </td>
                          <td className="px-2 py-1.5 whitespace-nowrap">
                            {diff.kind === 'leer' && <span className="text-gray-300">—</span>}
                            {diff.kind === 'neu' && <span className="text-blue-600 font-semibold text-xs">NEU</span>}
                            {diff.kind === 'wert' && (
                              <span className={`font-semibold tabular-nums ${diff.betrag >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {diff.betrag > 0 ? '+' : ''}
                                {fmtEuro(diff.betrag)}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="text"
                              value={f.bemerkung}
                              onChange={(e) => updateFahrzeug(idx, { bemerkung: e.target.value })}
                              className="w-full min-w-[120px] px-1.5 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <button onClick={() => removeFahrzeug(idx)} aria-label="Fahrzeug entfernen" className="text-gray-300 hover:text-red-500">
                              ✕
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <button
                onClick={addFahrzeug}
                className="w-full mt-2 border border-dashed border-gray-300 hover:border-yellow-400 text-gray-500 hover:text-gray-900 text-xs py-2 rounded-lg transition-colors"
              >
                + Fahrzeug hinzufügen
              </button>
              <p className="text-[11px] text-gray-400 mt-1.5">
                Die Summe fließt automatisch in die Zeile „{KFZ_FLOTTE_SPARTE}“ oben ein — dort nicht mehr händisch eintragen. Beginn/Ablauf gibt es auf dem Flottenblatt im Original nicht, nur Bemerkung.
              </p>
            </div>
          )}
        </>
      )}

      <div className="border-t border-gray-200 pt-3">
        <div className="flex items-center justify-between font-semibold text-sm pt-2 border-t-2 border-gray-900">
          <span>Gesamtbeitrag pro Jahr</span>
          <span className="tabular-nums">
            {fmtEuro(summen.sumAlt)} → {fmtEuro(summen.sumNeu)}
          </span>
        </div>
        <div className="flex gap-2 mt-3">
          <div className={`flex-1 rounded-lg border px-3 py-2 text-center ${summen.ersparnisProJahr > 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-gray-50 border-gray-200 text-gray-300'}`}>
            <div className="text-[10px] font-bold uppercase tracking-wide">✓ Ersparnis / Jahr</div>
            <div className="text-lg font-extrabold tabular-nums">{fmtEuro(summen.ersparnisProJahr)}</div>
          </div>
          <div className={`flex-1 rounded-lg border px-3 py-2 text-center ${summen.mehrbeitragProMonat > 0 ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-300'}`}>
            <div className="text-[10px] font-bold uppercase tracking-wide">Mehrbeitrag / Monat</div>
            <div className="text-lg font-extrabold tabular-nums">{fmtEuro(summen.mehrbeitragProMonat)}</div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="flex-1 bg-yellow-400 hover:bg-yellow-500 disabled:opacity-50 text-gray-900 font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors"
        >
          {saving ? 'Speichert…' : 'Speichern'}
        </button>
        <button
          onClick={handlePdf}
          className="border border-gray-200 text-gray-700 hover:bg-gray-50 font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors"
        >
          PDF herunterladen
        </button>
      </div>
    </div>
  )
}
