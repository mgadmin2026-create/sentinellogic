'use client'

// Aufklappbare Lauf-Historie einer Automatisierungsregel.
//
// Zweck: nachvollziehen, was die Regel je Kontakt bewirkt hat — wurde der
// Kontakt angelegt, wurden die Felder gesetzt, hat die Synchronisation nach
// Dialfire bzw. KlickTipp funktioniert.
import { useState } from 'react'
import Link from 'next/link'

interface SyncInfo {
  status: 'ok' | 'failed' | 'offen'
  detail: string | null
  at: string | null
}

interface Lauf {
  id: string
  zeitpunkt: string
  auslöser: 'auto' | 'batch'
  kontakt: { id: string; name: string; firma: string | null; archiviert: boolean } | null
  kontakt_neu_angelegt: boolean
  gesetzte_felder: string[]
  dialfire: SyncInfo
  klicktipp: SyncInfo
  dialfire_id_vorhanden: boolean
}

const SYNC_DARSTELLUNG: Record<SyncInfo['status'], { text: string; klasse: string }> = {
  ok: { text: 'synchronisiert', klasse: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  failed: { text: 'fehlgeschlagen', klasse: 'bg-red-50 text-red-700 border-red-200' },
  offen: { text: 'nicht erfolgt', klasse: 'bg-gray-100 text-gray-500 border-gray-200' },
}

function zeitpunkt(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleDateString('de-DE')}, ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`
}

function SyncMarke({ label, info }: { label: string; info: SyncInfo }) {
  const d = SYNC_DARSTELLUNG[info.status]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] ${d.klasse}`}
      title={info.detail || undefined}
    >
      <span className="font-semibold">{label}</span>
      <span>{d.text}</span>
    </span>
  )
}

export function RegelLaufHistorie({ ruleId, runs }: { ruleId: string; runs: number }) {
  const [offen, setOffen] = useState(false)
  const [laeufe, setLaeufe] = useState<Lauf[] | null>(null)
  const [laedt, setLaedt] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [begrenzt, setBegrenzt] = useState(false)

  async function laden() {
    setLaedt(true)
    setFehler(null)
    try {
      const res = await fetch(`/api/rules/${ruleId}/runs?limit=50`, { cache: 'no-store' })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Historie konnte nicht geladen werden')
      setLaeufe(json.data.runs)
      setBegrenzt(Boolean(json.data.begrenzt))
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Historie konnte nicht geladen werden')
    } finally {
      setLaedt(false)
    }
  }

  function umschalten() {
    const neu = !offen
    setOffen(neu)
    if (neu && laeufe === null) laden()
  }

  const fehlgeschlagen = (laeufe ?? []).filter(
    (l) => l.dialfire.status === 'failed' || l.klicktipp.status === 'failed'
  ).length

  return (
    <div className="mt-4 border-t border-gray-100 pt-3">
      <button
        onClick={umschalten}
        className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 transition-colors hover:text-gray-900"
        data-testid={`regel-historie-toggle-${ruleId}`}
      >
        <span className={`inline-block transition-transform ${offen ? 'rotate-90' : ''}`}>›</span>
        Verlauf
        {laeufe !== null && (
          <span className="font-normal text-gray-400">
            · {laeufe.length} betroffene Kontakte
            {fehlgeschlagen > 0 && <span className="ml-1 text-red-600">· {fehlgeschlagen} mit Sync-Fehler</span>}
          </span>
        )}
      </button>

      {offen && (
        <div className="mt-3">
          {laedt && <p className="py-3 text-xs text-gray-400">Verlauf wird geladen…</p>}
          {fehler && <p className="py-3 text-xs text-red-600">{fehler}</p>}

          {!laedt && !fehler && laeufe?.length === 0 && (
            <div className="rounded-lg bg-gray-50 px-4 py-3 text-xs text-gray-500">
              Diese Regel wurde {runs}× ausgeführt, hat dabei aber keinen Kontakt verändert —
              zur Quelle der Regel passte jeweils kein Kontakt.
            </div>
          )}

          {!laedt && !fehler && laeufe && laeufe.length > 0 && (
            <>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full min-w-[720px] text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500">
                      <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide">Zeitpunkt</th>
                      <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide">Kontakt</th>
                      <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide">Ausgelöst</th>
                      <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide">Gesetzt</th>
                      <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide">Synchronisation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {laeufe.map((lauf) => (
                      <tr key={lauf.id} className="border-t border-gray-100 align-top">
                        <td className="whitespace-nowrap px-3 py-2 text-gray-500">{zeitpunkt(lauf.zeitpunkt)}</td>
                        <td className="px-3 py-2">
                          {lauf.kontakt ? (
                            <>
                              <Link
                                href={`/kontakte/${lauf.kontakt.id}`}
                                className="font-semibold text-gray-900 hover:text-yellow-600"
                              >
                                {lauf.kontakt.name}
                              </Link>
                              {lauf.kontakt.firma && (
                                <span className="block text-gray-400">{lauf.kontakt.firma}</span>
                              )}
                              <span className="mt-0.5 flex flex-wrap gap-1">
                                {lauf.kontakt_neu_angelegt && (
                                  <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] text-blue-700">
                                    neu angelegt
                                  </span>
                                )}
                                {lauf.kontakt.archiviert && (
                                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">
                                    archiviert
                                  </span>
                                )}
                              </span>
                            </>
                          ) : (
                            <span className="text-gray-400">Kontakt entfernt</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-gray-500">
                          {lauf.auslöser === 'batch' ? 'manuell' : 'automatisch'}
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {lauf.gesetzte_felder.length ? lauf.gesetzte_felder.join(', ') : '—'}
                        </td>
                        <td className="px-3 py-2">
                          <span className="flex flex-wrap gap-1">
                            <SyncMarke label="Dialfire" info={lauf.dialfire} />
                            <SyncMarke label="KlickTipp" info={lauf.klicktipp} />
                          </span>
                          {(lauf.dialfire.status === 'failed' || lauf.klicktipp.status === 'failed') && (
                            <span className="mt-1 block text-[11px] leading-snug text-red-600">
                              {lauf.dialfire.status === 'failed' ? lauf.dialfire.detail : lauf.klicktipp.detail}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="mt-2 text-[11px] leading-relaxed text-gray-400">
                {begrenzt && 'Es werden die 50 jüngsten Einträge gezeigt. '}
                Der Sync-Stand zeigt jeweils die letzte Rückmeldung zu diesem Kontakt — ein späterer
                Erfolg hebt einen früheren Fehler auf.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
