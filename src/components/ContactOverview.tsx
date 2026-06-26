'use client'

import { useState } from 'react'

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
  onUpdate: (field: string, value: any) => void
}

export function ContactOverview({ kontakt, onUpdate }: Props) {
  return (
    <div className="space-y-6">
      {/* Section 1: Kontaktdaten */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">👤 Kontaktdaten</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase">E-Mail</p>
            <p className="text-sm text-gray-900 mt-1">
              <a href={`mailto:${kontakt.email}`} className="text-yellow-600 hover:underline">
                {kontakt.email}
              </a>
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase">Telefon Mobil</p>
            <input
              type="tel"
              value={kontakt.phone_mobile || ''}
              onChange={(e) => onUpdate('phone_mobile', e.target.value)}
              className="w-full px-2 py-1 mt-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-yellow-400"
              placeholder="—"
            />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase">Telefon Büro</p>
            <input
              type="tel"
              value={kontakt.phone_office || ''}
              onChange={(e) => onUpdate('phone_office', e.target.value)}
              className="w-full px-2 py-1 mt-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-yellow-400"
              placeholder="—"
            />
          </div>
        </div>
        <div className="mt-4">
          <p className="text-xs text-gray-500 font-semibold uppercase">Quelle</p>
          <p className="text-sm text-gray-900 mt-1">{kontakt.source ? kontakt.source.toUpperCase() : '—'}</p>
        </div>
      </div>

      {/* Section 2: Unternehmen */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">🏢 Unternehmen</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase">Firma</p>
            <input
              type="text"
              value={kontakt.company_name || ''}
              onChange={(e) => onUpdate('company_name', e.target.value)}
              className="w-full px-2 py-1 mt-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-yellow-400"
              placeholder="—"
            />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase">Position</p>
            <input
              type="text"
              value={kontakt.position || ''}
              onChange={(e) => onUpdate('position', e.target.value)}
              className="w-full px-2 py-1 mt-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-yellow-400"
              placeholder="—"
            />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase">Branche</p>
            <input
              type="text"
              value={kontakt.industry || ''}
              onChange={(e) => onUpdate('industry', e.target.value)}
              className="w-full px-2 py-1 mt-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-yellow-400"
              placeholder="—"
            />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase">Website</p>
            <input
              type="url"
              value={kontakt.website || ''}
              onChange={(e) => onUpdate('website', e.target.value)}
              className="w-full px-2 py-1 mt-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-yellow-400"
              placeholder="https://..."
            />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase">Jahresumsatz</p>
            <input
              type="text"
              value={kontakt.jahresumsatz || ''}
              onChange={(e) => onUpdate('jahresumsatz', e.target.value)}
              className="w-full px-2 py-1 mt-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-yellow-400"
              placeholder="z.B. 500k-1M"
            />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase">Mitarbeiterzahl</p>
            <input
              type="number"
              value={kontakt.mitarbeitanzahl || ''}
              onChange={(e) => onUpdate('mitarbeitanzahl', e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-2 py-1 mt-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-yellow-400"
              placeholder="—"
            />
          </div>
          <div className="col-span-2">
            <p className="text-xs text-gray-500 font-semibold uppercase">Versicherungstyp</p>
            <input
              type="text"
              value={kontakt.versicherungstyp || ''}
              onChange={(e) => onUpdate('versicherungstyp', e.target.value)}
              className="w-full px-2 py-1 mt-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-yellow-400"
              placeholder="—"
            />
          </div>
        </div>
      </div>

      {/* Section 3: Adresse */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">📍 Adresse</h3>
        <div className="space-y-4">
          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase">Straße</p>
            <input
              type="text"
              value={kontakt.street || ''}
              onChange={(e) => onUpdate('street', e.target.value)}
              className="w-full px-2 py-1 mt-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-yellow-400"
              placeholder="—"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-500 font-semibold uppercase">PLZ</p>
              <input
                type="text"
                value={kontakt.postal_code || ''}
                onChange={(e) => onUpdate('postal_code', e.target.value)}
                className="w-full px-2 py-1 mt-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-yellow-400"
                placeholder="—"
              />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-semibold uppercase">Ort</p>
              <input
                type="text"
                value={kontakt.city || ''}
                onChange={(e) => onUpdate('city', e.target.value)}
                className="w-full px-2 py-1 mt-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-yellow-400"
                placeholder="—"
              />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-semibold uppercase">Land</p>
              <input
                type="text"
                value={kontakt.country || ''}
                onChange={(e) => onUpdate('country', e.target.value)}
                className="w-full px-2 py-1 mt-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-yellow-400"
                placeholder="—"
              />
            </div>
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
            <div>
              <p className="text-xs text-gray-500 font-semibold uppercase">Qualität</p>
              <select
                value={kontakt.qualität || ''}
                onChange={(e) => onUpdate('qualität', e.target.value)}
                className="w-full px-2 py-1 mt-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-yellow-400"
              >
                <option value="">—</option>
                <option value="kalt">Kalt</option>
                <option value="warm">Warm</option>
                <option value="heiss">Heiß</option>
                <option value="sehr-heiss">Sehr Heiß</option>
              </select>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-semibold uppercase">Verantwortlicher</p>
              <input
                type="text"
                value={kontakt.assigned_user_name || ''}
                onChange={(e) => onUpdate('assigned_user_name', e.target.value)}
                className="w-full px-2 py-1 mt-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-yellow-400"
                placeholder="—"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={kontakt.bestandskunde || false}
                  onChange={(e) => onUpdate('bestandskunde', e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm font-medium text-gray-900">Bestandskunde</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Section 5: Integrations */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">🔗 Integrations</h3>
        <div className="space-y-4">
          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase">KlickTipp Tags</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {kontakt.klicktipp_tags && kontakt.klicktipp_tags.length > 0 ? (
                <>
                  {kontakt.klicktipp_tags.map((tag, idx) => (
                    <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                      {tag}
                      {kontakt.klicktipp_tag_ids && kontakt.klicktipp_tag_ids[idx] && (
                        <span className="ml-1 text-blue-600">({kontakt.klicktipp_tag_ids[idx]})</span>
                      )}
                    </span>
                  ))}
                </>
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
    </div>
  )
}
