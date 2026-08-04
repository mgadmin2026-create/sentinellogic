'use client'
// Mehrfachauswahl der Sparten eines Kontakts (n:m), gegen die feste, in
// /einstellungen/sparten von Melih gepflegte Liste -- ersetzt das frühere
// freie Textfeld "Sparte". Speichert sofort bei Änderung (nicht Teil des
// gemeinsamen ContactOverview-edits-Buckets, da eigene Zuordnungstabelle),
// analog zu anderen selbstständig speichernden Widgets in dieser App
// (Tags, Notizen).
import { useEffect, useState } from 'react'

interface Sparte {
  id: string
  name: string
}

interface ZugeordneteSparte {
  is_primary: boolean
  sparte: Sparte
}

interface Props {
  contactId: string
  isEditing: boolean
}

export function SparteMultiSelect({ contactId, isEditing }: Props) {
  const [alleSparten, setAlleSparten] = useState<Sparte[]>([])
  const [zugeordnet, setZugeordnet] = useState<ZugeordneteSparte[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const [alleRes, zugeordnetRes] = await Promise.all([
          fetch('/api/sparten').then((r) => r.json()),
          fetch(`/api/kontakte/${contactId}/sparten`).then((r) => r.json()),
        ])
        if (cancelled) return
        if (alleRes.success) setAlleSparten(alleRes.data)
        if (zugeordnetRes.success) setZugeordnet(zugeordnetRes.data)
      } catch (err) {
        console.error('[SparteMultiSelect] Fehler beim Laden:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [contactId])

  async function persist(sparteIds: string[], primarySparteId?: string) {
    setSaving(true)
    try {
      const res = await fetch(`/api/kontakte/${contactId}/sparten`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sparteIds, primarySparteId }),
      })
      const data = await res.json()
      if (data.success) setZugeordnet(data.data)
    } catch (err) {
      console.error('[SparteMultiSelect] Fehler beim Speichern:', err)
    } finally {
      setSaving(false)
    }
  }

  function toggleSparte(sparteId: string) {
    const aktuelleIds = zugeordnet.map((z) => z.sparte.id)
    const istZugeordnet = aktuelleIds.includes(sparteId)
    const neueIds = istZugeordnet ? aktuelleIds.filter((id) => id !== sparteId) : [...aktuelleIds, sparteId]
    const aktuellePrimary = zugeordnet.find((z) => z.is_primary)?.sparte.id
    const neuePrimary = aktuellePrimary && neueIds.includes(aktuellePrimary) ? aktuellePrimary : neueIds[0]
    persist(neueIds, neuePrimary)
  }

  function setPrimary(sparteId: string) {
    const aktuelleIds = zugeordnet.map((z) => z.sparte.id)
    persist(aktuelleIds, sparteId)
  }

  if (loading) {
    return (
      <div>
        <p className="text-xs text-gray-500 font-medium">Sparten</p>
        <p className="text-sm text-gray-400 mt-1">Lädt…</p>
      </div>
    )
  }

  if (!isEditing) {
    return (
      <div>
        <p className="text-xs text-gray-500 font-medium">Sparten</p>
        <p className="text-sm text-gray-900 mt-1">
          {zugeordnet.length === 0
            ? '—'
            : zugeordnet
                .map((z) => (z.is_primary && zugeordnet.length > 1 ? `${z.sparte.name} (primär)` : z.sparte.name))
                .join(', ')}
        </p>
      </div>
    )
  }

  return (
    <div>
      <p className="text-xs text-gray-500 font-medium mb-1.5">
        Sparten {saving && <span className="text-yellow-600">(speichert…)</span>}
      </p>
      <div className="space-y-1.5 border-2 border-yellow-300 rounded bg-yellow-50 p-2">
        {alleSparten.length === 0 ? (
          <p className="text-xs text-gray-500">Noch keine Sparten in den Einstellungen angelegt.</p>
        ) : (
          alleSparten.map((sparte) => {
            const zuordnung = zugeordnet.find((z) => z.sparte.id === sparte.id)
            const ausgewaehlt = !!zuordnung
            return (
              <div key={sparte.id} className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-sm text-gray-900">
                  <input
                    type="checkbox"
                    checked={ausgewaehlt}
                    onChange={() => toggleSparte(sparte.id)}
                    disabled={saving}
                    className="rounded border-gray-300"
                  />
                  {sparte.name}
                </label>
                {ausgewaehlt && zugeordnet.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setPrimary(sparte.id)}
                    disabled={saving || zuordnung?.is_primary}
                    className={`text-xs px-1.5 py-0.5 rounded ${
                      zuordnung?.is_primary
                        ? 'bg-yellow-400 text-gray-900 font-semibold'
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    {zuordnung?.is_primary ? '★ primär' : '☆ als primär'}
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
