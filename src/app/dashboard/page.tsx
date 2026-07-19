'use client'
// Dashboard — KPI-Kacheln + Kontakte-Tabelle + CSV-Import Modal
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { STATUS_LABELS, STATUS_COLORS, SOURCE_LABELS, SOURCE_COLORS } from '@/data/mock'
import { getLatestRelease } from '@/data/release-notes'
import { ReleaseNotificationBanner } from '@/components/ReleaseNotificationBanner'
import { KontaktImportModal } from '@/components/KontaktImportModal'
import type { MockLead } from '@/data/mock'

export default function DashboardPage() {
  // Echte Leads aus der Datenbank
  const [leads, setLeads] = useState<MockLead[]>([])
  const [loading, setLoading] = useState(true)
  const [showBanner, setShowBanner] = useState(true)

  useEffect(() => {
    fetch('/api/kontakte?limit=10000')
      .then((r) => r.json())
      .then((res) => { if (res.success) setLeads(res.data) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const [csvModalOpen, setCsvModalOpen] = useState(false)

  function reloadLeadsPreview() {
    fetch('/api/kontakte?limit=5').then((r) => r.json()).then((res) => {
      if (res.success) setLeads(res.data)
    }).catch(() => {})
  }

  // KPIs dynamisch aus echten Kontakten/Aufgaben/Opportunities berechnen
  const today = new Date().toDateString()
  const leadsToday = leads.filter((l) => new Date(l.created_at).toDateString() === today).length

  // Mock-Daten für Aufgaben und Opportunities (später echte API)
  const mockOpenTasks = 12
  const mockOpenOpportunities = 5

  const kpis = [
    { label: 'Neue Kontakte', value: String(leadsToday), sub: 'diese Woche', color: 'border-[#FFC300]' },
    { label: 'Kontakte gesamt', value: String(leads.length > 0 ? leads.length : '—'), sub: 'in der Pipeline', color: 'border-blue-400' },
    { label: 'Offene Aufgaben', value: String(mockOpenTasks), sub: 'fällig diese Woche', color: 'border-orange-400' },
    { label: 'Abschlussquote', value: '23%', sub: 'Ø letzte 30 Tage', color: 'border-purple-400' },
  ]

  const latestRelease = getLatestRelease()

  return (
    <div>
      {/* Release Notes Banner */}
      {showBanner && latestRelease && (
        <ReleaseNotificationBanner
          release={latestRelease}
          onDismiss={() => setShowBanner(false)}
        />
      )}

      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Übersicht — Stand: heute, {new Date().toLocaleDateString('de-DE')}</p>
        </div>
        <button
          onClick={() => setCsvModalOpen(true)}
          className="flex items-center gap-2 bg-[#FFC300] hover:bg-[#e6b000] text-[#1A1A1A] font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Kontakte importieren (CSV)
        </button>
      </div>

      {/* KPI-Kacheln */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpis.map((kpi) => (
          <div key={kpi.label} className={`bg-white rounded-lg border-l-4 ${kpi.color} border border-gray-200 shadow-sm p-5`}>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{kpi.label}</p>
            <p className="text-2xl font-bold text-[#1A1A1A] mt-2">{kpi.value}</p>
            <p className="text-xs text-gray-400 mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Kontakte-Tabelle */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-[#1A1A1A]">Neueste Kontakte</h2>
          <Link href="/kontakte" className="text-sm text-[#FFC300] hover:underline font-medium">
            Alle anzeigen →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Name', 'Firma', 'Status', 'Quelle', 'Datum', 'Aktionen'].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-6 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center text-gray-400 py-12 text-sm">Leads werden geladen…</td></tr>
              ) : leads.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-gray-400 py-12 text-sm">Noch keine Leads in der Datenbank.</td></tr>
              ) : leads.map((lead) => (
                <tr key={lead.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                  <td className="px-6 py-3.5">
                    <span className="font-medium text-[#1A1A1A]">
                      {lead.first_name} {lead.last_name}
                    </span>
                    {lead.is_test_data && (
                      <span className="ml-2 inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700">
                        Testdaten
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3.5 text-gray-600">{lead.company_name ?? '—'}</td>
                  <td className="px-6 py-3.5">
                    <span className={`inline-flex text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[lead.status]}`}>
                      {STATUS_LABELS[lead.status]}
                    </span>
                  </td>
                  <td className="px-6 py-3.5">
                    <span className={`inline-flex text-xs font-medium px-2.5 py-1 rounded-full ${SOURCE_COLORS[lead.source]}`}>
                      {SOURCE_LABELS[lead.source]}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-gray-500">
                    {new Date(lead.created_at).toLocaleDateString('de-DE')}
                  </td>
                  <td className="px-6 py-3.5">
                    <Link
                      href={`/kontakte/${lead.id}`}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold bg-[#FFC300]/10 text-[#1A1A1A] hover:bg-[#FFC300]/20 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Öffnen →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      </div>

      <KontaktImportModal
        isOpen={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        onImported={reloadLeadsPreview}
      />
    </div>
  )
}
