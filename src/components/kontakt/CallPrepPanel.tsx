'use client'
// Drawer-Inhalt für den Call-Vorbereitungs-Agenten: aggregiert vorhandene
// CRM-Daten server-seitig und lässt Claude eine kurze, interne Zusammenfassung
// generieren (Kurzprofil + Gesprächsvorschläge + sensible Punkte). Wird beim
// Öffnen automatisch angestoßen. Nichts wird automatisch gespeichert — nur bei
// explizitem Klick auf "Als Notiz speichern" landet die Zusammenfassung im
// Kontaktverlauf (contact_notes_history).
import { useEffect, useState, useCallback } from 'react'
import { HelpButton } from '@/components/help/HelpButton'

interface CallPrepResult {
  summary: string
  talking_points: string[]
  flags: string[]
  generated_at: string
}

interface CallPrepPanelProps {
  kontaktId: string
}

export function CallPrepPanel({ kontaktId }: CallPrepPanelProps) {
  const [status, setStatus] = useState<'loading' | 'error' | 'done'>('loading')
  const [error, setError] = useState('')
  const [result, setResult] = useState<CallPrepResult | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const generate = useCallback(async () => {
    setStatus('loading')
    setError('')
    setSaved(false)
    try {
      const res = await fetch('/api/agents/call-prep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: kontaktId }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Gesprächsvorbereitung fehlgeschlagen')
      setResult(json.data)
      setStatus('done')
    } catch (err: any) {
      setError(err.message || 'Gesprächsvorbereitung fehlgeschlagen')
      setStatus('error')
    }
  }, [kontaktId])

  useEffect(() => {
    generate()
  }, [generate])

  async function handleSaveAsNote() {
    if (!result) return
    setSaving(true)
    try {
      const content = [
        `Kurzprofil: ${result.summary}`,
        '',
        'Gesprächsvorschläge:',
        ...result.talking_points.map((p, i) => `${i + 1}. ${p}`),
        ...(result.flags.length ? ['', 'Zu beachten:', ...result.flags.map((f) => `- ${f}`)] : []),
      ].join('\n')

      const res = await fetch(`/api/kontakte/${kontaktId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          type: 'system',
          category: 'call',
          created_by: 'ai',
          metadata: { source: 'call_prep_agent' },
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Speichern fehlgeschlagen')
      setSaved(true)
    } catch (err: any) {
      setError(err.message || 'Speichern fehlgeschlagen')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-end mb-3">
        <HelpButton articleId="kontakt-detail.call-prep" />
      </div>

      {status === 'loading' && (
        <div className="flex items-center gap-3 text-sm text-gray-500 py-8 justify-center">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-yellow-500 rounded-full animate-spin" />
          Zusammenfassung wird generiert…
        </div>
      )}

      {status === 'error' && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-semibold mb-1">Fehler</p>
          <p className="mb-3">{error}</p>
          <button
            onClick={generate}
            className="px-3 py-1.5 text-xs font-semibold bg-red-100 hover:bg-red-200 text-red-800 rounded-lg transition-colors"
          >
            🔄 Erneut versuchen
          </button>
        </div>
      )}

      {status === 'done' && result && (
        <div className="space-y-5">
          <p className="text-xs text-gray-400">
            Stand: {new Date(result.generated_at).toLocaleString('de-DE')}
          </p>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5">Kurzprofil</h4>
            <p className="text-sm text-gray-800 leading-relaxed">{result.summary}</p>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5">Gesprächsvorschläge</h4>
            <ol className="space-y-1.5">
              {result.talking_points.map((point, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-800">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-yellow-100 text-yellow-800 text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{point}</span>
                </li>
              ))}
            </ol>
          </div>

          {result.flags.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <h4 className="text-xs font-bold uppercase tracking-wide text-amber-800 mb-1.5">⚠️ Zu beachten</h4>
              <ul className="space-y-1">
                {result.flags.map((flag, i) => (
                  <li key={i} className="text-sm text-amber-900">
                    • {flag}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
            <button
              onClick={generate}
              className="px-3 py-2 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            >
              🔄 Neu generieren
            </button>
            <button
              onClick={handleSaveAsNote}
              disabled={saving}
              className="px-3 py-2 text-xs font-semibold bg-yellow-400 hover:bg-yellow-500 disabled:opacity-50 text-gray-900 rounded-lg transition-colors"
            >
              {saving ? '…' : saved ? '✓ Gespeichert' : '💾 Als Notiz speichern'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
