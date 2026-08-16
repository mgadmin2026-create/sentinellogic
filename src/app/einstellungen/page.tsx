'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { isAdmin } from '@/lib/roles'
import { HelpButton } from '@/components/help/HelpButton'
import { PageHeader } from '@/components/ui'

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
    title: 'Dokumente & Google Drive',
    description: 'Zentrales Google-Drive-Konto für alle Dokumente verbinden',
    href: '/einstellungen/dokumente',
    icon: '📄'
  },
  {
    title: 'E-Mail-Vorlagen',
    description: 'Vorlagen für den Kontakt-E-Mail-Versand verwalten',
    href: '/einstellungen/mail-vorlagen',
    icon: '✉️'
  },
  {
    title: 'Sparten & Erstgespräch-Leitfäden',
    description: 'Sparten verwalten und den Gesprächsleitfaden pro Sparte pflegen',
    href: '/einstellungen/sparten',
    icon: '📋'
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
  const [userIsAdmin, setUserIsAdmin] = useState(false)

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((res) => { if (res.success) setUserIsAdmin(isAdmin(res.data.role)) })
      .catch(() => {})
  }, [])

  const sections = userIsAdmin
    ? [
        ...settingsSections,
        { title: 'Team', description: 'Mitarbeiter-Konten anlegen, Rollen verwalten', href: '/einstellungen/team', icon: '👥' },
      ]
    : settingsSections

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl">
        <PageHeader
          title="Einstellungen"
          subtitle={
            <span className="flex items-center gap-1.5">
              Passe dein CRM an deine Bedürfnisse an
              <HelpButton articleId="einstellungen.overview" />
            </span>
          }
        />

        <div className="grid gap-6">
          {sections.map((section) => (
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
