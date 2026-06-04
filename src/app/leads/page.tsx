'use client'
// Lead-Liste — vollständiges CRUD mit Tabs, Duplikatprüfung, Kopieren
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { STATUS_LABELS, STATUS_COLORS, SOURCE_LABELS, SOURCE_COLORS, type LeadStatus, type MockLead } from '@/data/mock'

// ── Konfiguration ────────────────────────────────────────────
const FILTERS: { label: string; value: LeadStatus | 'all' }[] = [
  { label: 'Alle', value: 'all' },
  { label: 'Neu', value: 'new' },
  { label: 'Kontaktiert', value: 'contacted' },
  { label: 'Qualifiziert', value: 'qualified' },
  { label: 'Kunde', value: 'customer' },
]
const SOURCE_OPTIONS = [
  { value: 'manuell', label: 'Manuell' },
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
const LEGAL_FORMS = ['', 'GmbH', 'UG', 'AG', 'GbR', 'OHG', 'KG', 'GmbH & Co. KG', 'Einzelunternehmen', 'Freiberufler']
const MARITAL_OPTIONS = ['', 'ledig', 'verheiratet', 'geschieden', 'verwitwet', 'eingetragene Lebenspartnerschaft']
const INSURANCE_LIST = ['BHV', 'KFZ', 'Rechtsschutz', 'Kranken', 'Leben', 'Rente', 'Cyber', 'D&O', 'Berufshaftpflicht', 'Bauleistung', 'Inhaltsversicherung', 'Betriebsunterbrechung', 'Praxisausfall', 'BU']

// ── Formular-Typen ───────────────────────────────────────────
interface LeadFormData {
  // Kontakt
  first_name: string; last_name: string; email: string
  phone_mobile: string; phone_office: string
  birth_date: string; marital_status: string; children: string
  profession: string; profession_group: string; position: string
  // Adresse
  street: string; postal_code: string; city: string; country: string
  // Firma
  company_name: string; legal_form: string; founded_year: string
  employees: string; annual_revenue: string; trade_register: string
  vat_id: string; industry: string; business_description: string
  website: string; headquarters: string
  // Versicherung
  existing_insurances: string[]
  current_providers: string; monthly_premium: string; coverage_gaps: string
  // Intern
  source: string; status: string; notes: string
}

const EMPTY_FORM: LeadFormData = {
  first_name: '', last_name: '', email: '', phone_mobile: '', phone_office: '',
  birth_date: '', marital_status: '', children: '', profession: '', profession_group: '', position: '',
  street: '', postal_code: '', city: '', country: 'Deutschland',
  company_name: '', legal_form: '', founded_year: '', employees: '', annual_revenue: '',
  trade_register: '', vat_id: '', industry: '', business_description: '', website: '', headquarters: '',
  existing_insurances: [], current_providers: '', monthly_premium: '', coverage_gaps: '',
  source: 'manuell', status: 'new', notes: '',
}

function leadToForm(lead: MockLead & Record<string, unknown>): LeadFormData {
  return {
    first_name: (lead.first_name as string) ?? '',
    last_name: (lead.last_name as string) ?? '',
    email: (lead.email as string) ?? '',
    phone_mobile: (lead.phone_mobile as string) ?? '',
    phone_office: (lead.phone_office as string) ?? '',
    birth_date: lead.birth_date ? String(lead.birth_date).split('T')[0] : '',
    marital_status: (lead.marital_status as string) ?? '',
    children: lead.children != null ? String(lead.children) : '',
    profession: (lead.profession as string) ?? '',
    profession_group: (lead.profession_group as string) ?? '',
    position: (lead.position as string) ?? '',
    street: (lead.street as string) ?? '',
    postal_code: (lead.postal_code as string) ?? '',
    city: (lead.city as string) ?? '',
    country: (lead.country as string) ?? 'Deutschland',
    company_name: (lead.company_name as string) ?? '',
    legal_form: (lead.legal_form as string) ?? '',
    founded_year: lead.founded_year != null ? String(lead.founded_year) : '',
    employees: lead.employees != null ? String(lead.employees) : '',
    annual_revenue: (lead.annual_revenue as string) ?? '',
    trade_register: (lead.trade_register as string) ?? '',
    vat_id: (lead.vat_id as string) ?? '',
    industry: (lead.industry as string) ?? '',
    business_description: (lead.business_description as string) ?? '',
    website: (lead.website as string) ?? '',
    headquarters: (lead.headquarters as string) ?? '',
    existing_insurances: Array.isArray(lead.existing_insurances) ? lead.existing_insurances as string[] : [],
    current_providers: (lead.current_providers as string) ?? '',
    monthly_premium: (lead.monthly_premium as string) ?? '',
    coverage_gaps: (lead.coverage_gaps as string) ?? '',
    source: (lead.source as string) ?? 'manuell',
    status: (lead.status as string) ?? 'new',
    notes: (lead.notes as string) ?? '',
  }
}

// ── Styling-Helfer ───────────────────────────────────────────
const inputCls = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#FFC300]/40 focus:border-[#FFC300] bg-white'
const labelCls = 'block text-xs font-medium text-gray-500 mb-1'

// ── Hauptkomponente ──────────────────────────────────────────
export default function LeadsPage() {
  const [allLeads, setAllLeads] = useState<MockLead[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<LeadStatus | 'all'>('all')

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editLead, setEditLead] = useState<MockLead | null>(null)
  const [form, setForm] = useState<LeadFormData>(EMPTY_FORM)
  const [activeTab, setActiveTab] = useState(0)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [dupWarning, setDupWarning] = useState<{ message: string; existing: Record<string, string> } | null>(null)

  // Löschen
  const [deleteTarget, setDeleteTarget] = useState<MockLead | null>(null)
  const [deleting, setDeleting] = useState(false)

  function loadLeads() {
    setLoading(true)
    fetch('/api/leads?limit=500')
      .then((r) => r.json())
      .then((res) => { if (res.success) setAllLeads(res.data) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }
  useEffect(() => { loadLeads() }, [])

  // Filtern
  const filtered = allLeads.filter((lead) => {
    const matchesStatus = activeFilter === 'all' || lead.status === activeFilter
    const q = search.toLowerCase()
    return matchesStatus && (!q ||
      `${lead.first_name} ${lead.last_name}`.toLowerCase().includes(q) ||
      (lead.email ?? '').toLowerCase().includes(q) ||
      (lead.company_name ?? '').toLowerCase().includes(q) ||
      (lead.industry ?? '').toLowerCase().includes(q))
  })

  // Modal öffnen — Neu
  function openCreate() {
    setEditLead(null)
    setForm(EMPTY_FORM)
    setFormError(''); setDupWarning(null); setActiveTab(0)
    setModalOpen(true)
  }

  // Modal öffnen — Bearbeiten
  function openEdit(lead: MockLead) {
    setEditLead(lead)
    setForm(leadToForm(lead as MockLead & Record<string, unknown>))
    setFormError(''); setDupWarning(null); setActiveTab(0)
    setModalOpen(true)
  }

  // Modal öffnen — Kopieren (öffnet als Neu mit vorbefüllten Daten)
  function openCopy(lead: MockLead) {
    setEditLead(null)
    const copied = leadToForm(lead as MockLead & Record<string, unknown>)
    copied.first_name = `Kopie von ${lead.first_name}`
    copied.last_name = lead.last_name
    copied.status = 'new'
    setForm(copied)
    setFormError(''); setDupWarning(null); setActiveTab(0)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false); setEditLead(null); setForm(EMPTY_FORM)
    setFormError(''); setDupWarning(null); setActiveTab(0)
  }

  const setField = (key: keyof LeadFormData, value: string | string[]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const toggleInsurance = (ins: string) => {
    const current = form.existing_insurances
    setField('existing_insurances',
      current.includes(ins) ? current.filter((i) => i !== ins) : [...current, ins]
    )
  }

  // Speichern
  async function handleSave(force = false) {
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setFormError('Vorname und Nachname sind Pflichtfelder.')
      setActiveTab(0); return
    }
    setSaving(true); setFormError(''); setDupWarning(null)
    try {
      const url = editLead ? `/api/leads/${editLead.id}` : '/api/leads'
      const method = editLead ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, force }),
      })
      const data = await res.json()

      if (res.status === 409 && data.duplicate) {
        setDupWarning({ message: data.error, existing: data.existing })
        return
      }
      if (!res.ok || !data.success) throw new Error(data.error ?? 'Unbekannter Fehler')
      closeModal(); loadLeads()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Fehler beim Speichern.')
    } finally {
      setSaving(false)
    }
  }

  // Löschen
  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await fetch(`/api/leads/${deleteTarget.id}`, { method: 'DELETE' })
      setDeleteTarget(null); loadLeads()
    } catch (err) { console.error(err) } finally { setDeleting(false) }
  }

  // ── Tabs ──────────────────────────────────────────────────
  const TABS = ['Kontaktdaten', 'Unternehmen', 'Versicherung', 'Intern']

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Leads</h1>
          <p className="text-gray-500 text-sm mt-0.5">{loading ? 'Lädt…' : `${allLeads.length} Leads gesamt`}</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-[#FFC300] hover:bg-[#e6b000] text-[#1A1A1A] font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Neuer Lead
        </button>
      </div>

      {/* Suche + Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <svg width="16" height="16" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" placeholder="Name, Firma, E-Mail suchen…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#FFC300]/40 focus:border-[#FFC300]" />
        </div>
        <div className="flex gap-1.5 bg-white border border-gray-200 rounded-lg p-1">
          {FILTERS.map((f) => {
            const count = f.value === 'all' ? allLeads.length : allLeads.filter((l) => l.status === f.value).length
            return (
              <button key={f.value} onClick={() => setActiveFilter(f.value)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${activeFilter === f.value ? 'bg-[#FFC300] text-[#1A1A1A]' : 'text-gray-500 hover:text-[#1A1A1A] hover:bg-gray-50'}`}>
                {f.label} <span className={`ml-1 text-xs ${activeFilter === f.value ? 'text-[#1A1A1A]/60' : 'text-gray-400'}`}>{count}</span>
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
                <tr><td colSpan={7} className="text-center py-16">
                  <p className="text-gray-400 text-sm">{allLeads.length === 0 ? 'Noch keine Leads vorhanden.' : 'Keine Leads gefunden.'}</p>
                  {allLeads.length === 0 && <button onClick={openCreate} className="mt-3 text-sm text-[#FFC300] font-medium hover:underline">+ Ersten Lead anlegen</button>}
                </td></tr>
              ) : filtered.map((lead) => (
                <tr key={lead.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="font-semibold text-[#1A1A1A]">{lead.first_name} {lead.last_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{lead.email || lead.phone_mobile || '—'}</p>
                  </td>
                  <td className="px-5 py-3.5 text-gray-600">{lead.company_name || '—'}</td>
                  <td className="px-5 py-3.5">
                    {lead.industry ? <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">{lead.industry}</span> : <span className="text-gray-300">—</span>}
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
                  <td className="px-5 py-3.5 text-gray-500 text-xs">{new Date(lead.created_at).toLocaleDateString('de-DE')}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-0.5">
                      <Link href={`/leads/${lead.id}`} title="Profil" className="p-1.5 rounded-lg text-gray-400 hover:text-[#1A1A1A] hover:bg-[#FFC300]/10 transition-all">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                      </Link>
                      <button title="Bearbeiten" onClick={() => openEdit(lead)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button title="Kopieren" onClick={() => openCopy(lead)} className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      </button>
                      <button title="Löschen" onClick={() => setDeleteTarget(lead)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/40">
            <p className="text-xs text-gray-400">{filtered.length} von {allLeads.length} Leads</p>
          </div>
        )}
      </div>

      {/* ── Lead anlegen / bearbeiten Modal ────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-[#1A1A1A]">
                  {editLead ? `${editLead.first_name} ${editLead.last_name} bearbeiten` : 'Neuer Lead'}
                </h2>
                {!editLead && form.first_name.startsWith('Kopie von') && (
                  <p className="text-xs text-[#FFC300] font-medium mt-0.5">Kopie — bitte Daten prüfen und speichern</p>
                )}
              </div>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 p-1">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100 px-6">
              {TABS.map((tab, i) => (
                <button key={tab} onClick={() => setActiveTab(i)}
                  className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === i ? 'border-[#FFC300] text-[#1A1A1A]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                  {tab}
                </button>
              ))}
            </div>

            {/* Formular-Inhalt */}
            <div className="flex-1 overflow-y-auto px-6 py-5">

              {/* ── TAB 0: Kontaktdaten ── */}
              {activeTab === 0 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Vorname <span className="text-red-400">*</span></label>
                      <input className={inputCls} value={form.first_name} onChange={(e) => setField('first_name', e.target.value)} placeholder="Thomas" />
                    </div>
                    <div>
                      <label className={labelCls}>Nachname <span className="text-red-400">*</span></label>
                      <input className={inputCls} value={form.last_name} onChange={(e) => setField('last_name', e.target.value)} placeholder="Müller" />
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
                      <label className={labelCls}>Geburtsdatum</label>
                      <input className={inputCls} type="date" value={form.birth_date} onChange={(e) => setField('birth_date', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelCls}>Familienstand</label>
                      <select className={inputCls} value={form.marital_status} onChange={(e) => setField('marital_status', e.target.value)}>
                        {MARITAL_OPTIONS.map((o) => <option key={o} value={o}>{o || '— bitte wählen —'}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Kinder (Anzahl)</label>
                      <input className={inputCls} type="number" min="0" value={form.children} onChange={(e) => setField('children', e.target.value)} placeholder="0" />
                    </div>
                    <div>
                      <label className={labelCls}>Beruf</label>
                      <input className={inputCls} value={form.profession} onChange={(e) => setField('profession', e.target.value)} placeholder="z.B. Elektromeister" />
                    </div>
                    <div>
                      <label className={labelCls}>Berufsgruppe</label>
                      <input className={inputCls} value={form.profession_group} onChange={(e) => setField('profession_group', e.target.value)} placeholder="z.B. Handwerk" />
                    </div>
                    <div className="col-span-2">
                      <label className={labelCls}>Position</label>
                      <input className={inputCls} value={form.position} onChange={(e) => setField('position', e.target.value)} placeholder="z.B. Geschäftsführer" />
                    </div>
                  </div>

                  {/* Adresse */}
                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Adresse</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className={labelCls}>Straße + Hausnummer</label>
                        <input className={inputCls} value={form.street} onChange={(e) => setField('street', e.target.value)} placeholder="Musterstraße 12a" />
                      </div>
                      <div>
                        <label className={labelCls}>PLZ</label>
                        <input className={inputCls} value={form.postal_code} onChange={(e) => setField('postal_code', e.target.value)} placeholder="80000" />
                      </div>
                      <div>
                        <label className={labelCls}>Ort</label>
                        <input className={inputCls} value={form.city} onChange={(e) => setField('city', e.target.value)} placeholder="München" />
                      </div>
                      <div className="col-span-2">
                        <label className={labelCls}>Land</label>
                        <input className={inputCls} value={form.country} onChange={(e) => setField('country', e.target.value)} placeholder="Deutschland" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── TAB 1: Unternehmen ── */}
              {activeTab === 1 && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Firmenname</label>
                    <input className={inputCls} value={form.company_name} onChange={(e) => setField('company_name', e.target.value)} placeholder="Müller GmbH" />
                  </div>
                  <div>
                    <label className={labelCls}>Rechtsform</label>
                    <select className={inputCls} value={form.legal_form} onChange={(e) => setField('legal_form', e.target.value)}>
                      {LEGAL_FORMS.map((o) => <option key={o} value={o}>{o || '— bitte wählen —'}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Gründungsjahr</label>
                    <input className={inputCls} type="number" min="1900" max="2099" value={form.founded_year} onChange={(e) => setField('founded_year', e.target.value)} placeholder="2015" />
                  </div>
                  <div>
                    <label className={labelCls}>Mitarbeiter</label>
                    <input className={inputCls} type="number" min="1" value={form.employees} onChange={(e) => setField('employees', e.target.value)} placeholder="8" />
                  </div>
                  <div>
                    <label className={labelCls}>Jahresumsatz (ca.)</label>
                    <input className={inputCls} value={form.annual_revenue} onChange={(e) => setField('annual_revenue', e.target.value)} placeholder="500.000 €" />
                  </div>
                  <div>
                    <label className={labelCls}>Branche</label>
                    <input className={inputCls} value={form.industry} onChange={(e) => setField('industry', e.target.value)} placeholder="Elektrotechnik" />
                  </div>
                  <div>
                    <label className={labelCls}>Handelsregister-Nr.</label>
                    <input className={inputCls} value={form.trade_register} onChange={(e) => setField('trade_register', e.target.value)} placeholder="HRB 12345 München" />
                  </div>
                  <div>
                    <label className={labelCls}>USt-IdNr.</label>
                    <input className={inputCls} value={form.vat_id} onChange={(e) => setField('vat_id', e.target.value)} placeholder="DE123456789" />
                  </div>
                  <div>
                    <label className={labelCls}>Website</label>
                    <input className={inputCls} value={form.website} onChange={(e) => setField('website', e.target.value)} placeholder="www.firma.de" />
                  </div>
                  <div>
                    <label className={labelCls}>Hauptsitz</label>
                    <input className={inputCls} value={form.headquarters} onChange={(e) => setField('headquarters', e.target.value)} placeholder="München" />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Tätigkeitsbeschreibung</label>
                    <textarea className={`${inputCls} resize-none`} rows={3} value={form.business_description} onChange={(e) => setField('business_description', e.target.value)} placeholder="Was macht das Unternehmen?" />
                  </div>
                </div>
              )}

              {/* ── TAB 2: Versicherung ── */}
              {activeTab === 2 && (
                <div className="space-y-4">
                  <div>
                    <label className={labelCls}>Bestehende Versicherungen</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {INSURANCE_LIST.map((ins) => {
                        const active = form.existing_insurances.includes(ins)
                        return (
                          <button key={ins} type="button" onClick={() => toggleInsurance(ins)}
                            className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${active ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
                            {active && '✓ '}{ins}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Aktuelle Gesellschaften</label>
                      <input className={inputCls} value={form.current_providers} onChange={(e) => setField('current_providers', e.target.value)} placeholder="z.B. Allianz, HDI" />
                    </div>
                    <div>
                      <label className={labelCls}>Monatsbeitrag gesamt (ca.)</label>
                      <input className={inputCls} value={form.monthly_premium} onChange={(e) => setField('monthly_premium', e.target.value)} placeholder="480 €/Monat" />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Lücken / Potenzial</label>
                    <textarea className={`${inputCls} resize-none`} rows={4} value={form.coverage_gaps} onChange={(e) => setField('coverage_gaps', e.target.value)} placeholder="Welche Versicherungen fehlen oder können optimiert werden?" />
                  </div>
                </div>
              )}

              {/* ── TAB 3: Intern ── */}
              {activeTab === 3 && (
                <div className="space-y-4">
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
                  <div>
                    <label className={labelCls}>Notizen</label>
                    <textarea className={`${inputCls} resize-none`} rows={5} value={form.notes} onChange={(e) => setField('notes', e.target.value)} placeholder="Erste Eindrücke, Besonderheiten, Hinweise für das Gespräch…" />
                  </div>
                </div>
              )}

              {/* Fehler */}
              {formError && (
                <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">{formError}</div>
              )}

              {/* Duplikat-Warnung */}
              {dupWarning && (
                <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                  <p className="text-sm font-semibold text-yellow-800 mb-1">⚠️ Mögliches Duplikat erkannt</p>
                  <p className="text-sm text-yellow-700 mb-3">{dupWarning.message}</p>
                  <div className="flex gap-2">
                    <button onClick={() => setDupWarning(null)} className="text-xs border border-yellow-300 text-yellow-700 px-3 py-1.5 rounded-lg hover:bg-yellow-100 transition-colors">
                      Abbrechen
                    </button>
                    <button onClick={() => handleSave(true)} disabled={saving} className="text-xs bg-yellow-500 hover:bg-yellow-600 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors">
                      {saving ? 'Speichert…' : 'Trotzdem anlegen'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Tab-Navigation + Speichern */}
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
              <div className="flex gap-2">
                {activeTab > 0 && (
                  <button onClick={() => setActiveTab(activeTab - 1)} className="text-sm text-gray-500 border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                    ← Zurück
                  </button>
                )}
                {activeTab < TABS.length - 1 && (
                  <button onClick={() => setActiveTab(activeTab + 1)} className="text-sm text-gray-600 font-medium border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                    Weiter →
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button onClick={closeModal} className="border border-gray-200 text-gray-600 font-medium text-sm px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                  Abbrechen
                </button>
                <button onClick={() => handleSave(false)} disabled={saving}
                  className="bg-[#FFC300] hover:bg-[#e6b000] disabled:opacity-50 text-[#1A1A1A] font-semibold text-sm px-5 py-2 rounded-lg transition-colors">
                  {saving ? 'Speichert…' : editLead ? 'Änderungen speichern' : 'Lead anlegen'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Löschen-Bestätigung ─────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </div>
            <h3 className="text-lg font-bold text-[#1A1A1A] mb-1">Lead löschen?</h3>
            <p className="text-sm font-semibold text-gray-700 mb-1">{deleteTarget.first_name} {deleteTarget.last_name}</p>
            <p className="text-sm text-gray-400 mb-5">Diese Aktion kann nicht rückgängig gemacht werden.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 border border-gray-200 text-gray-600 font-medium text-sm px-4 py-2.5 rounded-lg hover:bg-gray-50">Abbrechen</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors">
                {deleting ? 'Löscht…' : 'Löschen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
