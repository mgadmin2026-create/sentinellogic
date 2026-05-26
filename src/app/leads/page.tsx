'use client'
// Lead-Liste — Suche, Filter, Tabelle mit allen 8 Mock-Leads
import { useState } from 'react'
import Link from 'next/link'
import { MOCK_LEADS, STATUS_LABELS, STATUS_COLORS, SOURCE_LABELS, SOURCE_COLORS, type LeadStatus } from '@/data/mock'

const FILTERS: { label: string; value: LeadStatus | 'all' }[] = [
  { label: 'Alle', value: 'all' },
  { label: 'Neu', value: 'new' },
  { label: 'Kontaktiert', value: 'contacted' },
  { label: 'Qualifiziert', value: 'qualified' },
  { label: 'Kunde', value: 'customer' },
]

export default function LeadsPage() {
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<LeadStatus | 'all'>('all')

  const filtered = MOCK_LEADS.filter((lead) => {
    const matchesStatus = activeFilter === 'all' || lead.status === activeFilter
    const q = search.toLowerCase()
    const matchesSearch =
      !q ||
      `${lead.first_name} ${lead.last_name}`.toLowerCase().includes(q) ||
      lead.email.toLowerCase().includes(q) ||
      (lead.company_name ?? '').toLowerCase().includes(q) ||
      (lead.industry ?? '').toLowerCase().includes(q)
    return matchesStatus && matchesSearch
  })

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Leads</h1>
          <p className="text-gray-500 text-sm mt-0.5">{MOCK_LEADS.length} Leads gesamt</p>
        </div>
        <Link
          href="/dashboard"
          onClick={(e) => {
            // CSV-Import über Dashboard aufrufen
          }}
          className="flex items-center gap-2 bg-[#FFC300] hover:bg-[#e6b000] text-[#1A1A1A] font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Neuer Lead
        </Link>
      </div>

      {/* Suche + Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        {/* Suchfeld */}
        <div className="relative flex-1">
          <svg width="16" height="16" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Name, Firma, E-Mail suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#FFC300]/40 focus:border-[#FFC300]"
          />
        </div>

        {/* Filter-Buttons */}
        <div className="flex gap-1.5 bg-white border border-gray-200 rounded-lg p-1">
          {FILTERS.map((f) => {
            const count = f.value === 'all'
              ? MOCK_LEADS.length
              : MOCK_LEADS.filter((l) => l.status === f.value).length
            return (
              <button
                key={f.value}
                onClick={() => setActiveFilter(f.value)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  activeFilter === f.value
                    ? 'bg-[#FFC300] text-[#1A1A1A]'
                    : 'text-gray-500 hover:text-[#1A1A1A] hover:bg-gray-50'
                }`}
              >
                {f.label}
                <span className={`ml-1.5 text-xs ${activeFilter === f.value ? 'text-[#1A1A1A]/60' : 'text-gray-400'}`}>
                  {count}
                </span>
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
                {['Name', 'Firma', 'Branche', 'Quelle', 'Status', 'Letzter Kontakt', 'Aktionen'].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-5 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-gray-400 py-16 text-sm">
                    Keine Leads gefunden.
                  </td>
                </tr>
              ) : (
                filtered.map((lead) => (
                  <tr key={lead.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors group">
                    <td className="px-5 py-3.5">
                      <div>
                        <p className="font-semibold text-[#1A1A1A]">
                          {lead.first_name} {lead.last_name}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{lead.email}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">{lead.company_name ?? '—'}</td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {lead.industry ?? '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex text-xs font-medium px-2.5 py-1 rounded-full ${SOURCE_COLORS[lead.source]}`}>
                        {SOURCE_LABELS[lead.source]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[lead.status]}`}>
                        {STATUS_LABELS[lead.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 text-sm">
                      {lead.last_contact_date
                        ? new Date(lead.last_contact_date).toLocaleDateString('de-DE')
                        : new Date(lead.created_at).toLocaleDateString('de-DE')}
                    </td>
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/leads/${lead.id}`}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold bg-[#FFC300]/10 text-[#1A1A1A] hover:bg-[#FFC300]/30 px-3 py-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      >
                        Öffnen →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        {filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/40">
            <p className="text-xs text-gray-400">
              {filtered.length} von {MOCK_LEADS.length} Leads angezeigt
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
