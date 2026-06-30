'use client'

import { useState, useCallback, memo } from 'react'

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
  street?: string
  postal_code?: string
  city?: string
  country?: string
  website?: string
  source?: string
  status: string
  assigned_user_name?: string
  qualität?: string
  bestandskunde?: boolean
  jahresumsatz?: string
  mitarbeitanzahl?: number
  versicherungstyp?: string
  insurance_product?: string
  facebook_id?: string
  facebook_phase?: string
  klicktipp_tags?: string[]
  klicktipp_tag_ids?: number[]
  dialfire_campaign_id?: string
  dialfire_task_name_field?: string
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

interface FieldProps {
  label: string
  field: string
  type?: string
  options?: string[]
  value: any
  onChange: (field: string, value: any) => void
  isEditing: boolean
}

const Field = memo(({ label, field, type = 'text', options, value, onChange, isEditing }: FieldProps) => {
  if (!isEditing) {
    return (
      <div>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-sm text-gray-900 mt-1">{value || '—'}</p>
      </div>
    )
  }

  if (type === 'select') {
    return (
      <div>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <select
          value={value || ''}
          onChange={(e) => onChange(field, e.target.value)}
          className="w-full px-2 py-1 mt-1 text-sm border-2 border-yellow-300 rounded bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-yellow-400"
        >
          <option value="">—</option>
          {options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      </div>
    )
  }

  return (
    <div>
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <input
        type={type}
        value={value || ''}
        onChange={(e) => onChange(field, type === 'number' ? (e.target.value ? parseInt(e.target.value) : null) : e.target.value)}
        className="w-full px-2 py-1 mt-1 text-sm border-2 border-yellow-300 rounded bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-yellow-400"
        placeholder="—"
      />
    </div>
  )
})

Field.displayName = 'Field'

// Accordion Section Component
const AccordionSection = memo(({
  title,
  icon,
  children,
  isOpen,
  onToggle,
  isPrimary = false
}: {
  title: string
  icon: string
  children: React.ReactNode
  isOpen: boolean
  onToggle: () => void
  isPrimary?: boolean
}) => {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
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
}

export function ContactOverview({ kontakt, onSave, isEditing = false, onEditChange }: Props) {
  const [editData, setEditData] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)

  // Accordion state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    unternehmen: false,
    adresse: false,
    integrations: false,
  })

  const toggleSection = useCallback((section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }))
  }, [])

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
      {/* PRIMARY SECTION 1: Kontaktdaten (Always Open) */}
      <AccordionSection title="Kontaktdaten" icon="👤" isOpen={true} onToggle={() => {}} isPrimary={true}>
        <div className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-4">
            <div>
              <p className="text-xs text-gray-500 font-semibold">E-Mail</p>
              <p className="text-sm text-gray-900 mt-1">
                <a href={`mailto:${kontakt.email}`} className="text-yellow-600 hover:underline">{kontakt.email}</a>
              </p>
            </div>
            <Field label="Telefon Mobil" field="phone_mobile" value={getValue('phone_mobile')} onChange={handleChange} isEditing={isEditing} />
            <Field label="Telefon Büro" field="phone_office" value={getValue('phone_office')} onChange={handleChange} isEditing={isEditing} />
            <div>
              <p className="text-xs text-gray-500 font-semibold">Quelle</p>
              <p className="text-sm text-gray-900 mt-1">{kontakt.source?.toUpperCase() || '—'}</p>
            </div>
          </div>
        </div>
      </AccordionSection>

      {/* PRIMARY SECTION 2: Status (Always Open) */}
      <AccordionSection title="Status & Pipeline" icon="📊" isOpen={true} onToggle={() => {}} isPrimary={true}>
        <div className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-4">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg sm:col-span-1">
              <div className="flex-1">
                <p className="text-xs text-gray-500 font-semibold">Status</p>
                <p className="text-sm mt-1">
                  <span className={`inline-flex text-sm font-medium px-3 py-1.5 rounded-full ${STATUS_COLORS[kontakt.status]}`}>
                    {STATUS_LABELS[kontakt.status]}
                  </span>
                </p>
              </div>
            </div>
            <Field label="Qualität" field="qualität" type="select" options={['kalt', 'warm', 'heiss', 'sehr-heiss']} value={getValue('qualität')} onChange={handleChange} isEditing={isEditing} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-4">
            <Field label="Verantwortlicher" field="assigned_user_name" value={getValue('assigned_user_name')} onChange={handleChange} isEditing={isEditing} />
            {isEditing ? (
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={getValue('bestandskunde') || false}
                    onChange={(e) => handleChange('bestandskunde', e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm font-medium text-gray-900">Bestandskunde</span>
                </label>
              </div>
            ) : (
              <div>
                <p className="text-xs text-gray-500 font-semibold">Bestandskunde</p>
                <p className="text-sm text-gray-900 mt-2">{getValue('bestandskunde') ? '✓ Ja' : '—'}</p>
              </div>
            )}
          </div>
        </div>
      </AccordionSection>

      {/* SECONDARY SECTION: Unternehmen (Collapsible) */}
      <AccordionSection
        title="Firma & Branche"
        icon="🏢"
        isOpen={openSections.unternehmen}
        onToggle={() => toggleSection('unternehmen')}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-4">
          <Field label="Firma" field="company_name" value={getValue('company_name')} onChange={handleChange} isEditing={isEditing} />
          <Field label="Position" field="position" value={getValue('position')} onChange={handleChange} isEditing={isEditing} />
          <Field label="Branche" field="industry" value={getValue('industry')} onChange={handleChange} isEditing={isEditing} />
          <Field label="Website" field="website" type="url" value={getValue('website')} onChange={handleChange} isEditing={isEditing} />
          <Field label="Jahresumsatz" field="jahresumsatz" value={getValue('jahresumsatz')} onChange={handleChange} isEditing={isEditing} />
          <Field label="Mitarbeiterzahl" field="mitarbeitanzahl" type="number" value={getValue('mitarbeitanzahl')} onChange={handleChange} isEditing={isEditing} />
          <div className="sm:col-span-2">
            <Field label="Versicherungsprodukt" field="insurance_product" value={getValue('insurance_product')} onChange={handleChange} isEditing={isEditing} />
          </div>
        </div>
      </AccordionSection>

      {/* SECONDARY SECTION: Adresse (Collapsible) */}
      <AccordionSection
        title="Adresse"
        icon="📍"
        isOpen={openSections.adresse}
        onToggle={() => toggleSection('adresse')}
      >
        <div className="space-y-4 sm:space-y-4">
          <Field label="Straße" field="street" value={getValue('street')} onChange={handleChange} isEditing={isEditing} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-4">
            <Field label="PLZ" field="postal_code" value={getValue('postal_code')} onChange={handleChange} isEditing={isEditing} />
            <Field label="Ort" field="city" value={getValue('city')} onChange={handleChange} isEditing={isEditing} />
            <Field label="Land" field="country" value={getValue('country')} onChange={handleChange} isEditing={isEditing} />
          </div>
        </div>
      </AccordionSection>

      {/* SECONDARY SECTION: Integrations (Collapsible) */}
      <AccordionSection
        title="Integrations"
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
