'use client'
// Jahresansicht — 12 Mini-Monate in einem 3-spaltigen Raster.
import { MiniMonat } from './MiniMonat'

const MONATSNAMEN = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]

interface Props {
  jahr: number
  markierteTage?: Set<string>
  onTagClick: (date: Date) => void
}

export function JahresView({ jahr, markierteTage, onTagClick }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-8 border border-gray-200 rounded-xl bg-white p-6">
      {MONATSNAMEN.map((name, i) => (
        <MiniMonat
          key={name}
          monat={new Date(jahr, i, 1)}
          titel={name}
          markierteTage={markierteTage}
          onTagClick={onTagClick}
        />
      ))}
    </div>
  )
}
