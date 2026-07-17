'use client'

import { useState, useCallback, useEffect } from 'react'
import { formatBytes, formatDate } from '@/lib/utils'

interface Dokument {
  id: string
  file_id: string
  file_name: string
  kategorie?: string
  original_size: number
  compressed_size: number
  compression_ratio: number
  created_at: string
}

interface StrukturNode {
  name: string
  children?: StrukturNode[]
}

interface KontaktDokumenteTabProps {
  kontaktId: string
}

// Baum des Kontakt-Typs zu waehlbaren Pfaden flachklopfen (max. 2 Ebenen)
function flattenStruktur(nodes: StrukturNode[]): string[] {
  const paths: string[] = []
  for (const node of nodes) {
    paths.push(node.name)
    for (const child of node.children ?? []) {
      paths.push(`${node.name}/${child.name}`)
    }
  }
  return paths
}

export function KontaktDokumenteTab({ kontaktId }: KontaktDokumenteTabProps) {
  const [dokumente, setDokumente] = useState<Dokument[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [stats, setStats] = useState({
    count: 0,
    totalSize: 0,
    totalOriginalSize: 0,
  })
  const [ordnerUrl, setOrdnerUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [kategorien, setKategorien] = useState<string[]>([])
  const [uploadKategorie, setUploadKategorie] = useState('Sonstiges')
  const [filterKategorie, setFilterKategorie] = useState<string>('alle')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [newFileName, setNewFileName] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)

  // Fetch documents on mount
  useEffect(() => {
    loadDokumente()
  }, [kontaktId])

  const loadDokumente = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/kontakte/${kontaktId}/dokumente`)
      const data = await res.json()

      if (data.success) {
        setDokumente(data.dokumente || [])
        setOrdnerUrl(data.kontakt.ordner_url || null)
        setStats({
          count: data.kontakt.dokumente_count,
          totalSize: data.kontakt.dokumente_total_size,
          totalOriginalSize: data.dokumente?.reduce((sum: number, d: Dokument) => sum + d.original_size, 0) || 0,
        })

        // Ordnerstruktur des Kontakt-Typs laden (privat/gewerbe)
        const typ = data.kontakt.kontakt_typ === 'privat' ? 'privat' : 'gewerbe'
        try {
          const strukturRes = await fetch('/api/dokument-kategorien')
          const strukturData = await strukturRes.json()
          if (strukturData.success) {
            setKategorien(flattenStruktur(strukturData.data[typ] || []))
          }
        } catch {
          // Struktur nicht ladbar -> nur "Sonstiges"
        }
      }
    } catch (err) {
      setError('Fehler beim Laden der Dokumente')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleRename = async (dokumentId: string, currentName: string) => {
    setRenamingId(dokumentId)
    setNewFileName(currentName)
  }

  const commitRename = async (dokumentId: string) => {
    if (!newFileName.trim() || newFileName === dokumente.find(d => d.id === dokumentId)?.file_name) {
      setRenamingId(null)
      return
    }

    try {
      const res = await fetch(`/api/kontakte/${kontaktId}/dokumente`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dokumentId, newFileName: newFileName.trim() }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Fehler')
      await loadDokumente()
      setRenamingId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Umbenennen')
    }
  }

  const handleDelete = async (dokumentId: string) => {
    if (confirm('Dokument wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) {
      setDeletingId(dokumentId)
      try {
        const res = await fetch(`/api/kontakte/${kontaktId}/dokumente`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dokumentId }),
        })
        const data = await res.json()
        if (!data.success) throw new Error(data.error || 'Fehler')
        await loadDokumente()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler beim Löschen')
      } finally {
        setDeletingId(null)
      }
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      uploadFiles(files)
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files
    if (files && files.length > 0) {
      uploadFiles(files)
    }
  }

  const uploadFiles = async (files: FileList) => {
    try {
      setUploading(true)
      setError(null)
      setWarning(null)

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const formData = new FormData()
        formData.append('file', file)
        formData.append('kategorie', uploadKategorie)

        const res = await fetch(`/api/kontakte/${kontaktId}/dokumente`, {
          method: 'POST',
          body: formData,
        })

        // Response einmal auslesen (kann nur einmal gelesen werden)
        const data = await res.json()

        if (!res.ok) {
          if (res.status === 409) {
            throw new Error(
              data?.error ||
                'Google Drive ist noch nicht verbunden. Bitte in Einstellungen → Dokumente verbinden.'
            )
          }
          throw new Error(data?.error || `Upload fehlgeschlagen: ${file.name}`)
        }

        // Prüfe auf Name-Duplikate (andere Kontakte mit ähnlichem Namen)
        if (data.nameDuplicate) {
          const dupMsg = `⚠️ Kontakt-Duplikat erkannt: ${data.nameDuplicate.first_name} ${data.nameDuplicate.last_name}${data.nameDuplicate.email ? ` (${data.nameDuplicate.email})` : ''}`
          setWarning(dupMsg)
        }
      }

      // Reload dokumente after successful upload
      await loadDokumente()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload fehlgeschlagen')
      console.error(err)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">📄 Dokumente</h3>
          <p className="text-sm text-gray-600 mt-1">{stats.count} Dokumente, {formatBytes(stats.totalSize)} gespeichert</p>
        </div>
        {ordnerUrl && (
          <a
            href={ordnerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition"
          >
            📁 In Google Drive öffnen →
          </a>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          {error}
        </div>
      )}

      {/* Warning message */}
      {warning && (
        <div className="p-4 bg-yellow-50 border border-yellow-300 rounded-lg text-yellow-800 text-sm">
          {warning}
        </div>
      )}

      {/* Kategorie-Auswahl fuer Upload */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
          🗂️ Ablegen unter:
        </label>
        <select
          value={uploadKategorie}
          onChange={(e) => setUploadKategorie(e.target.value)}
          disabled={uploading}
          className="flex-1 max-w-xs px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400/40 bg-white"
        >
          {kategorien.map((pfad) => (
            <option key={pfad} value={pfad}>
              {pfad.replace('/', ' / ')}
            </option>
          ))}
          <option value="Sonstiges">Sonstiges</option>
        </select>
      </div>

      {/* Upload zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-xl p-8 transition-colors ${
          dragActive
            ? 'border-yellow-400 bg-yellow-50'
            : 'border-gray-300 bg-gray-50 hover:border-gray-400'
        }`}
      >
        <input
          type="file"
          id="file-input"
          multiple
          onChange={handleFileInput}
          disabled={uploading}
          className="hidden"
        />
        <label
          htmlFor="file-input"
          className="flex flex-col items-center justify-center cursor-pointer"
        >
          <svg
            className="w-12 h-12 text-gray-400 mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
            />
          </svg>
          <p className="text-lg font-medium text-gray-900">
            Dateien hochladen
          </p>
          <p className="text-sm text-gray-600 mt-1">
            Ziehen Sie Dateien hierher oder klicken zum Auswählen
          </p>
          {uploading && (
            <p className="text-sm text-yellow-600 mt-2">⏳ Wird hochgeladen...</p>
          )}
        </label>
      </div>

      {/* Documents list */}
      {loading ? (
        <div className="text-center py-8 text-gray-600">Wird geladen...</div>
      ) : dokumente.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-600">Keine Dokumente vorhanden</p>
          <p className="text-sm text-gray-500 mt-1">Laden Sie Ihr erstes Dokument oben hoch</p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-gray-900">
              📋 Alle Dokumente ({dokumente.length})
            </p>
            <select
              value={filterKategorie}
              onChange={(e) => setFilterKategorie(e.target.value)}
              className="px-2 py-1 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none"
            >
              <option value="alle">Alle Kategorien</option>
              {Array.from(new Set(dokumente.map((d) => d.kategorie || 'Sonstiges'))).sort().map((k) => (
                <option key={k} value={k}>{k.replace('/', ' / ')}</option>
              ))}
            </select>
          </div>
          <div className="divide-y divide-gray-150">
            {dokumente
              .filter((doc) => filterKategorie === 'alle' || (doc.kategorie || 'Sonstiges') === filterKategorie)
              .map((doc) => (
              <div key={doc.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {renamingId === doc.id ? (
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="text"
                          value={newFileName}
                          onChange={(e) => setNewFileName(e.target.value)}
                          className="flex-1 px-2 py-1 text-sm border border-yellow-300 rounded focus:outline-none focus:ring-2 focus:ring-yellow-400"
                          autoFocus
                        />
                        <button
                          onClick={() => commitRename(doc.id)}
                          className="px-2 py-1 text-xs font-semibold bg-green-100 text-green-700 hover:bg-green-200 rounded"
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => setRenamingId(null)}
                          className="px-2 py-1 text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 rounded"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 min-w-0">
                        <a
                          href={`https://drive.google.com/file/d/${doc.file_id}/view`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-gray-900 truncate hover:text-blue-600 hover:underline"
                          title="In Google Drive öffnen"
                        >
                          📄 {doc.file_name}
                        </a>
                        <span className="inline-flex flex-shrink-0 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                          {(doc.kategorie || 'Sonstiges').replace('/', ' / ')}
                        </span>
                        <a
                          href={`https://drive.google.com/file/d/${doc.file_id}/view`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 text-xs text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Öffnen ↗
                        </a>
                      </div>
                    )}
                    <div className="flex gap-3 mt-2 text-xs text-gray-600">
                      <span>
                        Original: <strong>{formatBytes(doc.original_size)}</strong>
                      </span>
                      <span className="text-gray-400">→</span>
                      <span>
                        Komprimiert: <strong>{formatBytes(doc.compressed_size)}</strong>
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 flex flex-col items-end gap-2">
                    {renamingId !== doc.id && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleRename(doc.id, doc.file_name)}
                          className="px-2 py-1 text-xs font-medium text-gray-600 hover:bg-yellow-50 rounded transition"
                          title="Umbenennen"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(doc.id)}
                          disabled={deletingId === doc.id}
                          className="px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 rounded transition"
                          title="Löschen"
                        >
                          {deletingId === doc.id ? '⏳' : '🗑️'}
                        </button>
                      </div>
                    )}
                    <div className="bg-green-50 px-2 py-1 rounded text-xs font-semibold text-green-700">
                      ↓ {doc.compression_ratio}%
                    </div>
                    <p className="text-xs text-gray-500">
                      {formatDate(doc.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Savings info */}
      {dokumente.length > 0 && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          <strong>✓ Speicher gespart:</strong> {formatBytes(stats.totalOriginalSize - stats.totalSize)} durch Komprimierung
        </div>
      )}
    </div>
  )
}
