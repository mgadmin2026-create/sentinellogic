'use client'

import { useState } from 'react'
import { ANGEBOT_STATUS_OPTIONEN, angebotStatusFarbe, angebotStatusLabel, type AngebotStatus } from '@/lib/angebot-status'
import { konvertiereBetrag, ZYKLUS_OPTIONEN, type Zyklus } from '@/lib/beitragsuebersicht-zyklus'
import { formatDate } from '@/lib/utils'

export interface Angebot {
  id: string
  contact_id: string
  name: string
  status: AngebotStatus
  betrag: number | null
  zyklus: Zyklus | null
  sparte: string | null
  leistungsumfang: string | null
  created_at: string
  dokument?: { id: string; file_id: string; file_name: string } | null
}

interface Props {
  kontaktId: string
  kontaktName: string
  angebote: Angebot[]
  onChanged: () => void
}

function emptyForm() {
  return {
    id: undefined as string | undefined,
    name: '',
    status: 'in_erstellung' as AngebotStatus,
    betrag: '',
    zyklus: 'jaehrlich' as Zyklus,
    sparte: '',
    leistungsumfang: '',
  }
}

function monatlicherBeitrag(a: Pick<Angebot, 'betrag' | 'zyklus'>): number {
  if (!a.betrag) return 0
  return konvertiereBetrag(a.betrag, a.zyklus || 'jaehrlich', 'monatlich')
}

function formatEuro(n: number): string {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

export function KontaktAngeboteTab({ kontaktId, kontaktName, angebote, onChanged }: Props) {
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [gewonnenHinweis, setGewonnenHinweis] = useState(false)

  function openNew() {
    setForm(emptyForm())
    setModalOpen(true)
  }

  function openEdit(a: Angebot) {
    setForm({
      id: a.id,
      name: a.name,
      status: a.status,
      betrag: a.betrag !== null ? String(a.betrag) : '',
      zyklus: a.zyklus || 'jaehrlich',
      sparte: a.sparte || '',
      leistungsumfang: a.leistungsumfang || '',
    })
    setModalOpen(true)
  }

  async function save() {
    if (!form.name.trim()) {
      setError('Name ist erforderlich')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const body = {
        contact_id: kontaktId,
        name: form.name.trim(),
        status: form.status,
        betrag: form.betrag || undefined,
        zyklus: form.zyklus,
        sparte: form.sparte || undefined,
        leistungsumfang: form.leistungsumfang || undefined,
      }
      const res = await fetch(form.id ? `/api/angebote/${form.id}` : '/api/angebote', {
        method: form.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Fehler beim Speichern')
      if (form.status === 'gewonnen') setGewonnenHinweis(true)
      setModalOpen(false)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  async function archivieren(id: string) {
    if (!confirm('Angebot wirklich archivieren?')) return
    try {
      const res = await fetch(`/api/angebote/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Fehler')
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Archivieren')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">{angebote.length} Angebote für {kontaktName || 'diesen Kontakt'}</p>
        <button
          onClick={openNew}
          className="px-3 py-1.5 text-sm font-semibold bg-yellow-400 hover:bg-yellow-500 text-gray-900 rounded-lg transition-colors"
        >
          + Angebot erstellen
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>
      )}
      {gewonnenHinweis && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm flex items-center justify-between gap-3">
          <span>✓ Angebot gewonnen — ggf. die Beitragsübersicht dieses Kontakts aktualisieren.</span>
          <button onClick={() => setGewonnenHinweis(false)} className="text-emerald-500 hover:text-emerald-800">✕</button>
        </div>
      )}

      {angebote.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-600">Keine Angebote vorhanden</p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 overflow-hidden">
          {angebote.map((a) => (
            <div key={a.id} className="px-4 py-2.5 hover:bg-gray-50 transition-colors flex items-center gap-3">
              <button onClick={() => openEdit(a)} className="flex-1 min-w-0 text-left">
                <span className="text-sm font-medium text-gray-900 truncate">{a.name}</span>
              </button>
              <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${angebotStatusFarbe(a.status)}`}>
                {angebotStatusLabel(a.status)}
              </span>
              <span className="flex-shrink-0 text-xs text-gray-600 whitespace-nowrap">{formatEuro(monatlicherBeitrag(a))}/Mon.</span>
              {a.dokument && (
                <a
                  href={`https://drive.google.com/file/d/${a.dokument.file_id}/view`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  title={a.dokument.file_name}
                  className="flex-shrink-0 text-xs text-blue-600 hover:text-blue-700"
                >
                  📄
                </a>
              )}
              <span className="flex-shrink-0 text-xs text-gray-400 whitespace-nowrap hidden sm:inline">{formatDate(a.created_at)}</span>
              <button
                onClick={() => archivieren(a.id)}
                className="flex-shrink-0 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded transition"
                title="Archivieren"
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-gray-900">{form.id ? 'Angebot bearbeiten' : 'Angebot erstellen'}</h2>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="z.B. Unternehmerschutz-Paket"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400/40"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Betrag</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.betrag}
                  onChange={(e) => setForm((f) => ({ ...f, betrag: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400/40"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Zyklus</label>
                <select
                  value={form.zyklus}
                  onChange={(e) => setForm((f) => ({ ...f, zyklus: e.target.value as Zyklus }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400/40"
                >
                  {ZYKLUS_OPTIONEN.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as AngebotStatus }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400/40"
              >
                {ANGEBOT_STATUS_OPTIONEN.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Sparte (optional)</label>
              <input
                type="text"
                value={form.sparte}
                onChange={(e) => setForm((f) => ({ ...f, sparte: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400/40"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Leistungsumfang</label>
              <textarea
                value={form.leistungsumfang}
                onChange={(e) => setForm((f) => ({ ...f, leistungsumfang: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400/40"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setModalOpen(false)}
                disabled={saving}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-300 transition disabled:opacity-50"
              >
                Abbrechen
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 px-4 py-2 text-sm font-semibold text-gray-900 bg-yellow-400 hover:bg-yellow-500 disabled:opacity-50 rounded-lg transition"
              >
                {saving ? 'Speichert…' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
