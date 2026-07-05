'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

interface DriveStatus {
  connected: boolean
  email?: string | null
  rootFolderUrl?: string | null
}

interface StrukturNode {
  name: string
  children?: StrukturNode[]
}

interface Ordnerstruktur {
  privat: StrukturNode[]
  gewerbe: StrukturNode[]
}

export default function DokumenteSettingsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50" />}>
      <DokumenteSettingsInner />
    </Suspense>
  )
}

function DokumenteSettingsInner() {
  const searchParams = useSearchParams()
  const connectedParam = searchParams.get('connected')
  const errorParam = searchParams.get('error')

  const [status, setStatus] = useState<DriveStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/google-drive/status')
      .then((r) => r.json())
      .then((data) => setStatus(data))
      .catch(() => setStatus({ connected: false }))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link href="/einstellungen" className="text-sm text-blue-600 hover:text-blue-700">
          ← Zurück zu Einstellungen
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 mb-2 mt-4">📄 Dokumente & Google Drive</h1>
        <p className="text-gray-600 mb-8">
          Alle hochgeladenen Dokumente werden zentral in einem einzigen Google-Drive-Konto
          gespeichert. Verbinde dieses System-Konto einmalig.
        </p>

        {connectedParam && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
            ✅ Google Drive erfolgreich verbunden.
          </div>
        )}
        {errorParam && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
            ❌ Verbindung fehlgeschlagen: {errorParam}
          </div>
        )}

        <div className="rounded-lg border-2 border-blue-200 bg-white p-6">
          {loading ? (
            <p className="text-gray-500">Status wird geladen...</p>
          ) : status?.connected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-800 text-sm font-semibold">
                  ● Verbunden
                </span>
                {status.email && (
                  <span className="text-gray-700 text-sm">{status.email}</span>
                )}
              </div>

              {status.rootFolderUrl && (
                <a
                  href={status.rootFolderUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-sm text-blue-600 hover:text-blue-700"
                >
                  📁 Zentralen Ordner in Google Drive öffnen →
                </a>
              )}

              <div className="pt-2">
                <a
                  href="/api/auth/google/start"
                  className="inline-block px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Anderes Konto verbinden
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-sm font-semibold">
                  ○ Nicht verbunden
                </span>
              </div>
              <p className="text-gray-600 text-sm">
                Melde dich mit dem Google-Konto an, in dem alle Dokumente abgelegt werden sollen.
                Diese Autorisierung ist nur einmal nötig.
              </p>
              <a
                href="/api/auth/google/start"
                className="inline-flex items-center gap-2 px-5 py-3 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition"
              >
                🔗 Mit Google Drive verbinden
              </a>
            </div>
          )}
        </div>

        <OrdnerstrukturEditor />
      </div>
    </div>
  )
}

/**
 * Konfigurierbare Ordnerstruktur je Kontakt-Typ (Privat/Gewerbe), max. 2 Ebenen.
 * Umbenennungen werden auf alle bestehenden Google-Drive-Ordner propagiert.
 */
function OrdnerstrukturEditor() {
  const [struktur, setStruktur] = useState<Ordnerstruktur | null>(null)
  const [typ, setTyp] = useState<'gewerbe' | 'privat'>('gewerbe')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [newName, setNewName] = useState('')

  useEffect(() => {
    fetch('/api/dokument-kategorien')
      .then((r) => r.json())
      .then((data) => data.success && setStruktur(data.data))
      .catch(() => setMsg({ type: 'error', text: 'Struktur konnte nicht geladen werden' }))
  }, [])

  async function persist(next: Ordnerstruktur): Promise<boolean> {
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/dokument-kategorien', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })
      const data = await res.json()
      if (!data.success) {
        setMsg({ type: 'error', text: data.error || 'Speichern fehlgeschlagen' })
        return false
      }
      setStruktur(next)
      return true
    } catch {
      setMsg({ type: 'error', text: 'Speichern fehlgeschlagen' })
      return false
    } finally {
      setBusy(false)
    }
  }

  function validateName(name: string): string | null {
    const n = name.trim()
    if (!n) return null
    if (n.includes('/')) {
      setMsg({ type: 'error', text: 'Schrägstrich ist im Namen nicht erlaubt' })
      return null
    }
    if (n.toLowerCase() === 'sonstiges') {
      setMsg({ type: 'error', text: '"Sonstiges" ist als Fallback immer vorhanden' })
      return null
    }
    return n
  }

  async function addKategorie() {
    if (!struktur) return
    const name = validateName(newName)
    if (!name) return
    const next = structuredClone(struktur)
    if (next[typ].some((n) => n.name.toLowerCase() === name.toLowerCase())) {
      setMsg({ type: 'error', text: `"${name}" existiert bereits` })
      return
    }
    next[typ].push({ name })
    if (await persist(next)) setNewName('')
  }

  async function addUnterkategorie(parentIdx: number) {
    if (!struktur) return
    const input = window.prompt('Name der Unterkategorie:')
    if (input == null) return
    const name = validateName(input)
    if (!name) return
    const next = structuredClone(struktur)
    const parent = next[typ][parentIdx]
    parent.children = parent.children ?? []
    if (parent.children.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      setMsg({ type: 'error', text: `"${name}" existiert bereits unter "${parent.name}"` })
      return
    }
    parent.children.push({ name })
    await persist(next)
  }

  async function renameNode(parentIdx: number, childIdx: number | null) {
    if (!struktur) return
    const node =
      childIdx == null ? struktur[typ][parentIdx] : struktur[typ][parentIdx].children![childIdx]
    const input = window.prompt('Neuer Name (wird auf alle bestehenden Drive-Ordner angewendet):', node.name)
    if (input == null) return
    const name = validateName(input)
    if (!name || name === node.name) return

    const parentName = childIdx == null ? null : struktur[typ][parentIdx].name
    const oldPfad = parentName ? `${parentName}/${node.name}` : node.name
    const newPfad = parentName ? `${parentName}/${name}` : name

    setBusy(true)
    setMsg(null)
    try {
      // 1) Drive-Ordner + Metadaten propagieren
      const res = await fetch('/api/dokument-kategorien', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rename', typ, oldPfad, newPfad }),
      })
      const data = await res.json()
      if (!data.success) {
        setMsg({ type: 'error', text: data.error || 'Umbenennen fehlgeschlagen' })
        return
      }

      // 2) Struktur speichern
      const next = structuredClone(struktur)
      if (childIdx == null) next[typ][parentIdx].name = name
      else next[typ][parentIdx].children![childIdx].name = name
      if (await persist(next)) {
        setMsg({
          type: 'ok',
          text:
            data.renamed > 0
              ? `Umbenannt — ${data.renamed} Drive-Ordner angepasst${data.failed ? `, ${data.failed} fehlgeschlagen` : ''}`
              : 'Umbenannt (keine bestehenden Drive-Ordner betroffen)',
        })
      }
    } catch {
      setMsg({ type: 'error', text: 'Umbenennen fehlgeschlagen' })
    } finally {
      setBusy(false)
    }
  }

  async function deleteNode(parentIdx: number, childIdx: number | null) {
    if (!struktur) return
    const node =
      childIdx == null ? struktur[typ][parentIdx] : struktur[typ][parentIdx].children![childIdx]
    const ok = window.confirm(
      `"${node.name}" aus der Struktur entfernen?\n\nBestehende Drive-Ordner und Dokumente bleiben unverändert — nur neue Uploads können diese Kategorie nicht mehr wählen.`
    )
    if (!ok) return
    const next = structuredClone(struktur)
    if (childIdx == null) next[typ].splice(parentIdx, 1)
    else next[typ][parentIdx].children!.splice(childIdx, 1)
    await persist(next)
  }

  return (
    <div className="mt-8 rounded-lg border-2 border-blue-200 bg-white p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-1">🗂️ Ordnerstruktur pro Kontakt</h2>
      <p className="text-sm text-gray-600 mb-4">
        Diese Unterordner werden im Kunden-Ordner angelegt, sobald das erste Dokument der
        Kategorie hochgeladen wird. „Sonstiges" ist immer verfügbar. Max. 2 Ebenen.
      </p>

      {/* Typ-Tabs */}
      <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden mb-4">
        {(
          [
            { value: 'gewerbe', label: '🏢 Gewerbe' },
            { value: 'privat', label: '👤 Privat' },
          ] as const
        ).map((opt) => (
          <button
            key={opt.value}
            onClick={() => setTyp(opt.value)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              typ === opt.value ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {msg && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm ${
            msg.type === 'ok'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {msg.text}
        </div>
      )}

      {!struktur ? (
        <p className="text-gray-500 text-sm">Wird geladen...</p>
      ) : (
        <div className="space-y-2">
          {struktur[typ].length === 0 && (
            <p className="text-sm text-gray-500">Noch keine Kategorien — unten hinzufügen.</p>
          )}
          {struktur[typ].map((node, i) => (
            <div key={`${node.name}-${i}`} className="border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-sm font-medium text-gray-900">📁 {node.name}</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => addUnterkategorie(i)}
                    disabled={busy}
                    className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded disabled:opacity-50"
                    title="Unterkategorie hinzufügen"
                  >
                    + Unterordner
                  </button>
                  <button
                    onClick={() => renameNode(i, null)}
                    disabled={busy}
                    className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50"
                  >
                    ✏️ Umbenennen
                  </button>
                  <button
                    onClick={() => deleteNode(i, null)}
                    disabled={busy}
                    className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              {(node.children ?? []).length > 0 && (
                <div className="border-t border-gray-100 divide-y divide-gray-50">
                  {node.children!.map((child, j) => (
                    <div key={`${child.name}-${j}`} className="flex items-center justify-between pl-8 pr-3 py-1.5">
                      <span className="text-sm text-gray-700">↳ 📁 {child.name}</span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => renameNode(i, j)}
                          disabled={busy}
                          className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => deleteNode(i, j)}
                          disabled={busy}
                          className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Fallback-Hinweis */}
          <div className="flex items-center px-3 py-2 border border-dashed border-gray-200 rounded-lg">
            <span className="text-sm text-gray-400">📁 Sonstiges (immer vorhanden)</span>
          </div>

          {/* Neue Kategorie */}
          <div className="flex gap-2 pt-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addKategorie()}
              placeholder="Neue Kategorie, z.B. Rechtsschutz"
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40"
            />
            <button
              onClick={addKategorie}
              disabled={busy || !newName.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              + Hinzufügen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
