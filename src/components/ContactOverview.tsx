'use client'

import { useState, useCallback, useEffect, memo } from 'react'
import { Field } from '@/components/kontakt/Field'

interface Kontakt {
  id: string
  first_name: string
  last_name: string
  email: string
  phone_mobile?: string
  phone_office?: string
  company_name?: string
  industry?: string
  position?: string
  hausnummer?: string
  street?: string
  postal_code?: string
  city?: string
  country?: string
  amis_identity_document_checked?: boolean
  amis_usage?: string
  website?: string
  source?: string
  status: string
  assigned_user_id?: string
  qualität?: string
  bestandskunde?: boolean
  jahresumsatz?: string
  mitarbeitanzahl?: number
  versicherungstyp?: string
  kontakt_typ?: string
  sparte?: string
  prüfung_grund?: string
  krankenversicherung_status?: string
  situation?: string
  facebook_id?: string
  facebook_phase?: string
  klicktipp_tags?: string[]
  klicktipp_tag_ids?: number[]
  dialfire_campaign_id?: string
  dialfire_task_name_field?: string
  bemerkung?: string
  anrede?: string
  rechtsform?: string
  geburtstag_gf_inhaber?: string
  geschaeftsfuehrer_anzahl?: number
  seit_wann_gewerbe?: string
  versicherungsgesellschaft?: string
  zahlweise?: string
  beitrag_vorsorge?: number
  kontoinhaber?: string
  iban?: string
  // PKV Insurance Fields
  geburtstag?: string
  geschlecht?: string
  jahreseinkommen?: string
  groesse?: number
  gewicht?: number
  gesundheitszustand?: string
  seit_wann_selbststaendig?: string
  dienstverhaltnis?: string
  // Insurance Records (1-5)
  versicherungsgesellschaft_1?: string
  leistungen_1?: string
  aktueller_beitrag_1?: string
  kontoinhaber_1?: string
  iban_1?: string
  versicherungsgesellschaft_2?: string
  leistungen_2?: string
  aktueller_beitrag_2?: string
  kontoinhaber_2?: string
  iban_2?: string
  versicherungsgesellschaft_3?: string
  leistungen_3?: string
  aktueller_beitrag_3?: string
  kontoinhaber_3?: string
  iban_3?: string
  versicherungsgesellschaft_4?: string
  leistungen_4?: string
  aktueller_beitrag_4?: string
  kontoinhaber_4?: string
  iban_4?: string
  versicherungsgesellschaft_5?: string
  leistungen_5?: string
  aktueller_beitrag_5?: string
  kontoinhaber_5?: string
  iban_5?: string
  notizen_2?: string
  archived_at?: string | null
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  qualified: 'bg-emerald-100 text-emerald-800',
  customer: 'bg-purple-100 text-purple-800',
}

const STATUS_LABELS: Record<string, string> = {
  new: 'Neu',
  contacted: 'Kontaktiert',
  qualified: 'Qualifiziert',
  customer: 'Kunde',
}

// Accordion Section Component
const AccordionSection = memo(({
  title,
  icon,
  children,
  isOpen,
  onToggle,
  isPrimary = false,
  sectionId,
}: {
  title: string
  icon: string
  children: React.ReactNode
  isOpen: boolean
  onToggle: () => void
  isPrimary?: boolean
  sectionId?: string
}) => {
  return (
    <div id={sectionId ? `contact-section-${sectionId}` : undefined} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between p-4 sm:p-6 hover:bg-gray-50 transition ${
          isPrimary ? 'cursor-default hover:bg-white' : ''
        }`}
        disabled={isPrimary}
      >
        <h3 className={`text-sm font-semibold text-gray-900 flex items-center gap-2 ${
          isPrimary ? 'text-base' : ''
        }`}>
          <span className="text-base sm:text-lg">{icon}</span>
          {title}
        </h3>
        {!isPrimary && (
          <span className={`transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
            ▼
          </span>
        )}
      </button>

      {(isPrimary || isOpen) && (
        <div className="px-4 sm:px-6 pb-4 sm:pb-6 pt-2 border-t border-gray-100">
          {children}
        </div>
      )}
    </div>
  )
})

AccordionSection.displayName = 'AccordionSection'

interface Props {
  kontakt: Kontakt
  onSave: (changes: Record<string, any>) => Promise<void>
  isEditing?: boolean
  onEditChange?: (editing: boolean) => void
  /** Öffnet und scrollt zur angegebenen Sektion (z.B. 'unternehmen') */
  initialSection?: string
}

export function ContactOverview({ kontakt, onSave, isEditing = false, onEditChange, initialSection }: Props) {
  const [editData, setEditData] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    fetch('/api/users')
      .then((res) => res.json())
      .then((json) => { if (json.success) setTeamMembers(json.data) })
      .catch((err) => console.error('Fehler beim Laden der Team-Mitglieder:', err))
  }, [])

  // Accordion state — Datensektionen standardmäßig offen, nur Technisches (Integrations) zu
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    grunddaten: true,
    beruf: true,
    unternehmen: true,
    versicherung: true,
    versicherung_allgemein: true,
    pkv_versicherungen: true,
    adresse: false,
    integrations: false,
  })

  const toggleSection = useCallback((section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }))
  }, [])

  // Ziel-Sektion (aus einer Kachel heraus) öffnen und in Sicht scrollen
  useEffect(() => {
    if (!initialSection) return
    setOpenSections(prev => ({ ...prev, [initialSection]: true }))
    const timeout = setTimeout(() => {
      document.getElementById(`contact-section-${initialSection}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    }, 50)
    return () => clearTimeout(timeout)
  }, [initialSection])

  const handleChange = useCallback((field: string, value: any) => {
    setEditData(prev => ({ ...prev, [field]: value }))
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await onSave(editData)
      setEditData({})
      onEditChange?.(false)
    } finally {
      setSaving(false)
    }
  }, [editData, onSave, onEditChange])

  const handleCancel = useCallback(() => {
    setEditData({})
    onEditChange?.(false)
  }, [onEditChange])

  const getValue = (field: string) => editData[field] !== undefined ? editData[field] : kontakt[field as keyof Kontakt]

  return (
    <div className={`space-y-4 sm:space-y-6 p-4 sm:p-6 rounded-lg transition-colors ${
      isEditing ? 'bg-yellow-50 border-l-4 border-yellow-400' : ''
    }`}>
      {/* STATUS & QUALITÄT — SINGLE ROW (TOP) */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 sm:gap-4">
          {/* Status (Editable Select) — bei archivierten Kontakten nur Anzeige */}
          {kontakt.archived_at ? (
            <div>
              <p className="text-xs text-gray-500 font-semibold mb-2">Status</p>
              <span className="inline-flex text-xs font-medium px-2.5 py-1 rounded-full bg-gray-200 text-gray-600">
                Archiviert
              </span>
            </div>
          ) : (
            <Field label="Status" field="status" type="select" options={['new', 'contacted', 'qualified', 'customer']} value={getValue('status')} onChange={handleChange} isEditing={isEditing} />
          )}

          {/* Qualität (Dropdown) */}
          <Field label="Qualität" field="qualität" type="select" options={['kalt', 'warm', 'heiss', 'sehr-heiss']} value={getValue('qualität')} onChange={handleChange} isEditing={isEditing} />

          {/* Bestandskunde (Checkbox) */}
          <div>
            <p className="text-xs text-gray-500 font-semibold mb-2">Bestandskunde</p>
            {isEditing ? (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={getValue('bestandskunde') || false}
                  onChange={(e) => handleChange('bestandskunde', e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm font-medium text-gray-900">Ja</span>
              </label>
            ) : (
              <p className="text-sm text-gray-900">{getValue('bestandskunde') ? '✓ Ja' : '—'}</p>
            )}
          </div>

          {/* Verantwortlicher */}
          <Field
            label="Verantwortlicher"
            field="assigned_user_id"
            type="select"
            options={teamMembers.map((m) => ({ value: m.id, label: m.name }))}
            value={getValue('assigned_user_id')}
            onChange={handleChange}
            isEditing={isEditing}
          />
        </div>
      </div>

      {/* GRUNDDATEN: Kontaktdaten + Adresse + Persönliche Daten */}
      <AccordionSection title="Grunddaten" icon="👤" sectionId="grunddaten" isOpen={openSections.grunddaten} onToggle={() => toggleSection('grunddaten')} isPrimary={false}>
        <div className="space-y-6">
          {/* Subsection: Kontaktdaten */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Kontaktdaten</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-4">
              <Field label="Vorname" field="first_name" value={getValue('first_name')} onChange={handleChange} isEditing={isEditing} />
              <Field label="Nachname" field="last_name" value={getValue('last_name')} onChange={handleChange} isEditing={isEditing} />
              <Field label="Anrede" field="anrede" value={getValue('anrede')} onChange={handleChange} isEditing={isEditing} />
              <Field label="E-Mail" field="email" value={getValue('email')} onChange={handleChange} isEditing={isEditing} />
              <Field label="Telefon Mobil" field="phone_mobile" value={getValue('phone_mobile')} onChange={handleChange} isEditing={isEditing} />
              <Field label="Telefon Büro" field="phone_office" value={getValue('phone_office')} onChange={handleChange} isEditing={isEditing} />
            </div>
          </div>

          {/* Subsection: Adresse */}
          <div className="pt-4 border-t border-gray-100">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Adresse</h4>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-4">
                <Field label="Straße" field="street" value={getValue('street')} onChange={handleChange} isEditing={isEditing} />
                <Field label="Hausnummer" field="hausnummer" value={getValue('hausnummer')} onChange={handleChange} isEditing={isEditing} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-4">
                <Field label="PLZ" field="postal_code" value={getValue('postal_code')} onChange={handleChange} isEditing={isEditing} />
                <Field label="Stadt" field="city" value={getValue('city')} onChange={handleChange} isEditing={isEditing} />
                <Field label="Land" field="country" value={getValue('country')} onChange={handleChange} isEditing={isEditing} />
              </div>
            </div>
          </div>

          {/* Subsection: Persönliche Daten */}
          <div className="pt-4 border-t border-gray-100">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Persönliche Daten</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-4">
              <Field label="Geburtstag" field="geburtstag" type="date" value={getValue('geburtstag')} onChange={handleChange} isEditing={isEditing} />
              <Field label="Geschlecht" field="geschlecht" type="select" options={['männlich', 'weiblich', 'divers']} value={getValue('geschlecht')} onChange={handleChange} isEditing={isEditing} />
              <Field label="Größe (cm)" field="groesse" type="number" value={getValue('groesse')} onChange={handleChange} isEditing={isEditing} />
              <Field label="Gewicht (kg)" field="gewicht" type="number" value={getValue('gewicht')} onChange={handleChange} isEditing={isEditing} />
              <Field label="Gesundheitszustand" field="gesundheitszustand" value={getValue('gesundheitszustand')} onChange={handleChange} isEditing={isEditing} />
            </div>
          </div>

          {/* Subsection: Sonstiges */}
          <div className="pt-4 border-t border-gray-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-4">
              <Field label="Quelle" field="source" type="select" options={['facebook', 'tiktok', 'calendly', 'csv', 'email', 'manuell', 'ki_upload']} value={getValue('source')} onChange={handleChange} isEditing={isEditing} />
              <Field label="Kontakt-Typ" field="kontakt_typ" type="select" options={['gewerbe', 'privat']} value={getValue('kontakt_typ') || 'gewerbe'} onChange={handleChange} isEditing={isEditing} />
            </div>
            <div className="mt-4">
              <Field label="Bemerkung [Dialfire]" field="bemerkung" value={getValue('bemerkung')} onChange={handleChange} isEditing={isEditing} />
            </div>
          </div>
        </div>
      </AccordionSection>

      {/* BERUFLICHE SITUATION */}
      <AccordionSection title="Berufliche Situation" icon="💼" sectionId="beruf" isOpen={openSections.beruf} onToggle={() => toggleSection('beruf')}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-4">
          <Field label="Dienstverhältnis" field="dienstverhaltnis" value={getValue('dienstverhaltnis')} onChange={handleChange} isEditing={isEditing} />
          <Field label="Seit wann selbstständig" field="seit_wann_selbststaendig" type="date" value={getValue('seit_wann_selbststaendig')} onChange={handleChange} isEditing={isEditing} />
          <Field label="Jahreseinkommen (€)" field="jahreseinkommen" type="number" value={getValue('jahreseinkommen')} onChange={handleChange} isEditing={isEditing} />
        </div>
      </AccordionSection>

      {/* UNTERNEHMEN & BRANCHE */}
      <AccordionSection
        title="Unternehmen & Branche"
        sectionId="unternehmen"
        icon="🏢"
        isOpen={openSections.unternehmen}
        onToggle={() => toggleSection('unternehmen')}
      >
        <div className="space-y-6">
          {/* Subsection: Grunddaten */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Grunddaten</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-4">
              <Field label="Firma" field="company_name" value={getValue('company_name')} onChange={handleChange} isEditing={isEditing} />
              <Field label="Position" field="position" value={getValue('position')} onChange={handleChange} isEditing={isEditing} />
              <Field label="Branche" field="industry" value={getValue('industry')} onChange={handleChange} isEditing={isEditing} />
              <Field label="Website" field="website" type="url" value={getValue('website')} onChange={handleChange} isEditing={isEditing} />
              <Field label="Jahresumsatz" field="jahresumsatz" value={getValue('jahresumsatz')} onChange={handleChange} isEditing={isEditing} />
              <Field label="Mitarbeiterzahl" field="mitarbeitanzahl" type="number" value={getValue('mitarbeitanzahl')} onChange={handleChange} isEditing={isEditing} />
            </div>
          </div>

          {/* Subsection: Gewerbliche Daten */}
          <div className="pt-4 border-t border-gray-100">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Gewerbliche Daten</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-4">
              <Field label="Rechtsform" field="rechtsform" value={getValue('rechtsform')} onChange={handleChange} isEditing={isEditing} />
              <Field label="Geburtstag GF/Inhaber" field="geburtstag_gf_inhaber" type="date" value={getValue('geburtstag_gf_inhaber')} onChange={handleChange} isEditing={isEditing} />
              <Field label="Geschäftsführer (Anzahl)" field="geschaeftsfuehrer_anzahl" type="number" value={getValue('geschaeftsfuehrer_anzahl')} onChange={handleChange} isEditing={isEditing} />
              <Field label="Seit wann Gewerbe" field="seit_wann_gewerbe" type="date" value={getValue('seit_wann_gewerbe')} onChange={handleChange} isEditing={isEditing} />
            </div>
          </div>
        </div>
      </AccordionSection>

      {/* VORVERSICHERUNGSDATEN */}
      <AccordionSection
        title="Vorversicherungsdaten"
        sectionId="versicherung"
        icon="🛡️"
        isOpen={openSections.versicherung}
        onToggle={() => toggleSection('versicherung')}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-4">
          <Field label="Versicherungsgesellschaft" field="versicherungsgesellschaft" value={getValue('versicherungsgesellschaft')} onChange={handleChange} isEditing={isEditing} />
          <Field label="Zahlweise" field="zahlweise" value={getValue('zahlweise')} onChange={handleChange} isEditing={isEditing} />
          <Field label="Beitrag Vorsorge" field="beitrag_vorsorge" type="number" value={getValue('beitrag_vorsorge')} onChange={handleChange} isEditing={isEditing} />
          <Field label="Versicherungstyp" field="versicherungstyp" value={getValue('versicherungstyp')} onChange={handleChange} isEditing={isEditing} />
          <Field label="Kontoinhaber" field="kontoinhaber" value={getValue('kontoinhaber')} onChange={handleChange} isEditing={isEditing} />
          <Field label="IBAN" field="iban" value={getValue('iban')} onChange={handleChange} isEditing={isEditing} />
          <Field label="Inhaltssumme" field="inhaltssumme" value={getValue('inhaltssumme')} onChange={handleChange} isEditing={isEditing} />
        </div>
      </AccordionSection>

      {/* ALLGEMEINE VERSICHERUNGSDATEN */}
      <AccordionSection
        title="Allgemeine Versicherungsdaten"
        sectionId="versicherung_allgemein"
        icon="📋"
        isOpen={openSections.versicherung_allgemein}
        onToggle={() => toggleSection('versicherung_allgemein')}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-4">
          <Field label="Sparte" field="sparte" value={getValue('sparte')} onChange={handleChange} isEditing={isEditing} />
          <div className="sm:col-span-2">
            <Field label="Prüfungsgrund" field="prüfung_grund" value={getValue('prüfung_grund')} onChange={handleChange} isEditing={isEditing} />
          </div>
          <Field label="Krankenversicherungsstatus" field="krankenversicherung_status" value={getValue('krankenversicherung_status')} onChange={handleChange} isEditing={isEditing} />
          <Field label="Situation" field="situation" value={getValue('situation')} onChange={handleChange} isEditing={isEditing} />
        </div>
      </AccordionSection>

      {/* PKV VERSICHERUNG (Always Visible) */}
      <AccordionSection
        title="PKV Versicherung"
        sectionId="pkv_versicherungen"
        icon="💼"
        isOpen={openSections.pkv_versicherungen}
        onToggle={() => toggleSection('pkv_versicherungen')}
      >
        <div className="space-y-6">
          {/* Versicherungsverträge als Tabelle */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Versicherungsverträge (bis zu 5)</h4>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm bg-white rounded-lg border border-gray-200">
                <thead className="bg-orange-100 border-b border-orange-200">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold text-orange-900">#</th>
                    <th className="text-left px-3 py-2 font-semibold text-orange-900">Versicherungsgesellschaft</th>
                    <th className="text-left px-3 py-2 font-semibold text-orange-900">Leistungen</th>
                    <th className="text-left px-3 py-2 font-semibold text-orange-900">Beitrag €/Monat</th>
                    <th className="text-left px-3 py-2 font-semibold text-orange-900">IBAN</th>
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3, 4, 5].map((num, idx) => (
                    <tr key={`insurance-${num}`} className={idx % 2 === 1 ? 'bg-orange-50' : ''}>
                      <td className="px-3 py-2 font-medium text-gray-900">{num}</td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <input
                            type="text"
                            value={getValue(`versicherungsgesellschaft_${num}`) || ''}
                            onChange={(e) => handleChange(`versicherungsgesellschaft_${num}`, e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-orange-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-orange-400"
                            placeholder="—"
                          />
                        ) : (
                          <span className="text-gray-900">{getValue(`versicherungsgesellschaft_${num}`) || '—'}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <input
                            type="text"
                            value={getValue(`leistungen_${num}`) || ''}
                            onChange={(e) => handleChange(`leistungen_${num}`, e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-orange-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-orange-400"
                            placeholder="—"
                          />
                        ) : (
                          <span className="text-gray-900">{getValue(`leistungen_${num}`) || '—'}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <input
                            type="number"
                            value={getValue(`aktueller_beitrag_${num}`) || ''}
                            onChange={(e) => handleChange(`aktueller_beitrag_${num}`, e.target.value ? parseInt(e.target.value) : null)}
                            className="w-full px-2 py-1 text-xs border border-orange-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-orange-400"
                            placeholder="—"
                          />
                        ) : (
                          <span className="text-gray-900">{getValue(`aktueller_beitrag_${num}`) || '—'}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <input
                            type="text"
                            value={getValue(`iban_${num}`) || ''}
                            onChange={(e) => handleChange(`iban_${num}`, e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-orange-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-orange-400 font-mono"
                            placeholder="—"
                          />
                        ) : (
                          <span className="text-gray-900 font-mono text-xs">{getValue(`iban_${num}`) || '—'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Additional Notes */}
          <div className="pt-4 border-t border-gray-100">
            <Field label="Notizen" field="notizen_2" value={getValue('notizen_2')} onChange={handleChange} isEditing={isEditing} />
          </div>
        </div>
      </AccordionSection>

      {/* ADRESSE — AMIS Verifikation (Collapsible) */}
      <AccordionSection
        title="Adresse & Verifikation"
        sectionId="adresse"
        icon="📍"
        isOpen={openSections.adresse}
        onToggle={() => toggleSection('adresse')}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-4">
          {isEditing ? (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                  checked={getValue('amis_identity_document_checked') ?? true}
                onChange={(e) => handleChange('amis_identity_document_checked', e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm font-medium text-gray-900">Identität per Dokument geprüft</span>
            </label>
          ) : (
            <div>
              <p className="text-xs text-gray-500 font-medium">Identität per Dokument geprüft</p>
                <p className="text-sm text-gray-900 mt-1">{(getValue('amis_identity_document_checked') ?? true) ? '✓ Ja' : '—'}</p>
            </div>
          )}
          <Field label="AMIS Verwendung" field="amis_usage" type="select" options={['privat']} value={getValue('amis_usage') || 'privat'} onChange={handleChange} isEditing={isEditing} />
        </div>
      </AccordionSection>

      {/* SECONDARY SECTION: Integrations (Collapsible) */}
      <AccordionSection
        title="Integrations"
        sectionId="integrations"
        icon="🔗"
        isOpen={openSections.integrations}
        onToggle={() => toggleSection('integrations')}
      >
        <div className="space-y-4 sm:space-y-4">
          {/* Facebook */}
          {kontakt.facebook_id && (
            <div className="p-3 sm:p-4 bg-blue-50 rounded-lg border border-blue-100">
              <h4 className="text-sm font-semibold text-blue-900 mb-2">📱 Facebook</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
                <div>
                  <p className="text-blue-700 font-medium">ID</p>
                  <p className="text-blue-900 font-mono text-xs">{kontakt.facebook_id}</p>
                </div>
                <div>
                  <p className="text-blue-700 font-medium">Phase</p>
                  <p className="text-blue-900">{kontakt.facebook_phase || '—'}</p>
                </div>
              </div>
            </div>
          )}

          {/* KlickTipp */}
          <div>
            <p className="text-xs text-gray-500 font-semibold mb-2">KlickTipp Tags</p>
            <div className="flex flex-wrap gap-2">
              {kontakt.klicktipp_tags && kontakt.klicktipp_tags.length > 0 ? (
                kontakt.klicktipp_tags.map((tag, idx) => (
                  <span key={idx} className="px-2 sm:px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                    {tag}
                    {kontakt.klicktipp_tag_ids && kontakt.klicktipp_tag_ids[idx] && (
                      <span className="ml-1 text-blue-600">({kontakt.klicktipp_tag_ids[idx]})</span>
                    )}
                  </span>
                ))
              ) : (
                <p className="text-sm text-gray-500">—</p>
              )}
            </div>
          </div>

          {/* Dialfire */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-4">
            <div>
              <p className="text-xs text-gray-500 font-semibold">Dialfire Kampagne</p>
              <p className="text-sm text-gray-900 mt-2">{kontakt.dialfire_campaign_id || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-semibold">Dialfire Task</p>
              <p className="text-sm text-gray-900 mt-2">{kontakt.dialfire_task_name_field || '—'}</p>
            </div>
          </div>
        </div>
      </AccordionSection>

      {/* Save/Cancel Buttons (Edit Mode) */}
      {isEditing && (
        <div className="flex gap-3 sticky bottom-0 bg-white border-t border-gray-200 p-4 rounded-b-xl">
          <button
            onClick={handleCancel}
            disabled={saving}
            className="flex-1 border border-gray-200 text-gray-600 font-medium px-4 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            disabled={saving || Object.keys(editData).length === 0}
            className="flex-1 bg-yellow-400 hover:bg-yellow-500 disabled:opacity-50 text-gray-900 font-semibold px-4 py-2 rounded-lg"
          >
            {saving ? 'Speichert…' : 'Speichern'}
          </button>
        </div>
      )}
    </div>
  )
}
