'use client'
// Verbindet /regeln und /sync optisch zu einer "Automatisierungen"-Sektion,
// ohne die beiden Seiten/Datenmodelle zusammenzulegen (Regeln = Business-
// Logik, sync_runs = Ausführungs-/Health-Schicht darunter).
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/regeln', label: 'Regeln' },
  { href: '/sync', label: 'Integrationen & Sync' },
] as const

export function AutomatisierungenTabs() {
  const pathname = usePathname()
  return (
    <div className="mb-6">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Automatisierungen</p>
      <div className="inline-flex items-center gap-1 bg-gray-100 rounded-lg p-1">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(tab.href + '/')
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
