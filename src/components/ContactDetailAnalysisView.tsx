'use client'

import { useState, useCallback, memo } from 'react'
import { calculateAge, daysUntilBirthday, formatDate, isBirthdaySoon } from '@/lib/dateUtils'

interface Kontakt {
  id: string
  first_name: string
  last_name: string
  email: string
  phone_mobile?: string
  phone_office?: string
  company_name?: string
  geburtstag?: string
  status: string
  opportunities?: Array<{
    id?: string
    title?: string
    name?: string
    value?: string | number
    status?: string
    created_at?: string
  }>
  [key: string]: any
}

interface Props {
  kontakt: Kontakt
  onSave: (changes: Record<string, any>) => Promise<void>
  isEditing?: boolean
  onEditChange?: (editing: boolean) => void
}

const AccordionSection = memo(({
  title,
  icon,
  statusBadge,
  children,
  isOpen,
  onToggle,
}: {
  title: string
  icon: string
  statusBadge?: { label: string; color: string }
  children: React.ReactNode
  isOpen: boolean
  onToggle: () => void
}) => {
  const statusColors: Record<string, string> = {
    complete: 'bg-green-100 text-green-700',
    partial: 'bg-yellow-100 text-yellow-700',
    open: 'bg-gray-100 text-gray-700',
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{icon}</span>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        </div>
        <div className="flex items-center gap-3">
          {statusBadge && (
            <span className={`text-xs font-medium px-2 py-1 rounded ${statusColors[statusBadge.color] || ''}`}>
              {statusBadge.label}
            </span>
          )}
          <span className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
        </div>
      </button>

      {isOpen && (
        <div className="px-4 py-4 border-t border-gray-100">
          {children}
        </div>
      )}
    </div>
  )
})

AccordionSection.displayName = 'AccordionSection'

export function ContactDetailAnalysisView({ kontakt, onSave, isEditing = false, onEditChange }: Props) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    grunddaten: true,
    unternehmen: true,
    versicherungen: true,
    angebote: true,
    aktivitaeten: false,
    integrations: false,
  })

  const toggleSection = useCallback((section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }))
  }, [])

  // Birthday Logic
  const age = kontakt.geburtstag ? calculateAge(kontakt.geburtstag) : null
  const daysUntilBday = kontakt.geburtstag ? daysUntilBirthday(kontakt.geburtstag) : -1
  const isBirthdayComing = isBirthdaySoon(kontakt.geburtstag, 7)

  return (
    <div className="w-full bg-gray-50 min-h-screen">
      {/* HEADER */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Linke Seite: Profil-Info */}
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                <span className="text-xl">👤</span>
              </div>

              {/* Text-Info */}
              <div>
                <h1 className="text-lg font-semibold text-gray-900">
                  {kontakt.first_name} {kontakt.last_name}
                </h1>
                <p className="text-sm text-gray-600">
                  {kontakt.company_name && <>{kontakt.company_name} • </>}
                  {kontakt.phone_mobile && <>{kontakt.phone_mobile}</>}
                </p>

                {/* Geburtsdatum + Alter */}
                {kontakt.geburtstag && (
                  <p className="text-sm text-gray-600 mt-1">
                    🎂 {formatDate(kontakt.geburtstag, 'de')} ({age} Jahre)
                  </p>
                )}

                {/* Birthday Alert */}
                {isBirthdayComing && (
                  <div className="mt-2 px-3 py-1.5 bg-red-100 text-red-700 rounded text-xs font-medium inline-block">
                    🎉 Geburtstag in {daysUntilBday} {daysUntilBday === 1 ? 'Tag' : 'Tagen'}!
                  </div>
                )}
              </div>
            </div>

            {/* Rechte Seite: Action Buttons */}
            <div className="flex items-center gap-2">
              {/* WhatsApp */}
              <button className="p-2.5 rounded-lg bg-green-500 text-white hover:bg-green-600 transition" title="WhatsApp">
                <span className="text-lg">💬</span>
              </button>

              {/* Email */}
              <button className="p-2.5 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition" title="Email">
                <span className="text-lg">✉️</span>
              </button>

              {/* Call */}
              <button className="p-2.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition" title="Anrufen">
                <span className="text-lg">📞</span>
              </button>

              {/* More */}
              <button className="p-2.5 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition" title="Mehr">
                <span className="text-lg">⋯</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT - 3 Columns */}
      <main className="max-w-[1600px] mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* SPALTE 1: Profil + Notizen (3/12) */}
          <div className="lg:col-span-3 space-y-6">
            {/* Profile Card */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="text-center mb-4">
                <div className="w-20 h-20 rounded-full bg-gray-300 mx-auto mb-3 flex items-center justify-center">
                  <span className="text-4xl">👤</span>
                </div>
                <h3 className="text-base font-semibold text-gray-900">
                  {kontakt.first_name} {kontakt.last_name}
                </h3>
                <p className="text-sm text-gray-600">{kontakt.company_name || '—'}</p>
              </div>

              <div className="space-y-3 text-sm">
                {kontakt.email && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">Email</p>
                    <p className="text-gray-900">{kontakt.email}</p>
                  </div>
                )}
                {kontakt.phone_mobile && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">Telefon</p>
                    <p className="text-gray-900">{kontakt.phone_mobile}</p>
                  </div>
                )}
                {kontakt.city && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">Adresse</p>
                    <p className="text-gray-900">
                      {kontakt.postal_code} {kontakt.city}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Notizen */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 flex flex-col h-64">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span>📝</span> Interne Notizen
              </h3>
              <textarea
                className="flex-1 p-3 border border-gray-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                placeholder="Gesprächsnotizen, Besonderheiten..."
                defaultValue={kontakt.notizen_2 || ''}
              />
            </div>
          </div>

          {/* SPALTE 2: Accordion-Sektionen (6/12) */}
          <div className="lg:col-span-6 space-y-4">
            {/* Grunddaten Section */}
            <AccordionSection
              title="Grunddaten"
              icon="📋"
              statusBadge={{ label: '✓ Vollständig', color: 'complete' }}
              isOpen={openSections.grunddaten}
              onToggle={() => toggleSection('grunddaten')}
            >
              <div className="space-y-4">
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Name:</span> {kontakt.first_name} {kontakt.last_name}
                </p>
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Email:</span> {kontakt.email}
                </p>
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Telefon:</span> {kontakt.phone_mobile || '—'}
                </p>
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Geburtsdatum:</span> {formatDate(kontakt.geburtstag, 'de')} ({age} Jahre)
                </p>
              </div>
            </AccordionSection>

            {/* Unternehmen Section */}
            <AccordionSection
              title="Unternehmen"
              icon="🏢"
              statusBadge={{ label: '◐ Teilweise', color: 'partial' }}
              isOpen={openSections.unternehmen}
              onToggle={() => toggleSection('unternehmen')}
            >
              <div className="space-y-4">
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Firma:</span> {kontakt.company_name || '—'}
                </p>
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Position:</span> {kontakt.position || '—'}
                </p>
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Branche:</span> {kontakt.industry || '—'}
                </p>
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Mitarbeiter:</span> {kontakt.mitarbeitanzahl || '—'}
                </p>
              </div>
            </AccordionSection>

            {/* Versicherungen Section */}
            <AccordionSection
              title="Versicherungen"
              icon="🏥"
              statusBadge={{ label: '○ Offen', color: 'open' }}
              isOpen={openSections.versicherungen}
              onToggle={() => toggleSection('versicherungen')}
            >
              <div className="space-y-4">
                <p className="text-sm text-gray-700">
                  <span className="font-medium">PKV Status:</span> {kontakt.krankenversicherung_status || '—'}
                </p>
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Versicherungstyp:</span> {kontakt.versicherungstyp || '—'}
                </p>
                <div className="text-sm text-gray-600 pt-2 border-t border-gray-100">
                  <p>Versicherungsgesellschaften sind in Tab "Verträge" aufgelistet</p>
                </div>
              </div>
            </AccordionSection>

            {/* Angebote Section */}
            <AccordionSection
              title="Angebote"
              icon="📊"
              statusBadge={{ label: '○ Offen', color: 'open' }}
              isOpen={openSections.angebote}
              onToggle={() => toggleSection('angebote')}
            >
              <div className="space-y-3">
                {kontakt.opportunities && kontakt.opportunities.length > 0 ? (
                  kontakt.opportunities.map((opp: any, idx: number) => (
                    <div key={idx} className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-900">{opp.title || opp.name || 'Angebot'}</p>
                          <p className="text-xs text-gray-600 mt-1">
                            🗓️ Erstellt: {opp.created_at ? new Date(opp.created_at).toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '—'}
                          </p>
                          {opp.value && (
                            <p className="text-xs text-gray-600 mt-0.5">
                              💶 Wert: €{parseFloat(opp.value).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                            </p>
                          )}
                        </div>
                        {opp.status && (
                          <span className="text-xs font-medium px-2 py-1 rounded bg-blue-100 text-blue-700 ml-2 flex-shrink-0">
                            {opp.status}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-gray-500 py-4 text-center">
                    <p>Keine Angebote vorhanden</p>
                    <p className="text-xs mt-1">Angebote werden hier angezeigt, wenn sie erstellt werden</p>
                  </div>
                )}
              </div>
            </AccordionSection>

            {/* Aktivitäten Section */}
            <AccordionSection
              title="Aktivitäten"
              icon="📞"
              isOpen={openSections.aktivitaeten}
              onToggle={() => toggleSection('aktivitaeten')}
            >
              <div className="text-sm text-gray-600">
                <p>Letzte Aktivitäten werden hier angezeigt (in Entwicklung)</p>
              </div>
            </AccordionSection>

            {/* Integrations Section */}
            <AccordionSection
              title="Integrations"
              icon="🔗"
              isOpen={openSections.integrations}
              onToggle={() => toggleSection('integrations')}
            >
              <div className="space-y-3 text-sm">
                {kontakt.klicktipp_tags && (
                  <p className="text-gray-700">
                    <span className="font-medium">KlickTipp Tags:</span> {kontakt.klicktipp_tags.join(', ') || '—'}
                  </p>
                )}
                {kontakt.dialfire_campaign_id && (
                  <p className="text-gray-700">
                    <span className="font-medium">Dialfire:</span> {kontakt.dialfire_campaign_id}
                  </p>
                )}
                {kontakt.facebook_id && (
                  <p className="text-gray-700">
                    <span className="font-medium">Facebook:</span> {kontakt.facebook_id}
                  </p>
                )}
              </div>
            </AccordionSection>
          </div>

          {/* SPALTE 3: Kontakt-Info + Verträge (3/12) */}
          <div className="lg:col-span-3 space-y-6">
            {/* Kontakt-Info Box */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span>ℹ️</span> Kontakt Info
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Status</p>
                  <p className="text-gray-900 mt-1">{kontakt.status || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Quelle</p>
                  <p className="text-gray-900 mt-1">{kontakt.source || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Kontakt-Typ</p>
                  <p className="text-gray-900 mt-1">{kontakt.kontakt_typ || '—'}</p>
                </div>
              </div>
            </div>

            {/* Verträge Placeholder */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span>📄</span> Verträge
              </h3>
              <div className="text-sm text-gray-600">
                <p>Verträge werden hier angezeigt mit Farbcodierung:</p>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-green-100 border-2 border-green-500 rounded"></div>
                    <span className="text-xs">Eigenverträge (Grün)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-100 border-2 border-red-500 rounded"></div>
                    <span className="text-xs">Fremdverträge (Rot)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
