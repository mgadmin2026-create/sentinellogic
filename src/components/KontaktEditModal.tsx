'use client'
import { useState } from 'react'

interface Kontakt {
  id?: string
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
  status?: string
  notes?: string
  klicktipp_tag?: string
  automation_disabled?: boolean
  qualität?: string
  bestandskunde?: boolean
  jahresumsatz?: string
  mitarbeitanzahl?: number
  versicherungstyp?: string
  assigned_user_name?: string
  dialfire_campaign_id?: string
  dialfire_task_name_field?: string
  klicktipp_tag_ids?: number[]
}

interface Props {
  kontakt?: Kontakt | null
  isOpen: boolean
  onClose: () => void
  onSave: (kontakt: Kontakt) => Promise<void>
}

export function KontaktEditModal({ kontakt, isOpen, onClose, onSave }: Props) {
  const [formData, setFormData] = useState<Kontakt>(
    kontakt || {
      first_name: '',
      last_name: '',
      email: '',
      status: 'new',
    }
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await onSave(formData)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Fehler beim Speichern')
    } finally {
      setLoading(false)
    }
  }

  const isEdit = !!kontakt?.id
  const title = isEdit ? 'Kontakt bearbeiten' : 'Neuer Kontakt'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 sticky top-0 bg-white">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Section 1: Grunddaten */}
          <div className="border-b border-gray-100 pb-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">👤 Grunddaten</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Vorname *</label>
                <input
                  type="text"
                  required
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 text-sm"
                  placeholder="Max"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Nachname *</label>
                <input
                  type="text"
                  required
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 text-sm"
                  placeholder="Mustermann"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">E-Mail *</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 text-sm"
                placeholder="max@example.com"
              />
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Telefon Mobil</label>
                <input
                  type="tel"
                  value={formData.phone_mobile || ''}
                  onChange={(e) => setFormData({ ...formData, phone_mobile: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 text-sm"
                  placeholder="+49 123 456789"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Telefon Büro</label>
                <input
                  type="tel"
                  value={formData.phone_office || ''}
                  onChange={(e) => setFormData({ ...formData, phone_office: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 text-sm"
                  placeholder="+49 40 123456"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Firma */}
          <div className="border-b border-gray-100 pb-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">🏢 Firma</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Firma</label>
                <input
                  type="text"
                  value={formData.company_name || ''}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 text-sm"
                  placeholder="Beispiel GmbH"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Position</label>
                <input
                  type="text"
                  value={formData.position || ''}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 text-sm"
                  placeholder="Geschäftsführer"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Branche</label>
                <input
                  type="text"
                  value={formData.industry || ''}
                  onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 text-sm"
                  placeholder="Versicherungsgewerbe"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Website</label>
                <input
                  type="url"
                  value={formData.website || ''}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 text-sm"
                  placeholder="https://beispiel.de"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Jahresumsatz</label>
                <input
                  type="text"
                  value={formData.jahresumsatz || ''}
                  onChange={(e) => setFormData({ ...formData, jahresumsatz: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 text-sm"
                  placeholder="z.B. 500k-1M"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Mitarbeiterzahl</label>
                <input
                  type="number"
                  value={formData.mitarbeitanzahl || ''}
                  onChange={(e) => setFormData({ ...formData, mitarbeitanzahl: e.target.value ? parseInt(e.target.value) : undefined })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 text-sm"
                  placeholder="50"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Versicherungstyp</label>
              <input
                type="text"
                value={formData.versicherungstyp || ''}
                onChange={(e) => setFormData({ ...formData, versicherungstyp: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 text-sm"
                placeholder="z.B. Krankenversicherung"
              />
            </div>
          </div>

          {/* Section 3: Adresse */}
          <div className="border-b border-gray-100 pb-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">📍 Adresse</h3>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Straße</label>
              <input
                type="text"
                value={formData.street || ''}
                onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 text-sm"
                placeholder="Beispielstraße 42"
              />
            </div>

            <div className="grid grid-cols-3 gap-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">PLZ</label>
                <input
                  type="text"
                  value={formData.postal_code || ''}
                  onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 text-sm"
                  placeholder="20095"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Ort</label>
                <input
                  type="text"
                  value={formData.city || ''}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 text-sm"
                  placeholder="Hamburg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Land</label>
                <input
                  type="text"
                  value={formData.country || ''}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 text-sm"
                  placeholder="Deutschland"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Quelle */}
          <div className="border-b border-gray-100 pb-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">📌 Quelle</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Quelle</label>
                <select
                  value={formData.source || 'manuell'}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 text-sm"
                >
                  <option value="manuell">Manuell</option>
                  <option value="csv">CSV Import</option>
                  <option value="facebook">Facebook</option>
                  <option value="tiktok">TikTok</option>
                  <option value="calendly">Calendly</option>
                  <option value="email">E-Mail</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">KlickTipp Tag (optional)</label>
                <input
                  type="text"
                  value={formData.klicktipp_tag || ''}
                  onChange={(e) => setFormData({ ...formData, klicktipp_tag: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 text-sm"
                  placeholder="z.B. csv-import, test"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Qualität</label>
                <select
                  value={formData.qualität || ''}
                  onChange={(e) => setFormData({ ...formData, qualität: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 text-sm"
                >
                  <option value="">-- Wählen --</option>
                  <option value="kalt">Kalt</option>
                  <option value="warm">Warm</option>
                  <option value="heiss">Heiß</option>
                  <option value="sehr-heiss">Sehr Heiß</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Verantwortlicher</label>
                <input
                  type="text"
                  value={formData.assigned_user_name || ''}
                  onChange={(e) => setFormData({ ...formData, assigned_user_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 text-sm"
                  placeholder="z.B. Max Mustermann"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <input
                type="checkbox"
                id="bestandskunde"
                checked={formData.bestandskunde || false}
                onChange={(e) => setFormData({ ...formData, bestandskunde: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-yellow-500"
              />
              <label htmlFor="bestandskunde" className="text-sm font-medium text-gray-900">
                Bestandskunde
              </label>
            </div>

            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-700">
                💡 <strong>Status & Prozessschritte</strong> werden in der Kontaktübersicht verwaltet.
              </p>
            </div>
          </div>

          {/* Section 5: Automation */}
          <div className="border-b border-gray-100 pb-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">⚙️ Automation</h3>
            <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-900">Automation deaktivieren</p>
                <p className="text-xs text-gray-500 mt-1">Keine automatischen Syncs zu KlickTipp und Dialfire</p>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, automation_disabled: !formData.automation_disabled })}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  formData.automation_disabled ? 'bg-red-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    formData.automation_disabled ? 'translate-x-5.5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Section 6: Notizen */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">📝 Notizen</h3>
            <textarea
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 text-sm h-20 resize-none"
              placeholder="Interne Notizen…"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 border border-gray-200 text-gray-600 font-medium text-sm px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-yellow-400 hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors"
            >
              {loading ? 'Speichert…' : isEdit ? 'Änderungen speichern' : 'Kontakt erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
