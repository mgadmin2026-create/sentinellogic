'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { formatBytes, formatDate } from '@/lib/utils'
import { HelpButton } from '@/components/help/HelpButton'
import { DOKUMENTTYP_FILTER_OPTIONEN, dokumenttypZuFilter, dokumenttypBadgeLabel, type DokumenttypFilter } from '@/lib/dokumenttyp'

interface Dokument {
  id: string
  file_id: string
  file_name: string
  file_type: string | null
  kategorie?: string
  dokumenttyp?: string | null
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
  const [filterTyp, setFilterTyp] = useState<DokumenttypFilter>('alle')
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
      const res = await fetch('/api/dokumente', { cache: 'no-store' })
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
    return dokumente.filter((d) => {
      if (filterTyp !== 'alle' && dokumenttypZuFilter(d.dokumenttyp) !== filterTyp) return false
      if (!q) return true
      return d.file_name.toLowerCase().includes(q) || d.kontakt_name.toLowerCase().includes(q)
    })
  }, [dokumente, search, filterTyp])

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-full">
      {/* Header — Titel, Stats und Google-Drive-Link in einer Zeile statt
          gestapelter Blöcke, damit oben weniger Platz vor der eigentlichen
          Dokumentenliste verloren geht. */}
      <div className="flex items-center justify-between mb-3 gap-4 flex-wrap">
        <div className="flex items-center gap-1.5">
          <h1 className="text-2xl font-bold text-gray-900">Dokumente</h1>
          <HelpButton articleId="dokumente.overview" />
          <span className="text-sm text-gray-400 ml-1">
            {stats.count} Dokumente · {formatBytes(stats.totalCompressed)} · <span className="text-green-600">{formatBytes(stats.totalSaved)} gespart</span>
          </span>
          <HelpButton articleId="dokumente.stats" />
        </div>
        {rootFolderUrl && (
          <a
            href={rootFolderUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold text-sm px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
          >
            📁 Google Drive öffnen
          </a>
        )}
      </div>

      {/* Nicht verbunden Hinweis */}
      {connected === false && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm flex items-center gap-2">
          <span>
            Google Drive ist noch nicht verbunden.{' '}
            <Link href="/einstellungen/dokumente" className="font-semibold underline">
              Jetzt verbinden →
            </Link>
          </span>
          <HelpButton articleId="dokumente.google-drive-verbindung" className="text-amber-500 hover:text-amber-800 transition-colors flex-shrink-0" />
        </div>
      )}

      {/* Suche + Typ-Filter in einer Zeile */}
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <div className="relative max-w-md flex-1 min-w-[14rem]">
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
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400"
          />
          <HelpButton articleId="dokumente.suche-tabelle" className="absolute right-2 top-1/2 -translate-y-1/2" />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {DOKUMENTTYP_FILTER_OPTIONEN.map((o) => (
            <button
              key={o.value}
              onClick={() => setFilterTyp(o.value)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                filterTyp === o.value
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              {o.label}
            </button>
          ))}
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
                      <span className="flex items-center gap-2 max-w-xs">
                        <span className="font-medium text-gray-900 truncate">📄 {d.file_name}</span>
                        <span className="inline-flex flex-shrink-0 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                          {(d.kategorie || 'Sonstiges').replace('/', ' / ')}
                        </span>
                        {d.dokumenttyp && (
                          <span className="inline-flex flex-shrink-0 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium">
                            {dokumenttypBadgeLabel(d.dokumenttyp)}
                          </span>
                        )}
                      </span>
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
