'use client'

import { useState, useCallback } from 'react'

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

interface Props {
  kontakt: Kontakt
  onSave: (changes: Record<string, any>) => Promise<void>
  isEditing?: boolean
  onEditChange?: (editing: boolean) => void
}

export function ContactOverview({ kontakt, onSave, isEditing = false, onEditChange }: Props) {
  const [editData, setEditData] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)

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

  const Field = ({ label, field, type = 'text', options }: { label: string; field: string; type?: string; options?: string[] }) => {
    if (!isEditing) {
      return (
        <div>
          <p className="text-xs text-gray-500 font-semibold uppercase">{label}</p>
          <p className="text-sm text-gray-900 mt-1">{getValue(field) || '—'}</p>
        </div>
      )
    }

    if (type === 'select') {
      return (
        <div>
          <p className="text-xs text-gray-500 font-semibold uppercase">{label}</p>
          <select
            value={getValue(field) || ''}
            onChange={(e) => handleChange(field, e.target.value)}
            className="w-full px-2 py-1 mt-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-yellow-400"
          >
            <option value="">—</option>
            {options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
      )
    }

    return (
      <div>
        <p className="text-xs text-gray-500 font-semibold uppercase">{label}</p>
        <input
          type={type}
          value={getValue(field) || ''}
          onChange={(e) => handleChange(field, type === 'number' ? (e.target.value ? parseInt(e.target.value) : null) : e.target.value)}
          className="w-full px-2 py-1 mt-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-yellow-400"
          placeholder="—"
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Section 1: Kontaktdaten */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">👤 Kontaktdaten</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase">E-Mail</p>
            <p className="text-sm text-gray-900 mt-1">
              <a href={`mailto:${kontakt.email}`} className="text-yellow-600 hover:underline">{kontakt.email}</a>
            </p>
          </div>
          <Field label="Telefon Mobil" field="phone_mobile" />
          <Field label="Telefon Büro" field="phone_office" />
        </div>
        <div className="mt-4">
          <p className="text-xs text-gray-500 font-semibold uppercase">Quelle</p>
          <p className="text-sm text-gray-900 mt-1">{kontakt.source?.toUpperCase() || '—'}</p>
        </div>
      </div>

      {/* Section 2: Unternehmen */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">🏢 Unternehmen</h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Firma" field="company_name" />
          <Field label="Position" field="position" />
          <Field label="Branche" field="industry" />
          <Field label="Website" field="website" type="url" />
          <Field label="Jahresumsatz" field="jahresumsatz" />
          <Field label="Mitarbeiterzahl" field="mitarbeitanzahl" type="number" />
          <div className="col-span-2">
            <Field label="Versicherungstyp" field="versicherungstyp" />
          </div>
        </div>
      </div>

      {/* Section 3: Adresse */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">📍 Adresse</h3>
        <div className="space-y-4">
          <Field label="Straße" field="street" />
          <div className="grid grid-cols-3 gap-4">
            <Field label="PLZ" field="postal_code" />
            <Field label="Ort" field="city" />
            <Field label="Land" field="country" />
          </div>
        </div>
      </div>

      {/* Section 4: Pipeline & Status */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">📊 Pipeline & Status</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <p className="text-xs text-gray-500 font-semibold uppercase">Status</p>
              <p className="text-sm mt-1">
                <span className={`inline-flex text-sm font-medium px-3 py-1.5 rounded-full ${STATUS_COLORS[kontakt.status]}`}>
                  {STATUS_LABELS[kontakt.status]}
                </span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Qualität" field="qualität" type="select" options={['kalt', 'warm', 'heiss', 'sehr-heiss']} />
            <Field label="Verantwortlicher" field="assigned_user_name" />
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
                <p className="text-xs text-gray-500 font-semibold uppercase">Bestandskunde</p>
                <p className="text-sm text-gray-900 mt-2">{getValue('bestandskunde') ? '✓ Ja' : '—'}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section 5: Integrations (Read-Only) */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">🔗 Integrations</h3>
        <div className="space-y-4">
          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase">KlickTipp Tags</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {kontakt.klicktipp_tags && kontakt.klicktipp_tags.length > 0 ? (
                kontakt.klicktipp_tags.map((tag, idx) => (
                  <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 font-semibold uppercase">Dialfire Kampagne</p>
              <p className="text-sm text-gray-900 mt-2">{kontakt.dialfire_campaign_id || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-semibold uppercase">Dialfire Task</p>
              <p className="text-sm text-gray-900 mt-2">{kontakt.dialfire_task_name_field || '—'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Save/Cancel Buttons (nur im Edit-Mode) */}
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
