'use client'
// Kontakte-Liste — zentrale Verwaltung aller Kontakte (Interessenten, Kunden, etc.)
import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Kontakt {
  id: string
  first_name: string
  last_name: string
  email: string
  company_name?: string
  status: 'new' | 'contacted' | 'qualified' | 'customer'
  assigned_user_id?: string
  pipeline_stage?: string
  created_at: string
  notes?: string
}

const STATUS_LABELS: Record<string, string> = {
  new: 'Neu',
  contacted: 'Kontaktiert',
  qualified: 'Qualifiziert',
  customer: 'Kunde',
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  qualified: 'bg-emerald-100 text-emerald-800',
  customer: 'bg-purple-100 text-purple-800',
}

const KONTAKT_FILTER = [
  { label: 'Alle', value: 'all' },
  { label: 'Neu', value: 'new' },
  { label: 'Kontaktiert', value: 'contacted' },
  { label: 'Qualifiziert', value: 'qualified' },
  { label: 'Kunde', value: 'customer' },
]

export default function KontaktePage() {
  const [kontakte, setKontakte] = useState<Kontakt[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<string>('all')

  useEffect(() => {
    loadKontakte()
  }, [])

  async function loadKontakte() {
    try {
      setLoading(true)
      const res = await fetch('/api/leads?limit=500')
      const json = await res.json()
      if (json.success) {
        setKontakte(json.data)
      }
    } catch (err) {
      console.error('Fehler beim Laden der Kontakte:', err)
    } finally {
      setLoading(false)
    }
  }

  const filtered = kontakte.filter((k) => {
    if (activeFilter !== 'all' && k.status !== activeFilter) return false
    const q = search.toLowerCase()
    if (q && !(
      `${k.first_name} ${k.last_name}`.toLowerCase().includes(q) ||
      (k.email ?? '').toLowerCase().includes(q) ||
      (k.company_name ?? '').toLowerCase().includes(q)
    )) return false
    return true
  })

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Kontakte</h1>
          <p className="text-gray-500 text-sm mt-0.5">{loading ? 'Lädt…' : `${kontakte.length} Kontakte gesamt`}</p>
        </div>
        <button className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Neuer Kontakt
        </button>
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
              placeholder="Nach Name, E-Mail oder Firma suchen…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400"
            />
          </div>
        </div>

        {/* Status-Tabs */}
        <div className="flex gap-1.5 bg-white border border-gray-200 rounded-lg p-1 w-fit">
          {KONTAKT_FILTER.map((f) => {
            const count = f.value === 'all' ? kontakte.length : kontakte.filter((k) => k.status === f.value).length
            return (
              <button
                key={f.value}
                onClick={() => setActiveFilter(f.value)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  activeFilter === f.value
                    ? 'bg-yellow-400 text-gray-900'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {f.label} <span className={`ml-1 text-xs ${activeFilter === f.value ? 'text-gray-700' : 'text-gray-400'}`}>{count}</span>
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
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-5 py-3">Name</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-5 py-3">Firma</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-5 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-5 py-3">Prozessschritt</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-5 py-3">Erstellt</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-5 py-3">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center text-gray-400 py-16 text-sm">
                    Kontakte werden geladen…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16">
                    <p className="text-gray-400 text-sm">{kontakte.length === 0 ? 'Noch keine Kontakte vorhanden.' : 'Keine Kontakte gefunden.'}</p>
                  </td>
                </tr>
              ) : (
                filtered.map((kontakt) => (
                  <tr key={kontakt.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div>
                        <p className="font-semibold text-gray-900">{kontakt.first_name} {kontakt.last_name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{kontakt.email || kontakt.id}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">{kontakt.company_name || '—'}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[kontakt.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABELS[kontakt.status] ?? kontakt.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-500">{kontakt.pipeline_stage ? `Schritt ${kontakt.pipeline_stage}` : '—'}</td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs">{new Date(kontakt.created_at).toLocaleDateString('de-DE')}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-0.5">
                        <Link href={`/kontakte/${kontakt.id}`} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-all">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                          </svg>
                        </Link>
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
