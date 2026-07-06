'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Extraktion {
  dokumenttyp: string
  kontakt_typ: 'privat' | 'gewerbe'
  first_name: string
  last_name: string
  company_name: string
  email: string
  phone: string
  street: string
  postal_code: string
  city: string
  country: string
  versicherungsgesellschaft: string
  versicherungstyp: string
  sparte: string
  vertragsnummer: string
  beitrag: string
  zahlweise: string
  vertragsbeginn: string
  vertragsende: string
  kategorie: string
  zusammenfassung: string
  weitere_personen: string[]
}

interface Duplikat {
  id: string
  first_name: string
  last_name: string
  email: string | null
  company_name: string | null
}

interface StrukturNode {
  name: string
  children?: StrukturNode[]
}

function flatten(nodes: StrukturNode[]): string[] {
  const paths: string[] = []
  for (const n of nodes) {
    paths.push(n.name)
    for (const c of n.children ?? []) paths.push(`${n.name}/${c.name}`)
  }
  return paths
}

type Phase = 'upload' | 'analysiere' | 'pruefen' | 'speichere' | 'fertig'

export default function KiUploadPage() {
  const [phase, setPhase] = useState<Phase>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [daten, setDaten] = useState<Extraktion | null>(null)
  const [duplikat, setDuplikat] = useState<Duplikat | null>(null)
  const [anBestehenden, setAnBestehenden] = useState(true)
  const [struktur, setStruktur] = useState<{ privat: string[]; gewerbe: string[] }>({ privat: [], gewerbe: [] })
  const [ergebnis, setErgebnis] = useState<{ kontakt_id: string; kontakt_neu: boolean } | null>(null)

  useEffect(() => {
    fetch('/api/dokument-kategorien')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setStruktur({ privat: flatten(d.data.privat || []), gewerbe: flatten(d.data.gewerbe || []) })
        }
      })
      .catch(() => {})
  }, [])

  async function analysiere(f: File) {
    setFile(f)
    setError(null)
    setPhase('analysiere')
    try {
      const fd = new FormData()
      fd.append('file', f)
      const res = await fetch('/api/ki-upload/analyze', { method: 'POST', body: fd })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Analyse fehlgeschlagen')
      setDaten(data.extraktion)
      setDuplikat(data.duplikat)
      setAnBestehenden(!!data.duplikat)
      setPhase('pruefen')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analyse fehlgeschlagen')
      setPhase('upload')
    }
  }

  async function commit() {
    if (!file || !daten) return
    setError(null)
    setPhase('speichere')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append(
        'daten',
        JSON.stringify({
          ...daten,
          phone: daten.phone,
          existing_kontakt_id: duplikat && anBestehenden ? duplikat.id : undefined,
        })
      )
      const res = await fetch('/api/ki-upload/commit', { method: 'POST', body: fd })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Speichern fehlgeschlagen')
      setErgebnis({ kontakt_id: data.kontakt_id, kontakt_neu: data.kontakt_neu })
      setPhase('fertig')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen')
      setPhase('pruefen')
    }
  }

  function reset() {
    setPhase('upload')
    setFile(null)
    setDaten(null)
    setDuplikat(null)
    setErgebnis(null)
    setError(null)
  }

  const set = (feld: keyof Extraktion, wert: string) =>
    setDaten((d) => (d ? { ...d, [feld]: wert } : d))

  const kategorien = daten ? struktur[daten.kontakt_typ] : []

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">🤖 KI Upload</h1>
        <p className="text-gray-600 mb-8">
          Versicherungsdokument hochladen — die KI erkennt den Kunden, legt den Kontakt an und
          ordnet die Datei automatisch in Google Drive ein.
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
            ❌ {error}
          </div>
        )}

        {/* Phase: Upload */}
        {phase === 'upload' && (
          <div
            onDragEnter={(e) => { e.preventDefault(); setDragActive(true) }}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
            onDragLeave={(e) => { e.preventDefault(); setDragActive(false) }}
            onDrop={(e) => {
              e.preventDefault()
              setDragActive(false)
              const f = e.dataTransfer.files?.[0]
              if (f) analysiere(f)
            }}
            className={`border-2 border-dashed rounded-2xl p-12 text-center transition-colors bg-white ${
              dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input
              type="file"
              id="ki-file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.currentTarget.files?.[0]
                if (f) analysiere(f)
              }}
            />
            <label htmlFor="ki-file" className="cursor-pointer">
              <div className="text-5xl mb-4">📄</div>
              <p className="text-lg font-semibold text-gray-900">Police, Angebot oder Nachtrag hochladen</p>
              <p className="text-sm text-gray-600 mt-1">PDF oder Foto — ziehen oder klicken (max. 30 MB)</p>
            </label>
          </div>
        )}

        {/* Phase: Analysiere / Speichere */}
        {(phase === 'analysiere' || phase === 'speichere') && (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <div className="animate-spin text-4xl mb-4">⚙️</div>
            <p className="text-lg font-semibold text-gray-900">
              {phase === 'analysiere' ? 'KI analysiert das Dokument…' : 'Kontakt wird angelegt & Dokument abgelegt…'}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              {phase === 'analysiere'
                ? `${file?.name} — gescannte Dokumente können etwas dauern`
                : 'Automationen (Regeln, Syncs) laufen mit'}
            </p>
          </div>
        )}

        {/* Phase: Pruefmaske */}
        {phase === 'pruefen' && daten && (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
              📄 <strong>{file?.name}</strong> — {daten.zusammenfassung}
              {daten.weitere_personen.length > 0 && (
                <span className="block mt-1">
                  👥 Weitere Personen im Dokument (landen in den Notizen): {daten.weitere_personen.join(', ')}
                </span>
              )}
            </div>

            {duplikat && (
              <div className="p-4 bg-yellow-50 border border-yellow-300 rounded-lg text-sm">
                <p className="font-semibold text-yellow-900 mb-2">
                  ⚠️ Möglicher bestehender Kontakt: {duplikat.first_name} {duplikat.last_name}
                  {duplikat.company_name ? ` (${duplikat.company_name})` : ''}
                  {duplikat.email ? ` — ${duplikat.email}` : ''}
                </p>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={anBestehenden} onChange={() => setAnBestehenden(true)} />
                    <span>Dokument an bestehenden Kontakt anhängen</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={!anBestehenden} onChange={() => setAnBestehenden(false)} />
                    <span>Trotzdem neuen Kontakt anlegen</span>
                  </label>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
              {/* Kontakt-Typ */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Kontakt-Typ</label>
                <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
                  {([['gewerbe', '🏢 Gewerbe'], ['privat', '👤 Privat']] as const).map(([v, l]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setDaten((d) => (d ? { ...d, kontakt_typ: v } : d))}
                      className={`px-4 py-2 text-sm font-medium ${
                        daten.kontakt_typ === v ? 'bg-yellow-400 text-gray-900' : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Kontaktdaten */}
              <div className="grid grid-cols-2 gap-4">
                {([
                  ['first_name', 'Vorname *'],
                  ['last_name', 'Nachname *'],
                  ['company_name', 'Firma'],
                  ['email', 'E-Mail'],
                  ['phone', 'Telefon'],
                  ['street', 'Straße'],
                  ['postal_code', 'PLZ'],
                  ['city', 'Stadt'],
                ] as [keyof Extraktion, string][]).map(([feld, label]) => (
                  <div key={feld}>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">{label}</label>
                    <input
                      type="text"
                      value={(daten[feld] as string) || ''}
                      onChange={(e) => set(feld, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400/40"
                    />
                  </div>
                ))}
              </div>

              {/* Versicherungsdaten */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm font-semibold text-gray-900 mb-3">🛡️ Versicherungsdaten</p>
                <div className="grid grid-cols-2 gap-4">
                  {([
                    ['versicherungsgesellschaft', 'Gesellschaft'],
                    ['versicherungstyp', 'Versicherungstyp'],
                    ['vertragsnummer', 'Vertragsnummer'],
                    ['beitrag', 'Beitrag'],
                    ['zahlweise', 'Zahlweise'],
                    ['sparte', 'Sparte'],
                  ] as [keyof Extraktion, string][]).map(([feld, label]) => (
                    <div key={feld}>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">{label}</label>
                      <input
                        type="text"
                        value={(daten[feld] as string) || ''}
                        onChange={(e) => set(feld, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400/40"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Ablage */}
              <div className="border-t border-gray-100 pt-4">
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  🗂️ Ablegen unter (Google Drive)
                </label>
                <select
                  value={daten.kategorie}
                  onChange={(e) => set('kategorie', e.target.value)}
                  className="w-full max-w-sm px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400/40"
                >
                  {kategorien.map((k) => (
                    <option key={k} value={k}>{k.replace('/', ' / ')}</option>
                  ))}
                  <option value="Sonstiges">Sonstiges</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={commit}
                disabled={!daten.first_name || !daten.last_name}
                className="px-6 py-3 bg-yellow-400 text-gray-900 font-semibold rounded-lg hover:bg-yellow-500 disabled:opacity-50"
              >
                ✓ {duplikat && anBestehenden ? 'Dokument anhängen' : 'Kontakt anlegen & ablegen'}
              </button>
              <button onClick={reset} className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                Abbrechen
              </button>
            </div>
          </div>
        )}

        {/* Phase: Fertig */}
        {phase === 'fertig' && ergebnis && (
          <div className="bg-white rounded-2xl border-2 border-green-200 p-8 text-center space-y-4">
            <div className="text-5xl">✅</div>
            <p className="text-lg font-semibold text-gray-900">
              {ergebnis.kontakt_neu ? 'Kontakt angelegt und Dokument abgelegt!' : 'Dokument beim bestehenden Kontakt abgelegt!'}
            </p>
            <p className="text-sm text-gray-600">
              Quelle: KI Upload — Automationen und Ablage sind durchgelaufen.
            </p>
            <div className="flex justify-center gap-3">
              <Link
                href={`/kontakte/${ergebnis.kontakt_id}`}
                className="px-5 py-2.5 bg-yellow-400 text-gray-900 font-semibold rounded-lg hover:bg-yellow-500"
              >
                → Zum Kontakt
              </Link>
              <button onClick={reset} className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                Nächstes Dokument
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
