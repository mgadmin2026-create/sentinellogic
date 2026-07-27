'use client'

// Unbekannter Anrufer: Nummer bleibt sichtbar, das Anlegen eines Kontakts wird
// angeboten — aber nicht erzwungen. Bewusst nur Name + Rufnummer; alles Weitere
// lässt sich in Ruhe auf der Kontaktseite ergänzen.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export function EingehenderAnrufAktionen({ nummer }: { nummer: string }) {
  const router = useRouter()
  const [formOffen, setFormOffen] = useState(false)
  const [vorname, setVorname] = useState('')
  const [nachname, setNachname] = useState('')
  const [firma, setFirma] = useState('')
  const [speichert, setSpeichert] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)

  async function anlegen() {
    if (!nachname.trim()) {
      setFehler('Bitte mindestens einen Nachnamen angeben.')
      return
    }

    setSpeichert(true)
    setFehler(null)
    try {
      const res = await fetch('/api/kontakte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: vorname.trim() || '—',
          last_name: nachname.trim(),
          company_name: firma.trim() || null,
          phone_mobile: nummer,
          source: 'manuell',
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Kontakt konnte nicht angelegt werden')
      }
      router.push(`/kontakte/${data.data.id}?anruf=eingehend`)
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Kontakt konnte nicht angelegt werden')
      setSpeichert(false)
    }
  }

  if (!formOffen) {
    return (
      <div className="mt-6 flex flex-wrap gap-2">
        <button
          onClick={() => setFormOffen(true)}
          className="rounded-lg bg-yellow-400 px-4 py-2.5 text-sm font-semibold text-gray-900 transition-colors hover:bg-yellow-500"
        >
          Kontakt anlegen
        </button>
        <Link
          href={`/kontakte?suche=${encodeURIComponent(nummer)}`}
          className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
        >
          In Kontakten suchen
        </Link>
      </div>
    )
  }

  return (
    <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
      <p className="text-sm font-semibold text-gray-900">Neuer Kontakt</p>
      <p className="mt-0.5 text-xs text-gray-500">
        Die Rufnummer <span className="font-mono">{nummer}</span> wird als Mobilnummer übernommen.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <input
          value={vorname}
          onChange={(e) => setVorname(e.target.value)}
          placeholder="Vorname"
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400/40"
        />
        <input
          value={nachname}
          onChange={(e) => setNachname(e.target.value)}
          placeholder="Nachname *"
          autoFocus
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400/40"
        />
        <input
          value={firma}
          onChange={(e) => setFirma(e.target.value)}
          placeholder="Firma (optional)"
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400/40 sm:col-span-2"
        />
      </div>

      {fehler && <p className="mt-2 text-xs text-red-600">{fehler}</p>}

      <div className="mt-3 flex gap-2">
        <button
          onClick={anlegen}
          disabled={speichert}
          className="rounded-lg bg-yellow-400 px-4 py-2 text-sm font-semibold text-gray-900 transition-colors hover:bg-yellow-500 disabled:opacity-50"
        >
          {speichert ? 'Legt an…' : 'Anlegen und öffnen'}
        </button>
        <button
          onClick={() => setFormOffen(false)}
          disabled={speichert}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-white disabled:opacity-50"
        >
          Abbrechen
        </button>
      </div>
    </div>
  )
}
