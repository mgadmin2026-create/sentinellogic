'use client'
// Lead-Liste — Suche, Filter + vollständiges CRUD (Anlegen, Bearbeiten, Kopieren, Löschen)
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { STATUS_LABELS, STATUS_COLORS, SOURCE_LABELS, SOURCE_COLORS, type LeadStatus, type MockLead } from '@/data/mock'

// ── Filter-Tabs ──────────────────────────────────────────────
const FILTERS: { label: string; value: LeadStatus | 'all' }[] = [
  { label: 'Alle', value: 'all' },
  { label: 'Neu', value: 'new' },
  { label: 'Kontaktiert', value: 'contacted' },
  { label: 'Qualifiziert', value: 'qualified' },
  { label: 'Kunde', value: 'customer' },
]

const SOURCE_OPTIONS = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'calendly', label: 'Calendly' },
  { value: 'csv', label: 'CSV' },
  { value: 'email', label: 'E-Mail' },
]

const STATUS_OPTIONS = [
  { value: 'new', label: 'Neu' },
  { value: 'contacted', label: 'Kontaktiert' },
  { value: 'qualified', label: 'Qualifiziert' },
  { value: 'customer', label: 'Kunde' },
]

// ── Lead-Formular (Anlegen + Bearbeiten) ─────────────────────
interface LeadFormData {
  first_name: string
  last_name: string
  email: string
  phone_mobile: string
  phone_office: string
  company_name: string
  industry: string
  position: string
  address: string
  source: string
  status: string
  notes: string
}

const EMPTY_FORM: LeadFormData = {
  first_name: '', last_name: '', email: '', phone_mobile: '',
  phone_office: '', company_name: '', industry: '', position: '',
  address: '', source: 'facebook', status: 'new', notes: '',
}

function leadToForm(lead: MockLead): LeadFormData {
  return {
    first_name: lead.first_name ?? '',
    last_name: lead.last_name ?? '',
    email: lead.email ?? '',
    phone_mobile: lead.phone_mobile ?? '',
    phone_office: lead.phone_office ?? '',
    company_name: lead.company_name ?? '',
    industry: lead.industry ?? '',
    position: lead.position ?? '',
    address: lead.address ?? '',
    source: lead.source ?? 'csv',
    status: lead.status ?? 'new',
    notes: lead.notes ?? '',
  }
}

// ── Hauptkomponente ──────────────────────────────────────────
export default function LeadsPage() {
  const [allLeads, setAllLeads] = useState<MockLead[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<LeadStatus | 'all'>('all')

  // Modal-States
  const [modalOpen, setModalOpen] = useState(false)
  const [editLead, setEditLead] = useState<MockLead | null>(null) // null = Neu
  const [form, setForm] = useState<LeadFormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  // Löschen-Bestätigung
  const [deleteTarget, setDeleteTarget] = useState<MockLead | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ── Daten laden ────────────────────────────────────────────
  function loadLeads() {
    setLoading(true)
    fetch('/api/leads?limit=200')
      .then((r) => r.json())
      .then((res) => { if (res.success) setAllLeads(res.data) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadLeads() }, [])

  // ── Filtern ────────────────────────────────────────────────
  const filtered = allLeads.filter((lead) => {
    const matchesStatus = activeFilter === 'all' || lead.status === activeFilter
    const q = search.toLowerCase()
    const matchesSearch = !q ||
      `${lead.first_name} ${lead.last_name}`.toLowerCase().includes(q) ||
      (lead.email ?? '').toLowerCase().includes(q) ||
      (lead.company_name ?? '').toLowerCase().includes(q) ||
      (lead.industry ?? '').toLowerCase().includes(q)
    return matchesStatus && matchesSearch
  })

  // ── Modal öffnen ───────────────────────────────────────────
  function openCreate() {
    setEditLead(null)
    setForm(EMPTY_FORM)
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(lead: MockLead) {
    setEditLead(lead)
    setForm(leadToForm(lead))
    setFormError('')
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditLead(null)
    setForm(EMPTY_FORM)
    setFormError('')
  }

  function setField(key: keyof LeadFormData, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  // ── Speichern (Neu oder Bearbeiten) ────────────────────────
  async function handleSave() {
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setFormError('Vorname und Nachname sind Pflichtfelder.')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      const url = editLead ? `/api/leads/${editLead.id}` : '/api/leads'
      const method = editLead ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error ?? 'Unbekannter Fehler')
      closeModal()
      loadLeads()
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Fehler beim Speichern.')
    } finally {
      setSaving(false)
    }
  }

  // ── Kopieren ───────────────────────────────────────────────
  async function handleCopy(lead: MockLead) {
    try {
      const copy = {
        ...leadToForm(lead),
        first_name: lead.first_name,
        last_name: `${lead.last_name} (Kopie)`,
        status: 'new',
      }
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(copy),
      })
      const data = await res.json()
      if (data.success) loadLeads()
    } catch (err) {
      console.error('[Kopieren] Fehler:', err)
    }
  }

  // ── Löschen ────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await fetch(`/api/leads/${deleteTarget.id}`, { method: 'DELETE' })
      setDeleteTarget(null)
      loadLeads()
    } catch (err) {
      console.error('[Löschen] Fehler:', err)
    } finally {
      setDeleting(false)
    }
  }

  // ── Formular-Input Klassen ─────────────────────────────────
  const inputCls = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#FFC300]/40 focus:border-[#FFC300] bg-white'
  const labelCls = 'block text-xs font-medium text-gray-500 mb-1'

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Leads</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {loading ? 'Lädt…' : `${allLeads.length} Leads gesamt`}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-[#FFC300] hover:bg-[#e6b000] text-[#1A1A1A] font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Neuer Lead
        </button>
      </div>

      {/* Suche + Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <svg width="16" height="16" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Name, Firma, E-Mail suchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#FFC300]/40 focus:border-[#FFC300]"
          />
        </div>
        <div className="flex gap-1.5 bg-white border border-gray-200 rounded-lg p-1">
          {FILTERS.map((f) => {
            const count = f.value === 'all' ? allLeads.length : allLeads.filter((l) => l.status === f.value).length
            return (
              <button
                key={f.value}
                onClick={() => setActiveFilter(f.value)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${activeFilter === f.value ? 'bg-[#FFC300] text-[#1A1A1A]' : 'text-gray-500 hover:text-[#1A1A1A] hover:bg-gray-50'}`}
              >
                {f.label}
                <span className={`ml-1.5 text-xs ${activeFilter === f.value ? 'text-[#1A1A1A]/60' : 'text-gray-400'}`}>{count}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Tabelle */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                {['Name', 'Firma', 'Branche', 'Quelle', 'Status', 'Erstellt', 'Aktionen'].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center text-gray-400 py-16 text-sm">Leads werden geladen…</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16">
                    <p className="text-gray-400 text-sm">
                      {allLeads.length === 0 ? 'Noch keine Leads vorhanden.' : 'Keine Leads gefunden.'}
                    </p>
                    {allLeads.length === 0 && (
                      <button onClick={openCreate} className="mt-3 text-sm text-[#FFC300] hover:underline font-medium">
                        + Ersten Lead anlegen
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((lead) => (
                  <tr key={lead.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors group">
                    <td className="px-5 py-3.5">
                      <div>
                        <p className="font-semibold text-[#1A1A1A]">{lead.first_name} {lead.last_name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{lead.email || lead.phone_mobile || '—'}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">{lead.company_name || '—'}</td>
                    <td className="px-5 py-3.5">
                      {lead.industry ? (
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">{lead.industry}</span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex text-xs font-medium px-2.5 py-1 rounded-full ${SOURCE_COLORS[lead.source] ?? 'bg-gray-100 text-gray-600'}`}>
                        {SOURCE_LABELS[lead.source] ?? lead.source}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[lead.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABELS[lead.status] ?? lead.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs">
                      {new Date(lead.created_at).toLocaleDateString('de-DE')}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1">
                        {/* Öffnen */}
                        <Link
                          href={`/leads/${lead.id}`}
                          title="Profil öffnen"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-[#1A1A1A] hover:bg-[#FFC300]/10 transition-all"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                          </svg>
                        </Link>
                        {/* Bearbeiten */}
                        <button
                          title="Bearbeiten"
                          onClick={() => openEdit(lead)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        {/* Kopieren */}
                        <button
                          title="Kopieren"
                          onClick={() => handleCopy(lead)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                          </svg>
                        </button>
                        {/* Löschen */}
                        <button
                          title="Löschen"
                          onClick={() => setDeleteTarget(lead)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/40">
            <p className="text-xs text-gray-400">{filtered.length} von {allLeads.length} Leads angezeigt</p>
          </div>
        )}
      </div>

      {/* ── Lead anlegen / bearbeiten Modal ────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-[#1A1A1A]">
                {editLead ? 'Lead bearbeiten' : 'Neuer Lead'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Formular */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Pflichtfelder */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Kontaktdaten</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Vorname <span className="text-red-400">*</span></label>
                    <input className={inputCls} value={form.first_name} onChange={(e) => setField('first_name', e.target.value)} placeholder="z.B. Thomas" />
                  </div>
                  <div>
                    <label className={labelCls}>Nachname <span className="text-red-400">*</span></label>
                    <input className={inputCls} value={form.last_name} onChange={(e) => setField('last_name', e.target.value)} placeholder="z.B. Müller" />
                  </div>
                  <div>
                    <label className={labelCls}>E-Mail</label>
                    <input className={inputCls} type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder="name@firma.de" />
                  </div>
                  <div>
                    <label className={labelCls}>Telefon Mobil</label>
                    <input className={inputCls} value={form.phone_mobile} onChange={(e) => setField('phone_mobile', e.target.value)} placeholder="+49 176 …" />
                  </div>
                  <div>
                    <label className={labelCls}>Telefon Büro</label>
                    <input className={inputCls} value={form.phone_office} onChange={(e) => setField('phone_office', e.target.value)} placeholder="+49 89 …" />
                  </div>
                  <div>
                    <label className={labelCls}>Adresse</label>
                    <input className={inputCls} value={form.address} onChange={(e) => setField('address', e.target.value)} placeholder="Musterstr. 1, 80000 München" />
                  </div>
                </div>
              </div>

              {/* Firma */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Firma</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Firmenname</label>
                    <input className={inputCls} value={form.company_name} onChange={(e) => setField('company_name', e.target.value)} placeholder="Müller GmbH" />
                  </div>
                  <div>
                    <label className={labelCls}>Branche</label>
                    <input className={inputCls} value={form.industry} onChange={(e) => setField('industry', e.target.value)} placeholder="z.B. Gastronomie" />
                  </div>
                  <div>
                    <label className={labelCls}>Position</label>
                    <input className={inputCls} value={form.position} onChange={(e) => setField('position', e.target.value)} placeholder="z.B. Geschäftsführer" />
                  </div>
                </div>
              </div>

              {/* Klassifizierung */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Klassifizierung</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Quelle</label>
                    <select className={inputCls} value={form.source} onChange={(e) => setField('source', e.target.value)}>
                      {SOURCE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Status</label>
                    <select className={inputCls} value={form.status} onChange={(e) => setField('status', e.target.value)}>
                      {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Notizen */}
              <div>
                <label className={labelCls}>Notizen</label>
                <textarea
                  className={`${inputCls} resize-none`}
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setField('notes', e.target.value)}
                  placeholder="Erste Eindrücke, Besonderheiten…"
                />
              </div>

              {formError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
                  {formError}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={closeModal} className="flex-1 border border-gray-200 text-gray-600 font-medium text-sm px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors">
                Abbrechen
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-[#FFC300] hover:bg-[#e6b000] disabled:opacity-50 text-[#1A1A1A] font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors"
              >
                {saving ? 'Speichert…' : editLead ? 'Änderungen speichern' : 'Lead anlegen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Löschen-Bestätigung ─────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
            </div>
            <h3 className="text-lg font-bold text-[#1A1A1A] mb-1">Lead löschen?</h3>
            <p className="text-sm text-gray-500 mb-1">
              <span className="font-semibold">{deleteTarget.first_name} {deleteTarget.last_name}</span>
            </p>
            <p className="text-sm text-gray-400 mb-5">Diese Aktion kann nicht rückgängig gemacht werden.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 border border-gray-200 text-gray-600 font-medium text-sm px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors"
              >
                {deleting ? 'Löscht…' : 'Löschen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
