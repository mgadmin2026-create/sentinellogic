'use client'

import { useState, useCallback, memo, useEffect } from 'react'
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
  [key: string]: any
}

interface Contract {
  id: string
  name?: string
  file_name?: string
  created_at?: string
  file_type?: string
  is_own?: boolean
}

interface Props {
  kontakt: Kontakt
  onSave: (changes: Record<string, any>) => Promise<void>
  isEditing?: boolean
  onEditChange?: (editing: boolean) => void
}

// Editable Field Component
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

// Accordion Section
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
      <div className="px-4 py-3 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {children}
      </div>
    )}
  </div>
))

AccordionSection.displayName = 'AccordionSection'

export function ContactDetailAnalysisView({ kontakt, onSave, isEditing = false, onEditChange }: Props) {
  const [editData, setEditData] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)
  const [contracts, setContracts] = useState<Contract[]>([])
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    grunddaten: true,
    unternehmen: true,
    versicherungen: true,
    vertraege: true,
    angebote: true,
    aktivitaeten: false,
  })

  useEffect(() => {
    // Load contracts
    const loadContracts = async () => {
      try {
        const res = await fetch(`/api/kontakte/${kontakt.id}/contracts`)
        if (res.ok) {
          const json = await res.json()
          setContracts(json.data || [])
        }
      } catch (err) {
        console.error('Fehler beim Laden der Verträge:', err)
      }
    }
    loadContracts()
  }, [kontakt.id])

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

  // Birthday Logic
  const age = kontakt.geburtstag ? calculateAge(kontakt.geburtstag) : null
  const daysUntilBday = kontakt.geburtstag ? daysUntilBirthday(kontakt.geburtstag) : -1
  const isBirthdayComing = kontakt.geburtstag ? isBirthdaySoon(kontakt.geburtstag, 7) : false

  return (
    <div className="w-full bg-gray-50 min-h-screen p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Birthday Alert */}
        {isBirthdayComing && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm font-medium text-red-700">
              🎉 Geburtstag in {daysUntilBday} {daysUntilBday === 1 ? 'Tag' : 'Tagen'}!
            </p>
          </div>
        )}

        {/* Edit Mode Indicator + Buttons */}
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

        {/* Grunddaten Section */}
        <AccordionSection
          title="Grunddaten"
          icon="📋"
          isOpen={openSections.grunddaten}
          onToggle={() => toggleSection('grunddaten')}
        >
          <EditableField label="Vorname" field="first_name" value={getValue('first_name')} onChange={handleChange} isEditing={isEditing} />
          <EditableField label="Nachname" field="last_name" value={getValue('last_name')} onChange={handleChange} isEditing={isEditing} />
          <EditableField label="Email" field="email" type="email" value={getValue('email')} onChange={handleChange} isEditing={isEditing} />
          <EditableField label="Telefon Mobil" field="phone_mobile" value={getValue('phone_mobile')} onChange={handleChange} isEditing={isEditing} />
          <EditableField label="Telefon Büro" field="phone_office" value={getValue('phone_office')} onChange={handleChange} isEditing={isEditing} />
          <EditableField label="Geburtsdatum" field="geburtstag" type="date" value={getValue('geburtstag')} onChange={handleChange} isEditing={isEditing} />
          {age && <div><p className="text-xs font-medium text-gray-500 uppercase">Alter</p><p className="text-sm text-gray-900 mt-0.5">{age} Jahre</p></div>}
          <EditableField label="Anrede" field="anrede" value={getValue('anrede')} onChange={handleChange} isEditing={isEditing} />
          <EditableField label="Status" field="status" type="select" options={['new', 'contacted', 'qualified', 'customer']} value={getValue('status')} onChange={handleChange} isEditing={isEditing} />
        </AccordionSection>

        {/* Unternehmen Section */}
        <AccordionSection
          title="Unternehmen"
          icon="🏢"
          isOpen={openSections.unternehmen}
          onToggle={() => toggleSection('unternehmen')}
        >
          <EditableField label="Firma" field="company_name" value={getValue('company_name')} onChange={handleChange} isEditing={isEditing} />
          <EditableField label="Position" field="position" value={getValue('position')} onChange={handleChange} isEditing={isEditing} />
          <EditableField label="Branche" field="industry" value={getValue('industry')} onChange={handleChange} isEditing={isEditing} />
          <EditableField label="Website" field="website" value={getValue('website')} onChange={handleChange} isEditing={isEditing} />
          <EditableField label="Jahresumsatz" field="jahresumsatz" value={getValue('jahresumsatz')} onChange={handleChange} isEditing={isEditing} />
          <EditableField label="Mitarbeiterzahl" field="mitarbeitanzahl" type="number" value={getValue('mitarbeitanzahl')} onChange={handleChange} isEditing={isEditing} />
          <EditableField label="Straße" field="street" value={getValue('street')} onChange={handleChange} isEditing={isEditing} />
          <EditableField label="PLZ" field="postal_code" value={getValue('postal_code')} onChange={handleChange} isEditing={isEditing} />
          <EditableField label="Stadt" field="city" value={getValue('city')} onChange={handleChange} isEditing={isEditing} />
        </AccordionSection>

        {/* Versicherungen Section */}
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
          <EditableField label="Geschlecht" field="geschlecht" type="select" options={['männlich', 'weiblich', 'divers']} value={getValue('geschlecht')} onChange={handleChange} isEditing={isEditing} />
          <EditableField label="Größe (cm)" field="groesse" type="number" value={getValue('groesse')} onChange={handleChange} isEditing={isEditing} />
        </AccordionSection>

        {/* Verträge Section */}
        <AccordionSection
          title="Verträge"
          icon="📄"
          isOpen={openSections.vertraege}
          onToggle={() => toggleSection('vertraege')}
        >
          {contracts.length > 0 ? (
            <div className="col-span-full space-y-2">
              {contracts.map(contract => (
                <div key={contract.id} className="p-3 bg-gray-50 rounded border border-gray-200">
                  <p className="text-sm font-medium text-gray-900">{contract.name || contract.file_name}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    {contract.created_at ? `Hochgeladen: ${new Date(contract.created_at).toLocaleDateString('de-DE')}` : ''}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="col-span-full text-sm text-gray-500 py-4">Keine Verträge vorhanden</div>
          )}
        </AccordionSection>

        {/* Aktivitäten Section */}
        <AccordionSection
          title="Aktivitäten"
          icon="📞"
          isOpen={openSections.aktivitaeten}
          onToggle={() => toggleSection('aktivitaeten')}
        >
          <EditableField label="Kontakt-Typ" field="kontakt_typ" type="select" options={['gewerbe', 'privat']} value={getValue('kontakt_typ')} onChange={handleChange} isEditing={isEditing} />
          <EditableField label="Bestandskunde" field="bestandskunde" type="checkbox" value={getValue('bestandskunde')} onChange={handleChange} isEditing={isEditing} />
          <EditableField label="Qualität" field="qualität" type="select" options={['kalt', 'warm', 'heiss', 'sehr-heiss']} value={getValue('qualität')} onChange={handleChange} isEditing={isEditing} />
          <EditableField label="Bemerkung" field="bemerkung" value={getValue('bemerkung')} onChange={handleChange} isEditing={isEditing} />
        </AccordionSection>
      </div>
    </div>
  )
}
