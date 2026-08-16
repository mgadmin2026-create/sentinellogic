// Gemeinsamer Badge-Baustein — siehe docs/UI_UX_KONZEPT.md.
// Bündelt nur die Darstellung; fachliche Statusfarben (Kontakt-/Angebot-Status) bleiben in
// ihren eigenen Modulen (src/lib/angebot-status.ts etc.) unverändert — dieser Baustein wird dort
// als Trägt-Element genutzt, nicht als Ersatz für die Farblogik.
import { HTMLAttributes } from 'react'

export type BadgeColor = 'gray' | 'blue' | 'yellow' | 'green' | 'red' | 'indigo' | 'orange'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  color?: BadgeColor
}

const COLOR_CLASSES: Record<BadgeColor, string> = {
  gray: 'bg-gray-100 text-gray-700',
  blue: 'bg-blue-100 text-blue-700',
  yellow: 'bg-yellow-100 text-yellow-800',
  green: 'bg-green-100 text-green-700',
  red: 'bg-red-100 text-red-700',
  indigo: 'bg-indigo-50 text-indigo-700',
  orange: 'bg-orange-100 text-orange-700',
}

export function Badge({ color = 'gray', className = '', ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${COLOR_CLASSES[color]} ${className}`}
      {...props}
    />
  )
}
