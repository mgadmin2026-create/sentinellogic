'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PipelineStage } from '@/lib/pipeline'

export default function ProcessSettingsPage() {
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingLabel, setEditingLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadStages()
  }, [])

  async function loadStages() {
    try {
      setLoading(true)
      const res = await fetch('/api/pipeline-stages')
      const json = await res.json()
      if (json.success) {
        setStages(json.data)
      }
    } catch (err) {
      setError('Fehler beim Laden der Prozessschritte')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function updateStage(id: string, updates: Partial<PipelineStage>) {
    try {
      setSaving(true)
      const res = await fetch(`/api/pipeline-stages/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })
      const json = await res.json()
      if (json.success) {
        setStages(stages.map(s => s.id === id ? json.data : s))
        setEditingId(null)
        setSuccess('Änderung gespeichert')
        setTimeout(() => setSuccess(''), 2000)
      } else {
        setError(json.error || 'Fehler beim Speichern')
      }
    } catch (err) {
      setError('Fehler beim Speichern')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  async function swapPositions(id1: string, id2: string) {
    const stage1 = stages.find(s => s.id === id1)
    const stage2 = stages.find(s => s.id === id2)
    if (!stage1 || !stage2) return

    try {
      setSaving(true)
      await Promise.all([
        fetch(`/api/pipeline-stages/${id1}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ position: stage2.position })
        }),
        fetch(`/api/pipeline-stages/${id2}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ position: stage1.position })
        })
      ])
      await loadStages()
      setSuccess('Reihenfolge aktualisiert')
      setTimeout(() => setSuccess(''), 2000)
    } catch (err) {
      setError('Fehler beim Aktualisieren der Reihenfolge')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">⚙️</div>
          <p className="text-gray-600">Lade Prozessschritte...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl">
        {/* Header */}
        <Link href="/einstellungen" className="text-blue-600 hover:text-blue-700 font-medium mb-4 inline-block">
          ← Zurück zu Einstellungen
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Vertriebs-Prozess</h1>
        <p className="text-gray-600 mb-8">Passe die 12 Schritte deines Vertriebsprozesses an</p>

        {/* Messages */}
        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
            ✅ {success}
          </div>
        )}

        {/* Stages List */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {stages.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Keine Prozessschritte gefunden
            </div>
          ) : (
            <div className="divide-y">
              {stages.map((stage, idx) => (
                <div key={stage.id} className="p-6 hover:bg-blue-50 transition">
                  <div className="flex items-start gap-4">
                    {/* Position Badge */}
                    <div className="min-w-[60px] text-center">
                      <div className="text-2xl font-bold text-blue-600">{stage.position}</div>
                      <div className="text-xs text-gray-500">von {stages.length}</div>
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      {editingId === stage.id ? (
                        <input
                          type="text"
                          value={editingLabel}
                          onChange={(e) => setEditingLabel(e.target.value)}
                          className="w-full px-3 py-2 border border-blue-300 rounded bg-blue-50"
                          autoFocus
                        />
                      ) : (
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{stage.label}</h3>
                          <div className="text-sm text-gray-500 mt-1">
                            <span className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded mr-2">
                              key: {stage.key}
                            </span>
                            {stage.is_optional && (
                              <span className="inline-block bg-amber-100 text-amber-800 px-2 py-1 rounded">
                                Optional
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600 mt-2">
                            Status-Mapping: <strong>{stage.maps_to_status}</strong>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      {/* Edit Button */}
                      {editingId === stage.id ? (
                        <button
                          onClick={() => {
                            updateStage(stage.id, { label: editingLabel })
                          }}
                          disabled={saving}
                          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                        >
                          {saving ? '...' : '✓ Speichern'}
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingId(stage.id)
                            setEditingLabel(stage.label)
                          }}
                          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                          ✏️ Umbenennen
                        </button>
                      )}

                      {/* Reorder Buttons */}
                      {idx > 0 && (
                        <button
                          onClick={() => swapPositions(stage.id, stages[idx - 1].id)}
                          disabled={saving || editingId !== null}
                          className="px-3 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                          title="Verschiebe diesen Schritt nach oben"
                        >
                          ▲
                        </button>
                      )}
                      {idx < stages.length - 1 && (
                        <button
                          onClick={() => swapPositions(stage.id, stages[idx + 1].id)}
                          disabled={saving || editingId !== null}
                          className="px-3 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                          title="Verschiebe diesen Schritt nach unten"
                        >
                          ▼
                        </button>
                      )}

                      {/* Optional Toggle */}
                      <button
                        onClick={() => updateStage(stage.id, { is_optional: !stage.is_optional })}
                        disabled={saving || editingId !== null}
                        className={`px-4 py-2 rounded ${
                          stage.is_optional
                            ? 'bg-amber-500 text-white hover:bg-amber-600'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        } disabled:opacity-50`}
                        title={stage.is_optional ? 'Mache diesen Schritt erforderlich' : 'Mache diesen Schritt optional'}
                      >
                        {stage.is_optional ? '✓ Optional' : 'Optional'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-gray-700">
            <strong>Hinweis:</strong> Die Standard-12-Schritte sind bereits vorgesetzt. Du kannst Labels hier umbenennen
            und die Reihenfolge ändern. Optionale Schritte werden in der Pipeline gekennzeichnet, müssen aber nicht
            abgeschlossen werden.
          </p>
        </div>
      </div>
    </div>
  )
}
