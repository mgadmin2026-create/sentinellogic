'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { formatBytes, formatDate } from '@/lib/utils'

interface Dokument {
  id: string
  file_id: string
  file_name: string
  file_type: string | null
  original_size: number
  compressed_size: number
  compression_ratio: number
  created_at: string
  kontakt_id: string
  kontakt_name: string
  drive_url: string
  ordner_url: string
}

interface Stats {
  count: number
  totalCompressed: number
  totalSaved: number
}

export default function DokumentePage() {
  const [dokumente, setDokumente] = useState<Dokument[]>([])
  const [stats, setStats] = useState<Stats>({ count: 0, totalCompressed: 0, totalSaved: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [rootFolderUrl, setRootFolderUrl] = useState<string | null>(null)
  const [connected, setConnected] = useState<boolean | null>(null)

  useEffect(() => {
    load()
    fetch('/api/google-drive/status')
      .then((r) => r.json())
      .then((d) => {
        setConnected(!!d.connected)
        setRootFolderUrl(d.rootFolderUrl || null)
      })
      .catch(() => setConnected(null))
  }, [])

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/dokumente')
      const data = await res.json()
      if (data.success) {
        setDokumente(data.dokumente || [])
        setStats(data.stats)
      } else {
        setError(data.error || 'Fehler beim Laden')
      }
    } catch {
      setError('Fehler beim Laden der Dokumente')
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return dokumente
    return dokumente.filter(
      (d) =>
        d.file_name.toLowerCase().includes(q) ||
        d.kontakt_name.toLowerCase().includes(q)
    )
  }, [dokumente, search])

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap sm:flex-nowrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dokumente</h1>
          <p className="text-gray-600 mt-1 text-sm">
            Alle Dokumente über alle Kontakte, zentral in Google Drive
          </p>
        </div>
        {rootFolderUrl && (
          <a
            href={rootFolderUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors whitespace-nowrap"
          >
            📁 Google Drive öffnen
          </a>
        )}
      </div>

      {/* Nicht verbunden Hinweis */}
      {connected === false && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
          Google Drive ist noch nicht verbunden.{' '}
          <Link href="/einstellungen/dokumente" className="font-semibold underline">
            Jetzt verbinden →
          </Link>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Dokumente</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.count}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Gesamt (komprimiert)</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatBytes(stats.totalCompressed)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Speicher gespart</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{formatBytes(stats.totalSaved)}</p>
        </div>
      </div>

      {/* Suche */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nach Datei oder Kontakt suchen…"
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400"
          />
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>
      )}

      {/* Tabelle */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Datei</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Kontakt</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 hidden md:table-cell">Original → Komprimiert</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Ersparnis</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 hidden sm:table-cell">Datum</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center text-gray-400 py-16 text-sm">Wird geladen…</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-gray-400 py-16 text-sm">
                    {search ? 'Keine Treffer' : 'Noch keine Dokumente hochgeladen'}
                  </td>
                </tr>
              ) : (
                filtered.map((d) => (
                  <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900 truncate block max-w-xs">📄 {d.file_name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/kontakte/${d.kontakt_id}`} className="text-blue-600 hover:text-blue-700 hover:underline">
                        {d.kontakt_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap hidden md:table-cell">
                      {formatBytes(d.original_size)} <span className="text-gray-300">→</span> {formatBytes(d.compressed_size)}
                    </td>
                    <td className="px-4 py-3">
                      {d.compression_ratio > 0 ? (
                        <span className="inline-flex text-xs font-semibold px-2 py-1 rounded-full bg-green-50 text-green-700">
                          ↓ {d.compression_ratio}%
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap hidden sm:table-cell">{formatDate(d.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <a
                        href={d.drive_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 text-xs font-medium"
                      >
                        Öffnen ↗
                      </a>
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
