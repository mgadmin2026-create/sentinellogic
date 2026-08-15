// Gemeinsamer Karten-Baustein — siehe docs/UI_UX_KONZEPT.md.
// Vereinheitlicht die bisher 8+ verschiedenen rounded/shadow/border-Kombinationen auf das im
// Code am häufigsten vorkommende Muster (rounded-xl border border-gray-200 shadow-sm).
import { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string
  actions?: React.ReactNode
  padded?: boolean
}

export function Card({ title, actions, padded = true, className = '', children, ...props }: CardProps) {
  return (
    <div
      className={`bg-white rounded-xl border border-gray-200 shadow-sm ${padded ? 'p-4 sm:p-5' : ''} ${className}`}
      {...props}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between mb-3">
          {title && <h2 className="text-sm font-semibold text-gray-900">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </div>
  )
}
