// Typen für die Beitragsübersicht (Sparten-Vergleich bisheriger vs. Allianz-
// Beitrag pro Kontakt) — siehe supabase/migrations/0051_beitragsuebersicht.sql
import type { Zyklus } from '@/lib/beitragsuebersicht-zyklus'

export interface BeitragsPosition {
  sparte: string
  versicherer_alt: string
  beitrag_alt: number | null
  beitrag_neu: number | null
  beginn: string | null
  ablauf: string | null
  bemerkung: string
  /** true nur für die Zeile "Kfz-Flotte / Firmenfahrzeuge" im Gewerbe-Set */
  ist_flotte_zeile?: boolean
  /** true, wenn diese Zeile automatisch aus einem per KI erkannten Vertrags-
   * Upload übernommen wurde (statt manuell im Panel eingetragen). */
  automatisch_uebernommen?: boolean
}

export interface FlottenFahrzeug {
  kennzeichen: string
  fahrzeug: string
  beitrag_alt: number | null
  beitrag_neu: number | null
  bemerkung: string
}

export interface Beitragsuebersicht {
  datum: string
  /** Kfz-Flotte-Unterbereich aktiv (ab 4 Fahrzeugen) — bei 1–3 Fahrzeugen wird
   * direkt in der Sparten-Zeile "Kfz-Flotte / Firmenfahrzeuge" eingetragen. */
  flotte_aktiv: boolean
  positionen: BeitragsPosition[]
  fahrzeuge: FlottenFahrzeug[]
  /** Zahlweise für die gesamte Übersicht. Fehlt bei Altdaten — dann gilt 'jaehrlich'. */
  zyklus?: Zyklus
}

export function emptyPosition(sparte: string, istFlotteZeile = false): BeitragsPosition {
  return {
    sparte,
    versicherer_alt: '',
    beitrag_alt: null,
    beitrag_neu: null,
    beginn: null,
    ablauf: null,
    bemerkung: '',
    ist_flotte_zeile: istFlotteZeile || undefined,
  }
}

export function emptyFahrzeug(): FlottenFahrzeug {
  return { kennzeichen: '', fahrzeug: '', beitrag_alt: null, beitrag_neu: null, bemerkung: '' }
}
