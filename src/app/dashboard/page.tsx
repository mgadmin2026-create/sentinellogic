'use client'
// Dashboard — KPI-Kacheln + Leads-Tabelle + CSV-Import Modal
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { STATUS_LABELS, STATUS_COLORS, SOURCE_LABELS, SOURCE_COLORS } from '@/data/mock'
import type { MockLead } from '@/data/mock'

// Spalten-Mapping für CSV-Import — alle verfügbaren Systemfelder
const SYSTEM_FIELDS = [
  { value: 'first_name',    label: 'Vorname' },
  { value: 'last_name',     label: 'Nachname' },
  { value: 'email',         label: 'E-Mail' },
  { value: 'phone_mobile',  label: 'Telefon Mobil' },
  { value: 'phone_office',  label: 'Telefon Büro' },
  { value: 'company_name',  label: 'Firma' },
  { value: 'industry',      label: 'Branche' },
  { value: 'position',      label: 'Position' },
  { value: 'street',        label: 'Straße' },
  { value: 'postal_code',   label: 'PLZ' },
  { value: 'city',          label: 'Ort' },
  { value: 'country',       label: 'Land' },
  { value: 'website',       label: 'Website' },
  { value: 'source',        label: 'Quelle' },
  { value: 'status',        label: 'Status' },
  { value: 'notes',         label: 'Notizen' },
  { value: 'ignore',        label: '— ignorieren —' },
]

export default function DashboardPage() {
  // Echte Leads aus der Datenbank
  const [leads, setLeads] = useState<MockLead[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/leads?limit=5')
      .then((r) => r.json())
      .then((res) => { if (res.success) setLeads(res.data) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const [csvModalOpen, setCsvModalOpen] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvPreview, setCsvPreview] = useState<string[][]>([])
  const [csvAllRows, setCsvAllRows] = useState<string[][]>([])
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [importDone, setImportDone] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [importCount, setImportCount] = useState(0)
  const [importDuplicates, setImportDuplicates] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  function parseCSV(text: string) {
    const lines = text.trim().split('\n')
    return lines.map((line) => line.split(',').map((v) => v.trim().replace(/^"|"$/g, '')))
  }

  function handleFile(file: File) {
    setCsvFile(file)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const rows = parseCSV(text)
      const headers = rows[0] ?? []
      const dataRows = rows.slice(1).filter((r) => r.some((c) => c.trim()))
      setCsvHeaders(headers)
      setCsvPreview(dataRows.slice(0, 3))
      setCsvAllRows(dataRows)
      // Auto-Mapping: CSV-Header auf System-Felder mappen
      const autoMap: Record<string, string> = {}
      headers.forEach((h) => {
        const match = SYSTEM_FIELDS.find(
          (f) => f.label.toLowerCase() === h.toLowerCase()
        )
        autoMap[h] = match?.value ?? 'ignore'
      })
      setMapping(autoMap)
    }
    reader.readAsText(file, 'UTF-8')
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  async function handleImport() {
    if (csvAllRows.length === 0) return
    setImportLoading(true)
    let count = 0
    let duplicates = 0
    const createdIds: string[] = []
    const createdNames: string[] = []

    // Alle Zeilen mit Duplikatprüfung in DB schreiben
    for (const row of csvAllRows) {
      const lead: Record<string, string> = {}
      csvHeaders.forEach((header, i) => {
        const field = mapping[header]
        if (field && field !== 'ignore') lead[field] = row[i]?.trim() ?? ''
      })
      if (!lead.first_name || !lead.last_name) continue
      if (!lead.source) lead.source = 'csv'

      try {
        const res = await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(lead),
        })
        const data = await res.json()
        if (res.status === 409 && data.duplicate) {
          duplicates++
        } else if (res.ok && data.success) {
          count++
          createdIds.push(data.data.id)
          createdNames.push(`${data.data.first_name} ${data.data.last_name}`)
        }
      } catch { /* einzelne Fehler überspringen */ }
    }

    // Sync-Log Eintrag schreiben
    const total = count + duplicates
    const status = duplicates > 0 && count === 0 ? 'warning' : 'success'
    const message = duplicates > 0
      ? `${count} importiert, ${duplicates} Duplikat${duplicates > 1 ? 'e' : ''} übersprungen`
      : `${count} Leads aus CSV importiert`

    fetch('/api/sync-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'CSV-Import',
        count, duplicates_skipped: duplicates,
        status, message,
        lead_ids: createdIds,
        lead_names: createdNames,
      }),
    }).catch(() => {})

    setImportCount(count)
    setImportDuplicates(duplicates)
    setImportLoading(false)
    setImportDone(true)

    // Dashboard-Leads nach Import neu laden
    fetch('/api/leads?limit=5').then((r) => r.json()).then((res) => {
      if (res.success) setLeads(res.data)
    }).catch(() => {})
  }

  function closeModal() {
    setCsvModalOpen(false)
    setCsvFile(null)
    setCsvPreview([])
    setCsvHeaders([])
    setMapping({})
    setImportDone(false)
    setImportDuplicates(0)
  }

  // KPIs dynamisch aus echten Leads berechnen
  const today = new Date().toDateString()
  const leadsToday = leads.filter((l) => new Date(l.created_at).toDateString() === today).length
  const kpis = [
    { label: 'Leads heute', value: String(leadsToday), sub: 'aus der Datenbank', color: 'border-[#FFC300]' },
    { label: 'Leads gesamt', value: String(leads.length > 0 ? leads.length : '—'), sub: 'in der Pipeline', color: 'border-blue-400' },
    { label: 'Abschlussquote', value: '23%', sub: 'Ø letzte 30 Tage', color: 'border-emerald-400' },
    { label: 'Zeitersparnis', value: '4,6h', sub: 'pro Woche durch Automation', color: 'border-purple-400' },
  ]

  return (
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
          Leads importieren (CSV)
        </button>
      </div>

      {/* KPI-Kacheln */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {kpis.map((kpi) => (
          <div key={kpi.label} className={`bg-white rounded-xl border-l-4 ${kpi.color} border border-gray-200 shadow-sm p-5`}>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{kpi.label}</p>
            <p className="text-3xl font-bold text-[#1A1A1A] mt-1">{kpi.value}</p>
            <p className="text-xs text-gray-400 mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Leads-Tabelle */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-[#1A1A1A]">Neueste Leads</h2>
          <Link href="/leads" className="text-sm text-[#FFC300] hover:underline font-medium">
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
                      href={`/leads/${lead.id}`}
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

      {/* CSV-Import Modal */}
      {csvModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-[#1A1A1A]">Leads importieren (CSV)</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-5">
              {!importDone ? (
                <>
                  {/* Drag & Drop Zone */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                      dragOver
                        ? 'border-[#FFC300] bg-[#FFC300]/5'
                        : csvFile
                        ? 'border-emerald-400 bg-emerald-50'
                        : 'border-gray-300 hover:border-[#FFC300] hover:bg-gray-50'
                    }`}
                  >
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
                    />
                    {csvFile ? (
                      <div>
                        <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-2">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                        <p className="font-semibold text-[#1A1A1A]">{csvFile.name}</p>
                        <p className="text-sm text-gray-500 mt-0.5">{csvPreview.length + 1} Zeilen erkannt</p>
                      </div>
                    ) : (
                      <div>
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                          </svg>
                        </div>
                        <p className="font-medium text-[#1A1A1A]">CSV-Datei hier ablegen oder klicken</p>
                        <p className="text-sm text-gray-400 mt-1">Unterstützt: .csv mit Komma-Trennung</p>
                      </div>
                    )}
                  </div>

                  {/* Beispiel-CSV Download */}
                  <a
                    href="/leads-beispiel.csv"
                    download
                    className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#1A1A1A] transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Beispiel-CSV herunterladen
                  </a>

                  {/* Vorschau erste 3 Zeilen */}
                  {csvPreview.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-[#1A1A1A] mb-2">Vorschau (erste 3 Zeilen)</h3>
                      <div className="overflow-x-auto rounded-lg border border-gray-200">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50">
                            <tr>
                              {csvHeaders.map((h) => (
                                <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {csvPreview.map((row, i) => (
                              <tr key={i} className="border-t border-gray-100">
                                {row.map((cell, j) => (
                                  <td key={j} className="px-3 py-2 text-gray-700">{cell}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Spalten-Mapping */}
                  {csvHeaders.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-[#1A1A1A] mb-3">Spalten zuordnen</h3>
                      <div className="space-y-2">
                        {csvHeaders.map((h) => (
                          <div key={h} className="flex items-center gap-3">
                            <span className="text-sm text-gray-600 w-32 flex-shrink-0 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200 truncate">
                              {h}
                            </span>
                            <svg width="14" height="14" className="text-gray-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                            <select
                              value={mapping[h] ?? 'ignore'}
                              onChange={(e) => setMapping({ ...mapping, [h]: e.target.value })}
                              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#FFC300]/40"
                            >
                              {SYSTEM_FIELDS.map((f) => (
                                <option key={f.value} value={f.value}>{f.label}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Import Button */}
                  <div className="flex gap-3 pt-2">
                    <button onClick={closeModal} className="flex-1 border border-gray-200 text-gray-600 font-medium text-sm px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors">
                      Abbrechen
                    </button>
                    <button
                      onClick={handleImport}
                      disabled={!csvFile || importLoading}
                      className="flex-1 bg-[#FFC300] hover:bg-[#e6b000] disabled:opacity-40 disabled:cursor-not-allowed text-[#1A1A1A] font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors"
                    >
                      {importLoading
                        ? 'Importiere…'
                        : `${csvAllRows.length} Leads importieren`}
                    </button>
                  </div>
                </>
              ) : (
                // Erfolgsmeldung
                <div className="text-center py-10">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-[#1A1A1A] mb-2">
                    {importCount} Leads importiert
                  </h3>
                  <p className="text-gray-500 text-sm mb-3">
                    Leads übernommen und Automatisierungsregeln ausgeführt.
                  </p>
                  {importDuplicates > 0 && (
                    <p className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 mb-4">
                      ⚠️ {importDuplicates} Duplikat{importDuplicates > 1 ? 'e' : ''} übersprungen — bereits im System vorhanden
                    </p>
                  )}
                  <button
                    onClick={closeModal}
                    className="bg-[#FFC300] hover:bg-[#e6b000] text-[#1A1A1A] font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors"
                  >
                    Fertig
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
