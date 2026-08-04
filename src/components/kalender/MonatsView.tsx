'use client'
// Große Monatsansicht (Hauptbereich) — 6×7-Raster mit Termin-Pills je Tag.
import type { KalenderEintrag } from '@/types/kalender'
import { QUELLEN_FARBEN } from '@/types/kalender'
import { beruehrtTag, istHeute, istImMonat, monatsRaster, toDateKey } from '@/lib/kalender-helpers'

const WOCHENTAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']
const MAX_PRO_TAG = 3

interface Props {
  monat: Date
  eintraege: KalenderEintrag[]
  onTagClick: (date: Date) => void
  onEventClick: (eintrag: KalenderEintrag) => void
}

export function MonatsView({ monat, eintraege, onTagClick, onEventClick }: Props) {
  const raster = monatsRaster(monat)
  const wochen: Date[][] = []
  for (let i = 0; i < raster.length; i += 7) wochen.push(raster.slice(i, i + 7))

  function eintraegeDesTages(tag: Date) {
    return eintraege
      .filter((e) => beruehrtTag(e.start, e.end, tag))
      .sort((a, b) => a.start.getTime() - b.start.getTime())
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
        {WOCHENTAGE.map((w) => (
          <div key={w} className="py-2 text-center text-xs font-semibold text-gray-600">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {wochen.map((woche) =>
          woche.map((tag) => {
            const inMonat = istImMonat(tag, monat)
            const heute = istHeute(tag)
            const tagesEintraege = eintraegeDesTages(tag)
            return (
              <div
                key={toDateKey(tag)}
                onClick={() => onTagClick(tag)}
                title={tag.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                className={`min-h-[104px] border-b border-r border-gray-100 p-1.5 cursor-pointer transition-colors ${
                  inMonat ? 'bg-white hover:bg-gray-50' : 'bg-gray-50/60 hover:bg-gray-100/60'
                }`}
              >
                <span
                  className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs ${
                    heute ? 'bg-red-500 text-white font-bold' : inMonat ? 'text-gray-900 font-medium' : 'text-gray-300'
                  }`}
                >
                  {tag.getDate()}
                </span>
                <div className="mt-1 space-y-0.5">
                  {tagesEintraege.slice(0, MAX_PRO_TAG).map((e) => {
                    const f = QUELLEN_FARBEN[e.quelle]
                    return (
                      <button
                        key={e.id}
                        onClick={(ev) => { ev.stopPropagation(); onEventClick(e) }}
                        title={e.titel}
                        className={`w-full text-left truncate text-[10px] font-medium px-1 py-0.5 rounded ${f.bg} ${f.text}`}
                      >
                        {!e.ganztaegig && (
                          <span className="opacity-80">{e.start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} </span>
                        )}
                        {e.titel}
                      </button>
                    )
                  })}
                  {tagesEintraege.length > MAX_PRO_TAG && (
                    <p className="text-[10px] text-gray-400 px-1">+{tagesEintraege.length - MAX_PRO_TAG} mehr</p>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
