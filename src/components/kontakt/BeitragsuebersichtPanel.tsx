'use client'
// Drawer-Inhalt für die Beitragsübersicht — Sparten-Vergleich bisheriger vs.
// Allianz-Beitrag, abgeleitet aus der Excel-Vorlage "Beitragsuebersicht_Vorlage_
// Allianz_Guen". Eine laufende Übersicht pro Kontakt (keine Versionierung):
// jeder Speichervorgang überschreibt den bisherigen Stand.
import { useEffect, useState } from 'react'
import { SPARTEN_PRIVAT, SPARTEN_GEWERBE, KFZ_FLOTTE_SPARTE } from '@/data/beitragsuebersicht-sparten'
import { emptyPosition, emptyFahrzeug, type Beitragsuebersicht, type BeitragsPosition, type FlottenFahrzeug } from '@/types/beitragsuebersicht'
import { berechneDifferenz, berechneSummen, effektiveWerte, summeFahrzeuge } from '@/lib/beitragsuebersicht-calc'
import { ZAHLUNGEN_PRO_JAHR, ZYKLUS_LABEL, ZYKLUS_OPTIONEN, type Zyklus } from '@/lib/beitragsuebersicht-zyklus'

interface BeitragsuebersichtPanelProps {
  kontaktId: string
  kontaktTyp: 'privat' | 'gewerbe'
  initialData?: Beitragsuebersicht | null
  onSave: (changes: Record<string, unknown>) => Promise<void>
  onClose: () => void
  /** Öffnet den E-Mail-Versand mit dem übergebenen PDF bereits als Anhang. */
  onSendMail?: (file: File) => void
}

function zeitstempelDateiname(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
}

function buildInitial(kontaktTyp: 'privat' | 'gewerbe'): Beitragsuebersicht {
  const sparten = kontaktTyp === 'privat' ? SPARTEN_PRIVAT : SPARTEN_GEWERBE
  return {
    datum: new Date().toISOString().slice(0, 10),
    flotte_aktiv: false,
    positionen: sparten.map((s) => emptyPosition(s, s === KFZ_FLOTTE_SPARTE)),
    fahrzeuge: [],
    zyklus: 'jaehrlich',
  }
}

/** Aktualisiert die Kfz-Flotte-Positionszeile mit der aktuellen Fahrzeugsumme (no-op falls Zeile gelöscht wurde). */
function syncFlottePosition(positionen: BeitragsPosition[], fahrzeuge: FlottenFahrzeug[]): BeitragsPosition[] {
  const sum = summeFahrzeuge(fahrzeuge)
  return positionen.map((p) =>
    p.ist_flotte_zeile ? { ...p, beitrag_alt: sum.alt || null, beitrag_neu: sum.neu || null } : p
  )
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

export function BeitragsuebersichtPanel({ kontaktId, kontaktTyp, initialData, onSave, onClose, onSendMail }: BeitragsuebersichtPanelProps) {
  const [data, setData] = useState<Beitragsuebersicht>(initialData ?? buildInitial(kontaktTyp))
  const [saving, setSaving] = useState(false)
  const [mailLoading, setMailLoading] = useState(false)
  const [mailError, setMailError] = useState<string | null>(null)
  const [pendingZyklus, setPendingZyklus] = useState<Zyklus | null>(null)

  useEffect(() => {
    setData(initialData ?? buildInitial(kontaktTyp))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kontaktId])

  const zyklus: Zyklus = data.zyklus ?? 'jaehrlich'
  const zyklusLabel = ZYKLUS_LABEL[zyklus]

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
    setData((d) => {
      const fahrzeuge = d.fahrzeuge.map((f, i) => (i === idx ? { ...f, ...patch } : f))
      return { ...d, fahrzeuge, positionen: d.flotte_aktiv ? syncFlottePosition(d.positionen, fahrzeuge) : d.positionen }
    })
  }

  function addFahrzeug() {
    setData((d) => {
      const fahrzeuge = [...d.fahrzeuge, emptyFahrzeug()]
      return { ...d, fahrzeuge, positionen: d.flotte_aktiv ? syncFlottePosition(d.positionen, fahrzeuge) : d.positionen }
    })
  }

  function removeFahrzeug(idx: number) {
    setData((d) => {
      const fahrzeuge = d.fahrzeuge.filter((_, i) => i !== idx)
      return { ...d, fahrzeuge, positionen: d.flotte_aktiv ? syncFlottePosition(d.positionen, fahrzeuge) : d.positionen }
    })
  }

  function handleFlotteAktivChange(aktiv: boolean) {
    setData((d) => ({ ...d, flotte_aktiv: aktiv, positionen: aktiv ? syncFlottePosition(d.positionen, d.fahrzeuge) : d.positionen }))
  }

  function hatBestehendeBetraege(d: Beitragsuebersicht): boolean {
    return (
      d.positionen.some((p) => p.beitrag_alt != null || p.beitrag_neu != null) ||
      d.fahrzeuge.some((f) => f.beitrag_alt != null || f.beitrag_neu != null)
    )
  }

  function handleZyklusChange(neu: Zyklus) {
    if (neu === zyklus) return
    if (!hatBestehendeBetraege(data)) {
      setData((d) => ({ ...d, zyklus: neu }))
      return
    }
    setPendingZyklus(neu)
  }

  function applyZyklusSwitch(modus: 'beibehalten' | 'umrechnen') {
    const neu = pendingZyklus
    if (!neu) return
    setData((d) => {
      if (modus === 'beibehalten') return { ...d, zyklus: neu }
      const faktor = ZAHLUNGEN_PRO_JAHR[zyklus] / ZAHLUNGEN_PRO_JAHR[neu]
      const rund = (n: number | null) => (n == null ? null : Math.round(n * faktor * 100) / 100)
      return {
        ...d,
        zyklus: neu,
        positionen: d.positionen.map((p) => ({ ...p, beitrag_alt: rund(p.beitrag_alt), beitrag_neu: rund(p.beitrag_neu) })),
        fahrzeuge: d.fahrzeuge.map((f) => ({ ...f, beitrag_alt: rund(f.beitrag_alt), beitrag_neu: rund(f.beitrag_neu) })),
      }
    })
    setPendingZyklus(null)
  }

  const summen = berechneSummen(data)

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

  async function handleSendMail() {
    if (!onSendMail) return
    setMailError(null)
    setMailLoading(true)
    try {
      const res = await fetch(`/api/kontakte/${kontaktId}/beitragsuebersicht/pdf`)
      if (!res.ok) throw new Error('PDF konnte nicht erzeugt werden')
      const blob = await res.blob()
      const file = new File([blob], `Beitragsuebersicht_${zeitstempelDateiname()}.pdf`, { type: 'application/pdf' })
      onSendMail(file)
    } catch (err) {
      setMailError(err instanceof Error ? err.message : 'PDF konnte nicht erzeugt werden')
    } finally {
      setMailLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        Eine laufende Übersicht pro Kontakt — beim Speichern wird der bisherige Stand überschrieben, nicht versioniert.
      </p>

      <div className="flex items-center gap-2.5 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Zyklus</label>
        <select
          value={zyklus}
          onChange={(e) => handleZyklusChange(e.target.value as Zyklus)}
          className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-yellow-400"
        >
          {ZYKLUS_OPTIONEN.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="text-[11px] text-gray-400">Gilt für die gesamte Übersicht — alle Beträge unten sind €/{zyklusLabel}.</span>
      </div>

      {pendingZyklus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-3">
            <h4 className="font-semibold text-sm text-gray-900">
              Zyklus wechseln: {ZYKLUS_LABEL[zyklus]} → {ZYKLUS_LABEL[pendingZyklus]}
            </h4>
            <p className="text-xs text-gray-600 leading-relaxed">
              Es sind bereits Beträge erfasst. Sollen die Zahlen unverändert bleiben (z.B. 100 €/{zyklusLabel} bleibt 100 €/
              {ZYKLUS_LABEL[pendingZyklus]}) oder auf den neuen Zyklus umgerechnet werden (z.B. 100 €/{zyklusLabel} →{' '}
              {(100 * (ZAHLUNGEN_PRO_JAHR[zyklus] / ZAHLUNGEN_PRO_JAHR[pendingZyklus])).toLocaleString('de-DE', {
                maximumFractionDigits: 2,
              })}{' '}
              €/{ZYKLUS_LABEL[pendingZyklus]})?
            </p>
            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={() => applyZyklusSwitch('beibehalten')}
                className="w-full text-left px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-xs font-medium text-gray-700"
              >
                Beträge beibehalten (Zahlen bleiben unverändert)
              </button>
              <button
                onClick={() => applyZyklusSwitch('umrechnen')}
                className="w-full text-left px-3 py-2 rounded-lg border border-yellow-300 bg-yellow-50 hover:bg-yellow-100 text-xs font-medium text-gray-900"
              >
                Beträge umrechnen (auf neuen Zyklus normalisieren)
              </button>
              <button onClick={() => setPendingZyklus(null)} className="w-full text-center px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600">
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full text-xs min-w-[900px]">
          <thead>
            <tr className="bg-gray-50 text-gray-500">
              <th className="text-left font-semibold uppercase tracking-wide px-2 py-2">Sparte</th>
              <th className="text-left font-semibold uppercase tracking-wide px-2 py-2">Versicherer alt</th>
              <th className="text-left font-semibold uppercase tracking-wide px-2 py-2">Alt €/{zyklusLabel}</th>
              <th className="text-left font-semibold uppercase tracking-wide px-2 py-2">Neu €/{zyklusLabel}</th>
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
                    {p.automatisch_uebernommen && (
                      <span
                        title={`Automatisch aus Vertragsupload übernommen${p.bemerkung ? ` — ${p.bemerkung}` : ''}`}
                        className="inline-flex items-center justify-center w-4 h-4 ml-1 text-[10px] rounded-full bg-blue-100 text-blue-600 align-middle cursor-help"
                      >
                        📄
                      </span>
                    )}
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
                    <input
                      type="number"
                      value={p.beitrag_alt ?? ''}
                      onChange={(e) => updatePosition(idx, { beitrag_alt: e.target.value === '' ? null : Number(e.target.value) })}
                      className="w-20 px-1.5 py-1 border border-gray-200 rounded text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-yellow-400"
                      placeholder="–"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      value={p.beitrag_neu ?? ''}
                      onChange={(e) => updatePosition(idx, { beitrag_neu: e.target.value === '' ? null : Number(e.target.value) })}
                      className="w-20 px-1.5 py-1 border border-gray-200 rounded text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-yellow-400"
                      placeholder="–"
                    />
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
                    <textarea
                      rows={1}
                      value={p.bemerkung}
                      onChange={(e) => updatePosition(idx, { bemerkung: e.target.value })}
                      className="w-full min-w-[220px] px-1.5 py-1 border border-gray-200 rounded text-xs leading-tight resize-y min-h-[30px] focus:outline-none focus:ring-1 focus:ring-yellow-400"
                      placeholder="–"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <button
                      onClick={() => removePosition(idx)}
                      aria-label="Sparte entfernen"
                      className="text-gray-300 hover:text-red-500"
                    >
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
              onChange={(e) => handleFlotteAktivChange(e.target.checked)}
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
                      <th className="text-left font-semibold uppercase tracking-wide px-2 py-2">Alt €/{zyklusLabel}</th>
                      <th className="text-left font-semibold uppercase tracking-wide px-2 py-2">Neu €/{zyklusLabel}</th>
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
                            <textarea
                              rows={1}
                              value={f.bemerkung}
                              onChange={(e) => updateFahrzeug(idx, { bemerkung: e.target.value })}
                              className="w-full min-w-[200px] px-1.5 py-1 border border-gray-200 rounded text-xs leading-tight resize-y min-h-[30px] focus:outline-none focus:ring-1 focus:ring-yellow-400"
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
          <span>Gesamtbeitrag pro {zyklusLabel}</span>
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

      {mailError && (
        <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{mailError}</div>
      )}

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
        {onSendMail && (
          <button
            onClick={handleSendMail}
            disabled={mailLoading}
            className="border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors"
          >
            {mailLoading ? 'Erzeuge PDF…' : '📧 Per E-Mail senden'}
          </button>
        )}
      </div>
    </div>
  )
}
