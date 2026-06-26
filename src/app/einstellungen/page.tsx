'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

const settingsSections = [
  {
    title: 'Vertriebs-Prozess',
    description: 'Konfiguriere die 12 Schritte deines Vertriebsprozesses',
    href: '/einstellungen/prozess',
    icon: '⚙️'
  },
  {
    title: 'Integration Setup',
    description: 'Konfiguriere Dialfire Kampagnen, Tasks und KlickTipp Tags',
    href: '/einstellungen/integration',
    icon: '🔗'
  },
  {
    title: 'Allgemein',
    description: 'Allgemeine Einstellungen (kommt bald)',
    href: '#',
    disabled: true,
    icon: '🔧'
  }
]

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Einstellungen</h1>
        <p className="text-gray-600 mb-8">Passe dein CRM an deine Bedürfnisse an</p>

        <div className="grid gap-6">
          {settingsSections.map((section) => (
            <div
              key={section.href}
              className={`rounded-lg border-2 transition ${
                section.disabled
                  ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-50'
                  : 'border-blue-200 bg-white hover:border-blue-400 hover:shadow-lg cursor-pointer'
              }`}
            >
              <Link href={section.href} className={section.disabled ? 'pointer-events-none' : ''}>
                <div className="p-6 flex items-start gap-4">
                  <div className="text-3xl">{section.icon}</div>
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold text-gray-900">{section.title}</h2>
                    <p className="text-gray-600 mt-1">{section.description}</p>
                  </div>
                  {!section.disabled && <div className="text-2xl text-blue-400">→</div>}
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
