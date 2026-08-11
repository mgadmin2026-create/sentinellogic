'use client'
// Geteilte Rückfrage-Form für die Übernahme eines per KI-Upload gelesenen
// Beitrags in die Beitragsübersicht — von beiden Upload-Pfaden genutzt
// (/ki-upload Prüfmaske UND Bestätigungs-Modal beim Direkt-Upload am Kontakt).
// Schreibt nie automatisch — der Nutzer muss Übernahme, Spalte und (falls
// nicht eindeutig erkennbar) den Zyklus des Betrags explizit bestätigen.
import { ZYKLUS_OPTIONEN, type Zyklus } from '@/lib/beitragsuebersicht-zyklus'

export interface BeitragsuebersichtUebernahmeWerte {
  uebernehmen: boolean
  spalte: 'alt' | 'neu'
  /** '' = noch nicht ausgewählt — Pflichtfeld, wenn der Zyklus nicht eindeutig erkannt wurde. */
  zyklus: Zyklus | ''
}

interface BeitragsuebersichtUebernahmeFormProps {
  werte: BeitragsuebersichtUebernahmeWerte
  onChange: (werte: BeitragsuebersichtUebernahmeWerte) => void
  sparte?: string | null
  beitragText?: string | null
}

export function BeitragsuebersichtUebernahmeForm({ werte, onChange, sparte, beitragText }: BeitragsuebersichtUebernahmeFormProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2.5">
      <label className="flex items-start gap-2.5 text-xs text-gray-700">
        <input
          type="checkbox"
          checked={werte.uebernehmen}
          onChange={(e) => onChange({ ...werte, uebernehmen: e.target.checked })}
          className="mt-0.5 rounded border-gray-300 text-yellow-500 focus:ring-yellow-400"
        />
        <span>
          <span className="font-semibold">In Beitragsübersicht übernehmen</span>
          {sparte && beitragText && (
            <span className="text-gray-500">
              {' '}
              — {sparte}: {beitragText}
            </span>
          )}
        </span>
      </label>

      {werte.uebernehmen && (
        <div className="flex flex-wrap items-center gap-3 pl-6">
          <div className="flex items-center gap-1.5">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Spalte</label>
            <select
              value={werte.spalte}
              onChange={(e) => onChange({ ...werte, spalte: e.target.value as 'alt' | 'neu' })}
              className="px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400"
            >
              <option value="alt">Beitrag alt</option>
              <option value="neu">Beitrag neu</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Zyklus des Betrags</label>
            <select
              value={werte.zyklus}
              onChange={(e) => onChange({ ...werte, zyklus: e.target.value as Zyklus })}
              className={`px-2 py-1 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400 ${
                werte.zyklus === '' ? 'border-amber-400 bg-amber-50' : 'border-gray-200'
              }`}
            >
              <option value="">– bitte wählen –</option>
              {ZYKLUS_OPTIONEN.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {werte.zyklus === '' && (
            <span className="text-[11px] text-amber-600">Zyklus konnte nicht eindeutig erkannt werden — bitte auswählen.</span>
          )}
        </div>
      )}
    </div>
  )
}
