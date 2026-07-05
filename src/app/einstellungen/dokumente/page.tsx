'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

interface DriveStatus {
  connected: boolean
  email?: string | null
  rootFolderUrl?: string | null
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
      </div>
    </div>
  )
}
