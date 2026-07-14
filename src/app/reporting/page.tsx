'use client'

import { useState } from 'react'

interface ReportResult {
  sql?: string
  explanation?: string
  rows?: Record<string, any>[]
  rowCount?: number
}

const EXAMPLES = [
  'Zeige mir die Kontakte der letzten 7 Tage',
  'Anzahl Kontakte je Quelle',
  'Kontakte je Prüfgrund',
  'Wie viele Verträge pro Monat',
  'Offene Aufgaben nach Priorität',
  'Kontakte ohne E-Mail-Adresse',
]

function toCsv(rows: Record<string, any>[]): string {
  if (!rows.length) return ''
  const cols = Object.keys(rows[0])
  const escape = (v: any) => {
    if (v === null || v === undefined) return ''
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = cols.join(',')
  const body = rows.map((r) => cols.map((c) => escape(r[c])).join(',')).join('\n')
  return `${header}\n${body}`
}

export default function ReportingPage() {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ReportResult | null>(null)
  const [showSql, setShowSql] = useState(false)

  async function run(q?: string) {
    const question = (q ?? prompt).trim()
    if (!question) return
    if (q) setPrompt(q)

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/reporting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: question }),
      })
      const data = await res.json()
      if (data.success) {
        setResult(data)
      } else {
        setError(data.error || 'Auswertung fehlgeschlagen')
        if (data.sql) setResult({ sql: data.sql, explanation: data.explanation })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Auswertung fehlgeschlagen')
    } finally {
      setLoading(false)
    }
  }

  function downloadCsv() {
    if (!result?.rows?.length) return
    const csv = toCsv(result.rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `report_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const columns = result?.rows?.length ? Object.keys(result.rows[0]) : []

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">Reporting</h1>
      <p className="text-sm text-gray-500 mb-6">
        Frag in eigenen Worten – die Auswertung wird live aus der Datenbank erstellt.
      </p>

      {/* Eingabe */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') run()
          }}
          placeholder="z. B. Zeige mir die Kontakte der letzten 7 Tage…"
          rows={3}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400/40 resize-y"
        />
        <div className="flex items-center justify-between mt-3 gap-3 flex-wrap">
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => run(ex)}
                disabled={loading}
                className="text-xs px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-md disabled:opacity-50"
              >
                {ex}
              </button>
            ))}
          </div>
          <button
            onClick={() => run()}
            disabled={loading || !prompt.trim()}
            className="px-4 py-2 text-sm font-semibold text-gray-900 bg-yellow-400 hover:bg-yellow-500 rounded-lg disabled:opacity-50 whitespace-nowrap"
          >
            {loading ? '⏳ Werte aus…' : '📊 Auswerten'}
          </button>
        </div>
      </div>

      {/* Fehler */}
      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Ergebnis */}
      {result && (
        <div className="mt-6 space-y-4">
          {result.explanation && (
            <p className="text-sm text-gray-700">{result.explanation}</p>
          )}

          {result.sql && (
            <div className="text-xs">
              <button
                onClick={() => setShowSql((s) => !s)}
                className="text-gray-500 hover:text-gray-800 underline-offset-2 hover:underline"
              >
                {showSql ? '▾ SQL ausblenden' : '▸ Generierte SQL anzeigen'}
              </button>
              {showSql && (
                <pre className="mt-2 p-3 bg-gray-900 text-gray-100 rounded-lg overflow-x-auto text-xs leading-relaxed">
                  {result.sql}
                </pre>
              )}
            </div>
          )}

          {result.rows && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  {result.rowCount} {result.rowCount === 1 ? 'Zeile' : 'Zeilen'}
                  {result.rowCount === 1000 && ' (auf 1000 begrenzt)'}
                </span>
                {result.rows.length > 0 && (
                  <button
                    onClick={downloadCsv}
                    className="text-xs font-semibold px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg"
                  >
                    ⬇ CSV-Export
                  </button>
                )}
              </div>

              {result.rows.length === 0 ? (
                <p className="text-sm text-gray-400 py-8 text-center">Keine Ergebnisse.</p>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                          {columns.map((c) => (
                            <th key={c} className="text-left font-semibold text-gray-600 px-3 py-2 whitespace-nowrap">
                              {c}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.rows.map((row, i) => (
                          <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                            {columns.map((c) => (
                              <td key={c} className="px-3 py-2 text-gray-800 whitespace-nowrap">
                                {row[c] === null || row[c] === undefined
                                  ? '—'
                                  : typeof row[c] === 'object'
                                    ? JSON.stringify(row[c])
                                    : String(row[c])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
