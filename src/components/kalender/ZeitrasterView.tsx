'use client'
// Gemeinsame Stundenraster-Ansicht für Tag/Arbeitswoche/Woche — unterscheidet
// sich nur in der Anzahl der übergebenen Tage.
import { useEffect, useRef } from 'react'
import type { KalenderEintrag } from '@/types/kalender'
import { QUELLEN_FARBEN } from '@/types/kalender'
import {
  STUNDEN,
  istGleicherTag,
  istHeute,
  minutenSeitMitternacht,
  toDateKey,
  wochentagKurz,
} from '@/lib/kalender-helpers'
import { positioniereEreignisse } from '@/lib/kalender-layout'

const STUNDENHÖHE = 60 // px

interface Props {
  tage: Date[]
  eintraege: KalenderEintrag[]
  onSlotClick: (start: Date) => void
  onEventClick: (eintrag: KalenderEintrag) => void
}

export function ZeitrasterView({ tage, eintraege, onSlotClick, onEventClick }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Auf Geschäftszeiten scrollen, nicht auf Mitternacht.
    if (scrollRef.current) scrollRef.current.scrollTop = 7 * STUNDENHÖHE
  }, [])

  const ganztaegige = eintraege.filter((e) => e.ganztaegig)
  const zeitEintraege = eintraege.filter((e) => !e.ganztaegig)

  const jetzt = new Date()
  const heuteIndex = tage.findIndex((t) => istHeute(t))

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      {/* Tages-Header */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        <div className="w-16 flex-shrink-0" />
        {tage.map((tag) => (
          <div key={toDateKey(tag)} className="flex-1 min-w-0 text-center py-2.5 border-l border-gray-100">
            <span className={`text-lg font-bold ${istHeute(tag) ? 'inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-500 text-white' : 'text-gray-900'}`}>
              {tag.getDate()}
            </span>
            <span className="block text-xs text-gray-500 mt-0.5">{wochentagKurz(tag)}.</span>
          </div>
        ))}
      </div>

      {/* Ganztägige Termine / Geburtstage */}
      {ganztaegige.length > 0 && (
        <div className="flex border-b border-gray-200">
          <div className="w-16 flex-shrink-0 text-[10px] text-gray-400 text-right pr-2 py-1.5">Ganztägig</div>
          {tage.map((tag) => {
            const einträgeDesTages = ganztaegige.filter((e) => istGleicherTag(e.start, tag))
            return (
              <div key={toDateKey(tag)} className="flex-1 min-w-0 border-l border-gray-100 p-1 space-y-1">
                {einträgeDesTages.map((e) => {
                  const f = QUELLEN_FARBEN[e.quelle]
                  return (
                    <button
                      key={e.id}
                      onClick={() => onEventClick(e)}
                      title={e.titel}
                      className={`w-full text-left truncate text-[11px] font-medium px-1.5 py-0.5 rounded ${f.bg} ${f.text}`}
                    >
                      {e.titel}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {/* Stundenraster */}
      <div ref={scrollRef} className="flex overflow-y-auto" style={{ maxHeight: 560 }}>
        {/* Stunden-Spalte */}
        <div className="w-16 flex-shrink-0">
          {STUNDEN.map((h) => (
            <div key={h} style={{ height: STUNDENHÖHE }} className="text-[11px] text-gray-400 text-right pr-2 -translate-y-2">
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>

        {/* Tages-Spalten */}
        <div className="flex-1 flex relative">
          {tage.map((tag, tagIndex) => {
            const tagesEintraege = zeitEintraege.filter((e) => istGleicherTag(e.start, tag))
            const positioniert = positioniereEreignisse(
              tagesEintraege.map((e) => ({
                id: e.id,
                startMin: minutenSeitMitternacht(e.start),
                endMin: Math.max(minutenSeitMitternacht(e.end), minutenSeitMitternacht(e.start) + 20),
              }))
            )

            return (
              <div key={toDateKey(tag)} className="flex-1 min-w-0 border-l border-gray-100 relative">
                {STUNDEN.map((h) => (
                  <div
                    key={h}
                    style={{ height: STUNDENHÖHE }}
                    className="border-b border-gray-100 hover:bg-yellow-50/60 cursor-pointer"
                    onClick={() => {
                      const start = new Date(tag)
                      start.setHours(h, 0, 0, 0)
                      onSlotClick(start)
                    }}
                  />
                ))}

                {positioniert.map(({ eintrag: pos, spalte, spaltenAnzahl }) => {
                  const original = tagesEintraege.find((e) => e.id === pos.id)!
                  const f = QUELLEN_FARBEN[original.quelle]
                  const breite = 100 / spaltenAnzahl
                  return (
                    <button
                      key={pos.id}
                      onClick={(ev) => {
                        ev.stopPropagation()
                        onEventClick(original)
                      }}
                      title={`${original.titel}${original.ort ? ' · ' + original.ort : ''}`}
                      className={`absolute rounded px-1.5 py-0.5 text-left overflow-hidden text-[11px] font-medium border ${f.bg} ${f.border} ${f.text}`}
                      style={{
                        top: pos.startMin,
                        height: Math.max(pos.endMin - pos.startMin, 20),
                        left: `${spalte * breite}%`,
                        width: `calc(${breite}% - 2px)`,
                      }}
                    >
                      <span className="block truncate">{original.titel}</span>
                    </button>
                  )
                })}

                {/* Aktuelle Zeit */}
                {tagIndex === heuteIndex && (
                  <div
                    className="absolute left-0 right-0 flex items-center pointer-events-none z-10"
                    style={{ top: minutenSeitMitternacht(jetzt) }}
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1" />
                    <div className="flex-1 h-px bg-red-500" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
