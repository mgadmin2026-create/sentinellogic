'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ContactSearchSelect, type ContactSearchSelectOption } from '@/components/ContactSearchSelect'
import { ANGEBOT_STATUS_OPTIONEN, angebotStatusLabel, angebotStatusFarbe, type AngebotStatus } from '@/lib/angebot-status'
import { konvertiereBetrag, ZYKLUS_OPTIONEN, type Zyklus } from '@/lib/beitragsuebersicht-zyklus'
import { formatDate } from '@/lib/utils'

interface Angebot {
  id: string
  contact_id: string
  name: string
  status: AngebotStatus
  betrag: number | null
  zyklus: Zyklus | null
  sparte: string | null
  leistungsumfang: string | null
  dokument_id: string | null
  created_at: string
  contact?: {
    id: string
    first_name: string
    last_name: string
    assigned_user?: { id: string; name: string } | null
  } | null
  dokument?: { id: string; file_id: string; file_name: string } | null
}

function monatlicherBeitrag(a: Pick<Angebot, 'betrag' | 'zyklus'>): number {
  if (!a.betrag) return 0
  return konvertiereBetrag(a.betrag, a.zyklus || 'jaehrlich', 'monatlich')
}

function formatEuro(n: number): string {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

function emptyForm() {
  return {
    id: undefined as string | undefined,
    contact_id: undefined as string | undefined,
    name: '',
    status: 'in_erstellung' as AngebotStatus,
    betrag: '',
    zyklus: 'jaehrlich' as Zyklus,
    sparte: '',
    leistungsumfang: '',
  }
}

export default function AngebotePage() {
  const [angebote, setAngebote] = useState<Angebot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ansicht, setAnsicht] = useState<'karten' | 'liste'>('karten')
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'alle' | AngebotStatus>('alle')
  const [kontakte, setKontakte] = useState<ContactSearchSelectOption[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [gewonnenHinweis, setGewonnenHinweis] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverStatus, setDragOverStatus] = useState<AngebotStatus | null>(null)

  useEffect(() => {
    const gespeichert = localStorage.getItem('angebote-ansicht')
    if (gespeichert === 'karten' || gespeichert === 'liste') setAnsicht(gespeichert)
    load()
    fetch('/api/kontakte?limit=1000')
      .then((r) => r.json())
      .then((d) => { if (d.success) setKontakte(d.data) })
      .catch(() => {})
  }, [])

  function setAnsichtUndSpeichern(v: 'karten' | 'liste') {
    setAnsicht(v)
    localStorage.setItem('angebote-ansicht', v)
  }

  async function load() {
    try {
      setLoading(true)
      const res = await fetch('/api/angebote', { cache: 'no-store' })
      const data = await res.json()
      if (data.success) setAngebote(data.data)
      else setError(data.error || 'Fehler beim Laden')
    } catch {
      setError('Angebote konnten nicht geladen werden')
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return angebote.filter((a) => {
      if (filterStatus !== 'alle' && a.status !== filterStatus) return false
      if (!q) return true
      const kontaktName = a.contact ? `${a.contact.first_name} ${a.contact.last_name}`.toLowerCase() : ''
      return a.name.toLowerCase().includes(q) || kontaktName.includes(q)
    })
  }, [angebote, search, filterStatus])

  function openNew() {
    setForm(emptyForm())
    setModalOpen(true)
  }

  function openEdit(a: Angebot) {
    setForm({
      id: a.id,
      contact_id: a.contact_id,
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
    if (!form.contact_id || !form.name.trim()) {
      setError('Kontakt und Name sind erforderlich')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const body = {
        contact_id: form.contact_id,
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
      if (form.status === 'gewonnen') {
        setGewonnenHinweis(data.data.id)
      }
      setModalOpen(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  async function changeStatus(a: Angebot, status: AngebotStatus) {
    try {
      const res = await fetch(`/api/angebote/${a.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Fehler')
      if (status === 'gewonnen') setGewonnenHinweis(a.id)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status konnte nicht geändert werden')
    }
  }

  async function archivieren(id: string) {
    if (!confirm('Angebot wirklich archivieren?')) return
    try {
      const res = await fetch(`/api/angebote/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Fehler')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Archivieren')
    }
  }

  const spalten = ANGEBOT_STATUS_OPTIONEN.map((o) => ({
    ...o,
    items: filtered.filter((a) => a.status === o.value),
  }))

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-full">
      <div className="flex items-center justify-between mb-3 gap-4 flex-wrap">
        <div className="flex items-center gap-1.5">
          <h1 className="text-2xl font-bold text-gray-900">Angebote</h1>
          <span className="text-sm text-gray-400 ml-1">{filtered.length} Angebote</span>
        </div>
        <button
          onClick={openNew}
          className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold text-sm px-4 py-2 rounded-lg transition-colors"
        >
          + Angebot erstellen
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>
      )}

      {gewonnenHinweis && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm flex items-center justify-between gap-3">
          <span>✓ Angebot gewonnen — ggf. die Beitragsübersicht des Kontakts aktualisieren.</span>
          <div className="flex items-center gap-3">
            {(() => {
              const a = angebote.find((x) => x.id === gewonnenHinweis)
              return a ? (
                <Link href={`/kontakte/${a.contact_id}`} className="font-semibold underline whitespace-nowrap">
                  Zum Kontakt →
                </Link>
              ) : null
            })()}
            <button onClick={() => setGewonnenHinweis(null)} className="text-emerald-500 hover:text-emerald-800">✕</button>
          </div>
        </div>
      )}

      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => setAnsichtUndSpeichern('karten')}
            className={`px-3 py-1.5 text-sm font-medium ${ansicht === 'karten' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            Karten
          </button>
          <button
            onClick={() => setAnsichtUndSpeichern('liste')}
            className={`px-3 py-1.5 text-sm font-medium ${ansicht === 'liste' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            Liste
          </button>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Nach Name oder Kontakt suchen…"
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm flex-1 min-w-[14rem] max-w-xs focus:outline-none focus:ring-2 focus:ring-yellow-400/40"
        />
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterStatus('alle')}
            className={`px-2.5 py-1 rounded-full text-xs font-medium ${filterStatus === 'alle' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'}`}
          >
            Alle
          </button>
          {ANGEBOT_STATUS_OPTIONEN.map((o) => (
            <button
              key={o.value}
              onClick={() => setFilterStatus(o.value)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium ${filterStatus === o.value ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Wird geladen…</div>
      ) : ansicht === 'karten' ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {spalten.map((spalte) => {
            const summe = spalte.items.reduce((sum, a) => sum + monatlicherBeitrag(a), 0)
            return (
              <div
                key={spalte.value}
                className="flex-shrink-0 w-72"
                onDragOver={(e) => { e.preventDefault(); setDragOverStatus(spalte.value) }}
                onDragLeave={() => setDragOverStatus((s) => (s === spalte.value ? null : s))}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOverStatus(null)
                  const angebotId = e.dataTransfer.getData('text/plain')
                  const angebot = angebote.find((x) => x.id === angebotId)
                  if (angebot && angebot.status !== spalte.value) changeStatus(angebot, spalte.value)
                }}
              >
                <div className="bg-gray-50 border border-gray-200 rounded-t-xl px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-gray-900 text-sm">{spalte.label}</p>
                    <span className="text-xs text-gray-400">{spalte.items.length}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{formatEuro(summe)} / Monat</p>
                </div>
                <div
                  className={`border border-t-0 rounded-b-xl min-h-[8rem] p-2 space-y-2 transition-colors ${
                    dragOverStatus === spalte.value ? 'bg-yellow-50 border-yellow-300' : 'bg-white border-gray-200'
                  }`}
                >
                  {spalte.items.map((a) => (
                    <div
                      key={a.id}
                      draggable
                      onDragStart={(e) => { e.dataTransfer.setData('text/plain', a.id); setDraggingId(a.id) }}
                      onDragEnd={() => setDraggingId(null)}
                      onClick={() => openEdit(a)}
                      className={`w-full text-left p-3 border border-gray-200 rounded-lg hover:border-yellow-300 hover:shadow-sm transition-all bg-white cursor-grab active:cursor-grabbing ${
                        draggingId === a.id ? 'opacity-40' : ''
                      }`}
                    >
                      <p className="text-sm font-medium text-gray-900 truncate">{a.name}</p>
                      {a.contact && (
                        <p className="text-xs text-blue-600 truncate mt-0.5">{a.contact.first_name} {a.contact.last_name}</p>
                      )}
                      {a.contact?.assigned_user && (
                        <p className="text-[11px] text-gray-400 truncate mt-0.5">👤 {a.contact.assigned_user.name}</p>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs font-semibold text-gray-700">{formatEuro(monatlicherBeitrag(a))} /Mon.</span>
                        <div className="flex items-center gap-1.5">
                          {a.dokument && (
                            <a
                              href={`https://drive.google.com/file/d/${a.dokument.file_id}/view`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title={a.dokument.file_name}
                              className="text-xs text-blue-600 hover:text-blue-700"
                            >
                              📄
                            </a>
                          )}
                          {a.sparte && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700">{a.sparte}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/80">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Name</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Kontakt</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 hidden lg:table-cell">Verantwortlich</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Mtl. Beitrag</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Status</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 hidden md:table-cell">Leistungsumfang</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 hidden sm:table-cell">Dokument</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 hidden sm:table-cell">Datum</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center text-gray-400 py-16 text-sm">
                      {search ? 'Keine Treffer' : 'Noch keine Angebote angelegt'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((a) => (
                    <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900 max-w-[16rem] truncate">{a.name}</td>
                      <td className="px-4 py-3">
                        {a.contact ? (
                          <Link href={`/kontakte/${a.contact_id}`} className="text-blue-600 hover:underline">
                            {a.contact.first_name} {a.contact.last_name}
                          </Link>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">{a.contact?.assigned_user?.name || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatEuro(monatlicherBeitrag(a))}</td>
                      <td className="px-4 py-3">
                        <select
                          value={a.status}
                          onChange={(e) => changeStatus(a, e.target.value as AngebotStatus)}
                          className={`px-2 py-1 rounded-full text-xs font-medium border-0 focus:outline-none focus:ring-2 focus:ring-yellow-400 ${angebotStatusFarbe(a.status)}`}
                        >
                          {ANGEBOT_STATUS_OPTIONEN.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-gray-600 hidden md:table-cell max-w-[16rem] truncate">{a.leistungsumfang || '—'}</td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        {a.dokument ? (
                          <a
                            href={`https://drive.google.com/file/d/${a.dokument.file_id}/view`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={a.dokument.file_name}
                            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                          >
                            📄 Öffnen ↗
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap hidden sm:table-cell">{formatDate(a.created_at)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button onClick={() => openEdit(a)} className="text-xs text-gray-500 hover:text-gray-800 mr-3">Bearbeiten</button>
                        <button onClick={() => archivieren(a.id)} className="text-xs text-red-500 hover:text-red-700">Archivieren</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-gray-900">{form.id ? 'Angebot bearbeiten' : 'Angebot erstellen'}</h2>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Kontakt *</label>
              <ContactSearchSelect
                kontakte={kontakte}
                value={form.contact_id}
                onChange={(id) => setForm((f) => ({ ...f, contact_id: id }))}
                clearLabel="Kein Kontakt gewählt"
              />
            </div>

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
