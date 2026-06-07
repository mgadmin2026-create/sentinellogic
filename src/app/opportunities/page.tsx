'use client'
// Opportunities-Verwaltung — Verkaufschancen pro Kontakt
import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Opportunity {
  id: string
  contact_id: string
  contact_name?: string
  thema: string
  status: 'neu' | 'kontaktiert' | 'analyse' | 'angebot' | 'nachfassen' | 'kunde'
  wert?: number
  nächster_schritt?: string
  fällig?: string
  notizen?: string
  created_at: string
}

const STATUS_LABELS: Record<string, string> = {
  neu: 'Neu',
  kontaktiert: 'Kontaktiert',
  analyse: 'Analyse',
  angebot: 'Angebot',
  nachfassen: 'Nachfassen',
  kunde: 'Kunde',
}

const STATUS_COLORS: Record<string, string> = {
  neu: 'bg-blue-100 text-blue-800',
  kontaktiert: 'bg-cyan-100 text-cyan-800',
  analyse: 'bg-purple-100 text-purple-800',
  angebot: 'bg-orange-100 text-orange-800',
  nachfassen: 'bg-yellow-100 text-yellow-800',
  kunde: 'bg-emerald-100 text-emerald-800',
}

const OPPORTUNITIES_FILTER = [
  { label: 'Alle', value: 'all' },
  { label: 'Neu', value: 'neu' },
  { label: 'Kontaktiert', value: 'kontaktiert' },
  { label: 'Analyse', value: 'analyse' },
  { label: 'Angebot', value: 'angebot' },
  { label: 'Nachfassen', value: 'nachfassen' },
  { label: 'Kunde', value: 'kunde' },
]

// Mock-Daten für Phase 1
const MOCK_OPPORTUNITIES: Opportunity[] = [
  {
    id: '1',
    contact_id: 'c1',
    contact_name: 'Max Mustermann',
    thema: 'KFZ-Versicherung',
    status: 'angebot',
    wert: 45000,
    nächster_schritt: 'Angebote vergleichen und Unterschrift einholen',
    fällig: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notizen: 'Kundenfreundlich, gute Bonität, hohes Upsell-Potenzial',
    created_at: new Date().toISOString(),
  },
  {
    id: '2',
    contact_id: 'c2',
    contact_name: 'Laura Klein',
    thema: 'Altersvorsorge (Rente)',
    status: 'analyse',
    wert: 25000,
    nächster_schritt: 'Finanzielle Situation analysieren, Bedarf ermitteln',
    fällig: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notizen: 'Angestellte, großes Interesse an Vermögensaufbau',
    created_at: new Date().toISOString(),
  },
  {
    id: '3',
    contact_id: 'c3',
    contact_name: 'John Doe',
    thema: 'Berufsunfähigkeitsversicherung',
    status: 'neu',
    wert: 15000,
    nächster_schritt: 'Erstkontakt, Termin vereinbaren',
    fällig: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notizen: 'Handwerker, höheres Risiko, BU-Versicherung essentiell',
    created_at: new Date().toISOString(),
  },
  {
    id: '4',
    contact_id: 'c4',
    contact_name: 'Anna Schmidt',
    thema: 'Hausratversicherung',
    status: 'kunde',
    wert: 8000,
    nächster_schritt: 'Abschluss, Verträge vorbereiten',
    fällig: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notizen: 'Mehrfamilienhaus, bereits mehrere Versicherungen bei uns',
    created_at: new Date().toISOString(),
  },
  {
    id: '5',
    contact_id: 'c5',
    contact_name: 'Peter Wagner',
    thema: 'Haftpflicht + Sachversicherung (Gewerbe)',
    status: 'nachfassen',
    wert: 120000,
    nächster_schritt: 'Nachfassen — keine Rückmeldung seit Angebotssendung',
    fällig: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notizen: 'KMU, großvolumiges Geschäft, aber Entscheidungsprozess verzögert sich',
    created_at: new Date().toISOString(),
  },
]

export default function OpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>(MOCK_OPPORTUNITIES)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const isOverdue = (dueDate?: string) => {
    return dueDate && new Date(dueDate) < new Date()
  }

  const filtered = opportunities.filter((o) => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false
    const q = search.toLowerCase()
    if (q && !(
      o.thema.toLowerCase().includes(q) ||
      (o.contact_name ?? '').toLowerCase().includes(q) ||
      (o.nächster_schritt ?? '').toLowerCase().includes(q)
    )) return false
    return true
  })

  const totalWert = filtered.reduce((sum, o) => sum + (o.wert ?? 0), 0)
  const kundenWert = filtered.filter(o => o.status === 'kunde').reduce((sum, o) => sum + (o.wert ?? 0), 0)

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Opportunities</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {loading ? 'Lädt…' : `${opportunities.length} Opportunities, ${(totalWert / 1000).toFixed(0)}K € Gesamtwert`}
          </p>
        </div>
        <button className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Neue Opportunity
        </button>
      </div>

      {/* KPI-Widgets */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 font-semibold uppercase">Gesamt Opportunities</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{opportunities.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 font-semibold uppercase">Offene (≠ Kunde)</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1">{opportunities.filter(o => o.status !== 'kunde').length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 font-semibold uppercase">Abgeschlossen</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{opportunities.filter(o => o.status === 'kunde').length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 font-semibold uppercase">Umsatz (Kunde)</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{(kundenWert / 1000).toFixed(0)}K €</p>
        </div>
      </div>

      {/* Suche + Filter */}
      <div className="mb-6 space-y-3">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <svg width="16" height="16" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Nach Thema, Kontakt oder nächstem Schritt suchen…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400"
            />
          </div>
        </div>

        {/* Status-Tabs */}
        <div className="flex gap-1.5 bg-white border border-gray-200 rounded-lg p-1 w-fit overflow-x-auto">
          {OPPORTUNITIES_FILTER.map((f) => {
            const count = f.value === 'all'
              ? opportunities.length
              : opportunities.filter((o) => o.status === f.value).length
            return (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
                  statusFilter === f.value
                    ? 'bg-yellow-400 text-gray-900'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {f.label} <span className={`ml-1 text-xs ${statusFilter === f.value ? 'text-gray-700' : 'text-gray-400'}`}>{count}</span>
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
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-5 py-3">Thema</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-5 py-3">Kontakt</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-5 py-3">Status</th>
                <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wide px-5 py-3">Wert</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-5 py-3">Nächster Schritt</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-5 py-3">Fällig</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center text-gray-400 py-16 text-sm">
                    Opportunities werden geladen…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16">
                    <p className="text-gray-400 text-sm">{opportunities.length === 0 ? 'Noch keine Opportunities vorhanden.' : 'Keine Opportunities gefunden.'}</p>
                  </td>
                </tr>
              ) : (
                filtered.map((opp) => (
                  <tr key={opp.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-gray-900">{opp.thema}</p>
                      {opp.notizen && (
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{opp.notizen}</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <Link href={`/kontakte/${opp.contact_id}`} className="text-yellow-600 hover:text-yellow-700 text-sm font-medium">
                        {opp.contact_name || '—'}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[opp.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABELS[opp.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="font-semibold text-gray-900">
                        {opp.wert ? `${(opp.wert / 1000).toFixed(0)}K €` : '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs max-w-xs line-clamp-2">
                      {opp.nächster_schritt || '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className={`text-xs ${isOverdue(opp.fällig) && opp.status !== 'kunde' ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                        {opp.fällig ? new Date(opp.fällig).toLocaleDateString('de-DE') : '—'}
                        {isOverdue(opp.fällig) && opp.status !== 'kunde' && (
                          <span className="ml-1.5 inline-flex px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-bold">
                            ⏰
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
