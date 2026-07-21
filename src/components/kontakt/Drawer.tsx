'use client'
// Generisches Slide-Over-Panel (von rechts) für die Kontaktdetailseite.
// Kacheln zeigen den Überblick — der Drawer trägt die vollständigen Felder
// bzw. die komplette Historie einer Domäne.
import { useEffect, type ReactNode } from 'react'

interface DrawerProps {
  isOpen: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  /** Breite des Panels, Standard max-w-2xl */
  widthClass?: string
}

export function Drawer({ isOpen, title, onClose, children, footer, widthClass = 'max-w-2xl' }: DrawerProps) {
  useEffect(() => {
    if (!isOpen) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    // Hintergrund-Scroll sperren, solange der Drawer offen ist
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50">
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-label={title}
        className={`absolute inset-y-0 right-0 w-full ${widthClass} bg-white shadow-2xl flex flex-col`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <h2 className="text-base font-bold text-gray-900 truncate">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Schließen"
            className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 flex-shrink-0"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && (
          <div className="border-t border-gray-200 px-5 py-3 bg-gray-50 flex-shrink-0">{footer}</div>
        )}
      </div>
    </div>
  )
}
