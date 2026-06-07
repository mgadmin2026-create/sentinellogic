'use client'
// Aufgaben-Verwaltung — zentrale Übersicht aller Aufgaben (To-Do's, Folgetermine, etc.)
import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Aufgabe {
  id: string
  contact_id: string
  contact_name?: string
  titel: string
  beschreibung?: string
  status: 'offen' | 'in_bearbeitung' | 'erledigt'
  priorität: 'niedrig' | 'mittel' | 'hoch'
  fällig: string
  assigned_user_id?: string
  assigned_user_name?: string
  created_at: string
}

const STATUS_LABELS: Record<string, string> = {
  offen: 'Offen',
  in_bearbeitung: 'In Bearbeitung',
  erledigt: 'Erledigt',
}

const STATUS_COLORS: Record<string, string> = {
  offen: 'bg-red-100 text-red-800',
  in_bearbeitung: 'bg-yellow-100 text-yellow-800',
  erledigt: 'bg-emerald-100 text-emerald-800',
}

const PRIORITÄT_COLORS: Record<string, string> = {
  niedrig: 'text-gray-500',
  mittel: 'text-orange-500',
  hoch: 'text-red-500',
}

const PRIORITÄT_LABELS: Record<string, string> = {
  niedrig: 'Niedrig',
  mittel: 'Mittel',
  hoch: 'Hoch',
}

const AUFGABEN_FILTER = [
  { label: 'Alle', value: 'all' },
  { label: 'Offen', value: 'offen' },
  { label: 'In Bearbeitung', value: 'in_bearbeitung' },
  { label: 'Erledigt', value: 'erledigt' },
]

const PRIORITÄT_FILTER = [
  { label: 'Alle', value: 'all' },
  { label: 'Hoch', value: 'hoch' },
  { label: 'Mittel', value: 'mittel' },
  { label: 'Niedrig', value: 'niedrig' },
]

// Mock-Daten für Phase 1
const MOCK_AUFGABEN: Aufgabe[] = [
  {
    id: '1',
    contact_id: 'c1',
    contact_name: 'Max Mustermann',
    titel: 'Versicherungsangebot KFZ-Versicherung vorbereiten',
    beschreibung: 'KFZ-Versicherung mit Deckungssumme X,XXX € recherchieren',
    status: 'in_bearbeitung',
    priorität: 'hoch',
    fällig: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    assigned_user_name: 'Max Mustermann',
    created_at: new Date().toISOString(),
  },
  {
    id: '2',
    contact_id: 'c2',
    contact_name: 'Laura Klein',
    titel: 'Terminbuchung für Gespräch bestätigen',
    beschreibung: 'Termin für Angebotsbesprechung nächste Woche bestätigen',
    status: 'offen',
    priorität: 'mittel',
    fällig: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    assigned_user_name: 'Laura Klein',
    created_at: new Date().toISOString(),
  },
  {
    id: '3',
    contact_id: 'c3',
    contact_name: 'John Doe',
    titel: 'Daten einholen: Fahrzeugdetails, Alter, Einkommen',
    beschreibung: '',
    status: 'offen',
    priorität: 'hoch',
    fällig: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    assigned_user_name: 'System',
    created_at: new Date().toISOString(),
  },
  {
    id: '4',
    contact_id: 'c4',
    contact_name: 'Anna Schmidt',
    titel: 'Verträge ablegen im Archiv',
    beschreibung: 'Unterschriebene Verträge scannen und in Google Drive ablegen',
    status: 'erledigt',
    priorität: 'niedrig',
    fällig: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    assigned_user_name: 'System',
    created_at: new Date().toISOString(),
  },
]

export default function AufgabenPage() {
  const [aufgaben, setAufgaben] = useState<Aufgabe[]>(MOCK_AUFGABEN)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [prioritätFilter, setPrioritätFilter] = useState<string>('all')

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date() && dueDate
  }

  const filtered = aufgaben.filter((a) => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false
    if (prioritätFilter !== 'all' && a.priorität !== prioritätFilter) return false
    const q = search.toLowerCase()
    if (q && !(
      a.titel.toLowerCase().includes(q) ||
      (a.contact_name ?? '').toLowerCase().includes(q) ||
      (a.beschreibung ?? '').toLowerCase().includes(q)
    )) return false
    return true
  })

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Aufgaben</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {loading ? 'Lädt…' : `${aufgaben.filter(a => a.status !== 'erledigt').length} offene, ${aufgaben.filter(a => a.status === 'erledigt').length} erledigt`}
          </p>
        </div>
        <button className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Neue Aufgabe
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
              placeholder="Nach Titel, Kontakt oder Beschreibung suchen…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400"
            />
          </div>
        </div>

        {/* Status-Tabs */}
        <div className="flex gap-2 flex-wrap">
          <div className="flex gap-1.5 bg-white border border-gray-200 rounded-lg p-1 w-fit">
            {AUFGABEN_FILTER.map((f) => {
              const count = f.value === 'all'
                ? aufgaben.length
                : aufgaben.filter((a) => a.status === f.value).length
              return (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
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

          {/* Priorität Filter */}
          <div className="flex gap-1.5 bg-white border border-gray-200 rounded-lg p-1 w-fit">
            {PRIORITÄT_FILTER.map((f) => {
              const count = f.value === 'all'
                ? aufgaben.length
                : aufgaben.filter((a) => a.priorität === f.value).length
              return (
                <button
                  key={f.value}
                  onClick={() => setPrioritätFilter(f.value)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    prioritätFilter === f.value
                      ? 'bg-yellow-400 text-gray-900'
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {f.label} <span className={`ml-1 text-xs ${prioritätFilter === f.value ? 'text-gray-700' : 'text-gray-400'}`}>{count}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Tabelle */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-5 py-3">Aufgabe</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-5 py-3">Kontakt</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-5 py-3">Priorität</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-5 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-5 py-3">Fällig</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-5 py-3">Zugewiesen</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center text-gray-400 py-16 text-sm">
                    Aufgaben werden geladen…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16">
                    <p className="text-gray-400 text-sm">{aufgaben.length === 0 ? 'Noch keine Aufgaben vorhanden.' : 'Keine Aufgaben gefunden.'}</p>
                  </td>
                </tr>
              ) : (
                filtered.map((aufgabe) => (
                  <tr
                    key={aufgabe.id}
                    className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${aufgabe.status === 'erledigt' ? 'opacity-60' : ''}`}
                  >
                    <td className="px-5 py-3.5">
                      <div>
                        <p className="font-semibold text-gray-900">{aufgabe.titel}</p>
                        {aufgabe.beschreibung && (
                          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{aufgabe.beschreibung}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <Link href={`/kontakte/${aufgabe.contact_id}`} className="text-yellow-600 hover:text-yellow-700 text-sm font-medium">
                        {aufgabe.contact_name || '—'}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-bold ${PRIORITÄT_COLORS[aufgabe.priorität]}`}>
                        {PRIORITÄT_LABELS[aufgabe.priorität]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[aufgabe.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABELS[aufgabe.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className={`text-xs ${isOverdue(aufgabe.fällig) ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                        {new Date(aufgabe.fällig).toLocaleDateString('de-DE')}
                        {isOverdue(aufgabe.fällig) && aufgabe.status !== 'erledigt' && (
                          <span className="ml-1.5 inline-flex px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-bold">
                            ⏰ Überfällig
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{aufgabe.assigned_user_name || '—'}</td>
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
