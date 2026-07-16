'use client'

import { useState, useCallback, memo, useEffect } from 'react'
import { calculateAge, daysUntilBirthday, isBirthdaySoon } from '@/lib/dateUtils'

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
  notes?: string
  [key: string]: any
}

interface Props {
  kontakt: Kontakt
  onSave: (changes: Record<string, any>) => Promise<void>
  isEditing?: boolean
  onEditChange?: (editing: boolean) => void
}

const EditableField = memo(({
  label,
  value,
  field,
  type = 'text',
  isEditing,
  onChange,
  options,
}: {
  label: string
  value: any
  field: string
  type?: string
  isEditing: boolean
  onChange: (field: string, value: any) => void
  options?: string[]
}) => {
  if (!isEditing) {
    return (
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase">{label}</p>
        <p className="text-sm text-gray-900 mt-0.5">{value || '—'}</p>
      </div>
    )
  }

  if (type === 'select') {
    return (
      <div>
        <label className="text-xs font-medium text-gray-500 uppercase block mb-1">{label}</label>
        <select
          value={value || ''}
          onChange={(e) => onChange(field, e.target.value)}
          className="w-full text-sm border-2 border-yellow-300 rounded px-2 py-1 bg-yellow-50"
        >
          <option value="">—</option>
          {options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      </div>
    )
  }

  if (type === 'checkbox') {
    return (
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={value || false}
            onChange={(e) => onChange(field, e.target.checked)}
            className="w-4 h-4 rounded border-2 border-yellow-300"
          />
          <span className="text-sm text-gray-900 font-medium">{label}</span>
        </label>
      </div>
    )
  }

  if (type === 'textarea') {
    return (
      <div className="col-span-full">
        <label className="text-xs font-medium text-gray-500 uppercase block mb-1">{label}</label>
        <textarea
          value={value || ''}
          onChange={(e) => onChange(field, e.target.value)}
          className="w-full text-sm border-2 border-yellow-300 rounded px-2 py-1 bg-yellow-50 min-h-20"
        />
      </div>
    )
  }

  return (
    <div>
      <label className="text-xs font-medium text-gray-500 uppercase block mb-1">{label}</label>
      <input
        type={type}
        value={value || ''}
        onChange={(e) => onChange(field, type === 'number' ? (e.target.value ? parseInt(e.target.value) : null) : e.target.value)}
        className="w-full text-sm border-2 border-yellow-300 rounded px-2 py-1 bg-yellow-50"
      />
    </div>
  )
})

EditableField.displayName = 'EditableField'

const AccordionSection = memo(({
  title,
  icon,
  isOpen,
  onToggle,
  children,
}: {
  title: string
  icon: string
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}) => (
  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition"
    >
      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
        <span className="text-lg">{icon}</span> {title}
      </h3>
      <span className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
    </button>
    {isOpen && (
      <div className="px-4 py-3 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {children}
      </div>
    )}
  </div>
))

AccordionSection.displayName = 'AccordionSection'

export function ContactDetailAnalysisView({ kontakt, onSave, isEditing = false, onEditChange }: Props) {
  const [editData, setEditData] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)
  const [expandedBasicFields, setExpandedBasicFields] = useState(false)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    versicherungen: true,
    unternehmen: false,
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

  const getValue = (field: string) => editData[field] !== undefined ? editData[field] : kontakt[field]

  const age = kontakt.geburtstag ? calculateAge(kontakt.geburtstag) : null
  const daysUntilBday = kontakt.geburtstag ? daysUntilBirthday(kontakt.geburtstag) : -1
  const isBirthdayComing = kontakt.geburtstag ? isBirthdaySoon(kontakt.geburtstag, 7) : false

  const basicFields = [
    { label: 'Geburtsdatum', field: 'geburtstag', type: 'date' },
    { label: 'E-Mail', field: 'email', type: 'email' },
    { label: 'Telefon Mobil', field: 'phone_mobile' },
    { label: 'Telefon Büro', field: 'phone_office' },
    { label: 'Firma', field: 'company_name' },
    { label: 'Position', field: 'position' },
    { label: 'Branche', field: 'industry' },
    { label: 'PLZ/Stadt', field: 'city' },
    { label: 'Status', field: 'status', type: 'select', options: ['new', 'contacted', 'qualified', 'customer'] },
    { label: 'Bestandskunde', field: 'bestandskunde', type: 'checkbox' },
  ]

  const visibleBasicFields = expandedBasicFields ? basicFields : basicFields.slice(0, 10)

  return (
    <div className="w-full bg-gray-50 min-h-screen p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Birthday Alert */}
        {isBirthdayComing && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm font-medium text-yellow-800">
              🎉 Geburtstag in {daysUntilBday} {daysUntilBday === 1 ? 'Tag' : 'Tagen'}! ({kontakt.geburtstag && new Date(kontakt.geburtstag).toLocaleDateString('de-DE')})
            </p>
          </div>
        )}

        {/* Edit Mode Bar */}
        {isEditing && (
          <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <span className="text-sm font-semibold text-yellow-800">✏️ Bearbeitungsmodus</span>
            <button
              onClick={handleSave}
              disabled={saving}
              className="ml-auto px-3 py-1.5 text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded disabled:opacity-50"
            >
              {saving ? 'Speichert…' : '✓ Speichern'}
            </button>
            <button
              onClick={() => {
                setEditData({})
                onEditChange?.(false)
              }}
              className="px-3 py-1.5 text-xs font-semibold bg-gray-300 hover:bg-gray-400 text-gray-900 rounded"
            >
              ✕ Abbrechen
            </button>
          </div>
        )}

        {/* 3-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Column 1: Profile (1 col) */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex flex-col items-center gap-3 mb-4 text-center">
              <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-lg">
                {kontakt.first_name?.charAt(0)}{kontakt.last_name?.charAt(0)}
              </div>
              <div>
                <p className="font-semibold text-gray-900">{kontakt.first_name} {kontakt.last_name}</p>
                <p className="text-xs text-gray-600">{kontakt.company_name}</p>
              </div>
            </div>

            <div className="space-y-3 text-sm border-t pt-4">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Geburt</p>
                <p className="text-gray-900 font-medium">{kontakt.geburtstag ? `${new Date(kontakt.geburtstag).toLocaleDateString('de-DE')} (${age})` : '—'}</p>
              </div>
              {daysUntilBday >= 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Nächster Geburtstag</p>
                  <p className="text-gray-900 font-medium">in {daysUntilBday} {daysUntilBday === 1 ? 'Tag' : 'Tagen'}</p>
                </div>
              )}

              {visibleBasicFields.map(field => (
                <div key={field.field}>
                  <p className="text-xs font-medium text-gray-500 uppercase">{field.label}</p>
                  <p className="text-gray-900">{getValue(field.field) || '—'}</p>
                </div>
              ))}

              {basicFields.length > 10 && (
                <button
                  onClick={() => setExpandedBasicFields(!expandedBasicFields)}
                  className="w-full text-xs font-medium text-blue-600 hover:text-blue-700 py-2 border-t mt-2"
                >
                  {expandedBasicFields ? '↑ Weniger anzeigen' : '↓ Mehr anzeigen'}
                </button>
              )}
            </div>
          </div>

          {/* Column 2: Sections (2 cols) */}
          <div className="lg:col-span-2 space-y-4">
            {/* Notizen */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase mb-2">Notizen</p>
              {!isEditing ? (
                <p className="text-sm text-gray-900">{getValue('notes') || '—'}</p>
              ) : (
                <textarea
                  value={getValue('notes') || ''}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  className="w-full text-sm border-2 border-yellow-300 rounded px-2 py-1 bg-yellow-50 min-h-20"
                  placeholder="Notizen..."
                />
              )}
            </div>

            {/* Versicherungen */}
            <AccordionSection
              title="Versicherungen"
              icon="🏥"
              isOpen={openSections.versicherungen}
              onToggle={() => toggleSection('versicherungen')}
            >
              <EditableField label="PKV Status" field="krankenversicherung_status" value={getValue('krankenversicherung_status')} onChange={handleChange} isEditing={isEditing} />
              <EditableField label="Versicherungstyp" field="versicherungstyp" value={getValue('versicherungstyp')} onChange={handleChange} isEditing={isEditing} />
              <EditableField label="Sparte" field="sparte" value={getValue('sparte')} onChange={handleChange} isEditing={isEditing} />
              <EditableField label="Jahreseinkommen" field="jahreseinkommen" type="number" value={getValue('jahreseinkommen')} onChange={handleChange} isEditing={isEditing} />
            </AccordionSection>

            {/* Unternehmen */}
            <AccordionSection
              title="Unternehmen"
              icon="🏢"
              isOpen={openSections.unternehmen}
              onToggle={() => toggleSection('unternehmen')}
            >
              <EditableField label="Jahresumsatz" field="jahresumsatz" value={getValue('jahresumsatz')} onChange={handleChange} isEditing={isEditing} />
              <EditableField label="Mitarbeiter" field="mitarbeitanzahl" type="number" value={getValue('mitarbeitanzahl')} onChange={handleChange} isEditing={isEditing} />
              <EditableField label="Website" field="website" value={getValue('website')} onChange={handleChange} isEditing={isEditing} />
              <EditableField label="Straße" field="street" value={getValue('street')} onChange={handleChange} isEditing={isEditing} />
            </AccordionSection>
          </div>

          {/* Column 3: Contracts & Offers (1 col) */}
          <div className="space-y-4">
            {/* Verträge */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-sm font-semibold text-gray-900 mb-3">📋 Verträge</p>
              <div className="space-y-2 text-xs">
                <div className="bg-gray-50 p-2 rounded border border-gray-200">
                  <div className="flex justify-between items-start">
                    <p className="font-medium text-gray-900">PKV Standard</p>
                    <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs">Aktiv</span>
                  </div>
                  <div className="mt-1 space-y-1 text-gray-600">
                    <p><strong>Sparte:</strong> Krankenversicherung</p>
                    <p><strong>Typ:</strong> Eigenvertrag</p>
                    <p><strong>Beitrag:</strong> €450/M</p>
                    <p><strong>Seit:</strong> 01.03.2023</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Angebote */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-sm font-semibold text-gray-900 mb-3">📄 Angebote</p>
              <div className="space-y-2 text-xs">
                <div className="bg-gray-50 p-2 rounded border border-gray-200">
                  <div className="flex justify-between items-start">
                    <p className="font-medium text-gray-900">Altersvorsorge</p>
                    <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded text-xs">Offen</span>
                  </div>
                  <p className="mt-1 text-gray-600">Erstellt: 15.07.2024</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
