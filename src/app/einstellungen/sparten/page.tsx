'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface LeitfadenFeld {
  feld: string
  label: string
  typ?: 'text' | 'date' | 'number' | 'checkbox'
  nurAnzeige?: boolean
}

interface LeitfadenFrage {
  id: string
  frage: string
  felder: LeitfadenFeld[]
  nurAnzeige?: boolean
}

interface Sparte {
  id: string
  name: string
  leitfaden_titel: string | null
  leitfaden_fragen: LeitfadenFrage[]
  leitfaden_abschluss: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

interface SparteForm {
  name: string
  leitfaden_titel: string
  leitfaden_fragen: LeitfadenFrage[]
  leitfaden_abschluss: string
}

const FELD_TYPEN: Array<{ value: NonNullable<LeitfadenFeld['typ']>; label: string }> = [
  { value: 'text', label: 'Text' },
  { value: 'date', label: 'Datum' },
  { value: 'number', label: 'Zahl' },
  { value: 'checkbox', label: 'Checkbox' },
]

function emptyForm(): SparteForm {
  return { name: '', leitfaden_titel: '', leitfaden_fragen: [], leitfaden_abschluss: '' }
}

function neueFrage(): LeitfadenFrage {
  return { id: crypto.randomUUID(), frage: '', felder: [], nurAnzeige: false }
}

function neuesFeld(): LeitfadenFeld {
  return { feld: '', label: '', typ: 'text' }
}

export default function SpartenPage() {
  const [sparten, setSparten] = useState<Sparte[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Sparte | null>(null)
  const [form, setForm] = useState<SparteForm>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    loadSparten()
  }, [])

  async function loadSparten() {
    try {
      setLoading(true)
      const res = await fetch('/api/sparten')
      const data = await res.json()
      if (data.success) setSparten(data.data)
    } catch (err) {
      setError('Sparten konnten nicht geladen werden')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setEditing(null)
    setForm(emptyForm())
    setModalOpen(true)
  }

  function openEdit(sparte: Sparte) {
    setEditing(sparte)
    setForm({
      name: sparte.name,
      leitfaden_titel: sparte.leitfaden_titel || '',
      leitfaden_fragen: sparte.leitfaden_fragen || [],
      leitfaden_abschluss: sparte.leitfaden_abschluss || '',
    })
    setModalOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const url = editing ? `/api/sparten/${editing.id}` : '/api/sparten'
      const method = editing ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Fehler beim Speichern')
      setModalOpen(false)
      await loadSparten()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(sparte: Sparte) {
    if (!confirm(`Sparte "${sparte.name}" wirklich löschen? Zuordnungen zu Kontakten gehen dabei verloren.`)) return
    setDeletingId(sparte.id)
    try {
      const res = await fetch(`/api/sparten/${sparte.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Fehler beim Löschen')
      await loadSparten()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Löschen')
    } finally {
      setDeletingId(null)
    }
  }

  function addFrage() {
    setForm({ ...form, leitfaden_fragen: [...form.leitfaden_fragen, neueFrage()] })
  }

  function removeFrage(index: number) {
    setForm({ ...form, leitfaden_fragen: form.leitfaden_fragen.filter((_, i) => i !== index) })
  }

  function updateFrage(index: number, updates: Partial<LeitfadenFrage>) {
    setForm({
      ...form,
      leitfaden_fragen: form.leitfaden_fragen.map((f, i) => (i === index ? { ...f, ...updates } : f)),
    })
  }

  function addFeld(fragenIndex: number) {
    updateFrage(fragenIndex, {
      felder: [...form.leitfaden_fragen[fragenIndex].felder, neuesFeld()],
    })
  }

  function removeFeld(fragenIndex: number, feldIndex: number) {
    updateFrage(fragenIndex, {
      felder: form.leitfaden_fragen[fragenIndex].felder.filter((_, i) => i !== feldIndex),
    })
  }

  function updateFeld(fragenIndex: number, feldIndex: number, updates: Partial<LeitfadenFeld>) {
    updateFrage(fragenIndex, {
      felder: form.leitfaden_fragen[fragenIndex].felder.map((f, i) => (i === feldIndex ? { ...f, ...updates } : f)),
    })
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl">
      <Link href="/einstellungen" className="text-sm text-gray-500 hover:text-gray-900">← Einstellungen</Link>
      <div className="flex items-center justify-between mt-2 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sparten & Erstgespräch-Leitfäden</h1>
          <p className="text-gray-600 text-sm mt-0.5">
            Sparten verwalten, denen Kontakte zugeordnet werden können — inkl. dem passenden
            Gesprächsleitfaden für die Erstgespräch-Kachel
          </p>
        </div>
        <button
          onClick={openCreate}
          className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors flex-shrink-0"
        >
          + Neue Sparte
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm py-8 text-center">Lädt…</p>
      ) : sparten.length === 0 ? (
        <p className="text-gray-500 text-sm py-8 text-center">Noch keine Sparten angelegt.</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {sparten.map((sparte) => (
            <div key={sparte.id} className="p-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium text-gray-900">{sparte.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {sparte.leitfaden_fragen?.length > 0
                    ? `${sparte.leitfaden_fragen.length} Frage${sparte.leitfaden_fragen.length === 1 ? '' : 'n'} im Leitfaden`
                    : 'Noch kein Leitfaden hinterlegt'}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => openEdit(sparte)}
                  title="Bearbeiten"
                  className="px-2 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  ✏️
                </button>
                <button
                  onClick={() => handleDelete(sparte)}
                  disabled={deletingId === sparte.id}
                  title="Löschen"
                  className="px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 rounded-lg transition-colors"
                >
                  {deletingId === sparte.id ? '⏳' : '🗑️'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <h3 className="text-lg font-bold text-gray-900">{editing ? 'Sparte bearbeiten' : 'Neue Sparte'}</h3>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Name</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="z.B. PKV"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Leitfaden-Titel</label>
                <input
                  type="text"
                  value={form.leitfaden_titel}
                  onChange={(e) => setForm({ ...form, leitfaden_titel: e.target.value })}
                  placeholder="z.B. Leitfaden PKV Erstgespräch"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 text-sm"
                />
              </div>

              <div className="border-t border-gray-100 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-gray-700">Fragen im Leitfaden</label>
                  <button
                    type="button"
                    onClick={addFrage}
                    className="text-xs font-semibold text-yellow-700 hover:text-yellow-800"
                  >
                    + Frage hinzufügen
                  </button>
                </div>

                {form.leitfaden_fragen.length === 0 ? (
                  <p className="text-xs text-gray-400 py-2">Noch keine Fragen — "+ Frage hinzufügen" klicken.</p>
                ) : (
                  <div className="space-y-3">
                    {form.leitfaden_fragen.map((frage, fi) => (
                      <div key={frage.id} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50/50">
                        <div className="flex items-start gap-2">
                          <input
                            type="text"
                            value={frage.frage}
                            onChange={(e) => updateFrage(fi, { frage: e.target.value })}
                            placeholder="Fragetext, z.B. Wie lautet Ihre vollständige Anschrift?"
                            className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400/40"
                          />
                          <button
                            type="button"
                            onClick={() => removeFrage(fi)}
                            title="Frage entfernen"
                            className="px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg flex-shrink-0"
                          >
                            🗑️
                          </button>
                        </div>

                        <label className="flex items-center gap-1.5 text-xs text-gray-600">
                          <input
                            type="checkbox"
                            checked={!!frage.nurAnzeige}
                            onChange={(e) => updateFrage(fi, { nurAnzeige: e.target.checked })}
                            className="rounded border-gray-300"
                          />
                          Nur Anzeige (Bestätigungs-Recap, keine erneute Eingabe)
                        </label>

                        <div className="pl-2 border-l-2 border-gray-200 space-y-1.5">
                          {frage.felder.map((feld, fli) => (
                            <div key={fli} className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={feld.feld}
                                onChange={(e) => updateFeld(fi, fli, { feld: e.target.value })}
                                placeholder="Feld (z.B. company_name)"
                                className="w-40 px-2 py-1 border border-gray-200 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-yellow-400/40"
                              />
                              <input
                                type="text"
                                value={feld.label}
                                onChange={(e) => updateFeld(fi, fli, { label: e.target.value })}
                                placeholder="Label (z.B. Firmenname)"
                                className="flex-1 px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400/40"
                              />
                              <select
                                value={feld.typ || 'text'}
                                onChange={(e) => updateFeld(fi, fli, { typ: e.target.value as LeitfadenFeld['typ'] })}
                                className="px-1.5 py-1 border border-gray-200 rounded text-xs focus:outline-none"
                              >
                                {FELD_TYPEN.map((t) => (
                                  <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => removeFeld(fi, fli)}
                                title="Feld entfernen"
                                className="px-1.5 py-1 text-xs text-red-500 hover:bg-red-50 rounded flex-shrink-0"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => addFeld(fi)}
                            className="text-xs text-yellow-700 hover:text-yellow-800 font-medium"
                          >
                            + Feld hinzufügen
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Abschluss-Text</label>
                <textarea
                  rows={2}
                  value={form.leitfaden_abschluss}
                  onChange={(e) => setForm({ ...form, leitfaden_abschluss: e.target.value })}
                  placeholder="z.B. Abschluss: Folgetermin vereinbaren, um ein Angebot zuzuschicken & zu besprechen."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 text-sm resize-y"
                />
              </div>

              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                  className="flex-1 border border-gray-200 text-gray-600 font-medium text-sm px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-yellow-400 hover:bg-yellow-500 disabled:opacity-50 text-gray-900 font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors"
                >
                  {saving ? 'Speichert…' : 'Speichern'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
