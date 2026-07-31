'use client'
// Kompakte Monatsdarstellung mit KW-Spalte — Baustein für den Mini-Kalender
// in der Sidebar UND für die Jahresansicht (12× nebeneinander).
import { istGleicherTag, istHeute, istImMonat, kalenderwoche, monatsRaster, toDateKey } from '@/lib/kalender-helpers'

const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

interface Props {
  monat: Date
  titel?: string
  ausgewaehlt?: Date
  onTagClick: (date: Date) => void
  markierteTage?: Set<string>
  kompakt?: boolean
}

export function MiniMonat({ monat, titel, ausgewaehlt, onTagClick, markierteTage, kompakt }: Props) {
  const raster = monatsRaster(monat)
  const wochen: Date[][] = []
  for (let i = 0; i < raster.length; i += 7) wochen.push(raster.slice(i, i + 7))

  const textGröße = kompakt ? 'text-[11px]' : 'text-xs'

  return (
    <div>
      {titel && <p className="text-sm font-bold text-gray-900 mb-2">{titel}</p>}
      <table className={`w-full ${textGröße} border-collapse select-none`}>
        <thead>
          <tr className="text-gray-400">
            <th className="font-normal w-6 pb-1">KW</th>
            {WOCHENTAGE.map((w) => (
              <th key={w} className="font-normal pb-1">{w}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {wochen.map((woche, i) => (
            <tr key={i}>
              <td className="text-gray-300 text-center py-0.5">{kalenderwoche(woche[0])}</td>
              {woche.map((tag) => {
                const inMonat = istImMonat(tag, monat)
                const heute = istHeute(tag)
                const gewaehlt = ausgewaehlt && istGleicherTag(tag, ausgewaehlt)
                const hatEintrag = markierteTage?.has(toDateKey(tag))
                return (
                  <td key={toDateKey(tag)} className="text-center py-0.5">
                    <button
                      onClick={() => onTagClick(tag)}
                      className={`relative inline-flex items-center justify-center w-6 h-6 rounded-full transition-colors ${
                        heute
                          ? 'bg-red-500 text-white font-bold'
                          : gewaehlt
                            ? 'bg-yellow-400 text-gray-900 font-semibold'
                            : inMonat
                              ? 'text-gray-900 hover:bg-gray-100'
                              : 'text-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {tag.getDate()}
                      {hatEintrag && !heute && (
                        <span className="absolute bottom-0 w-1 h-1 rounded-full bg-blue-500" />
                      )}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
