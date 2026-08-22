// Gemeinsame Berechnungslogik für die Beitragsübersicht — von der
// Bearbeiten-Ansicht UND der PDF-Generierung genutzt, damit beide garantiert
// dasselbe Ergebnis zeigen. Spiegelt exakt die Formeln aus der Excel-Vorlage.
import type { Beitragsuebersicht, BeitragsPosition, FlottenFahrzeug } from '@/types/beitragsuebersicht'
import { konvertiereBetrag, type Zyklus } from './beitragsuebersicht-zyklus'

export type Differenz = { kind: 'leer' } | { kind: 'neu' } | { kind: 'wert'; betrag: number }

/** =IF(OR($D="",$D=0),"",IF(OR($C="",$C=0),"NEU",$C-$D)) */
export function berechneDifferenz(beitragAlt: number | null, beitragNeu: number | null): Differenz {
  if (beitragNeu === null || beitragNeu === 0) return { kind: 'leer' }
  if (beitragAlt === null || beitragAlt === 0) return { kind: 'neu' }
  return { kind: 'wert', betrag: beitragAlt - beitragNeu }
}

export function summeFahrzeuge(fahrzeuge: FlottenFahrzeug[]): { alt: number; neu: number } {
  return fahrzeuge.reduce(
    (acc, f) => ({ alt: acc.alt + (f.beitrag_alt || 0), neu: acc.neu + (f.beitrag_neu || 0) }),
    { alt: 0, neu: 0 }
  )
}

/** Effektive Werte einer Position — bei der Kfz-Flotte-Zeile ggf. durch die Flottensumme ersetzt. */
export function effektiveWerte(
  position: BeitragsPosition,
  fahrzeuge: FlottenFahrzeug[],
  flotteAktiv: boolean
): { alt: number | null; neu: number | null } {
  if (position.ist_flotte_zeile && flotteAktiv) {
    const sum = summeFahrzeuge(fahrzeuge)
    return { alt: sum.alt || null, neu: sum.neu || null }
  }
  return { alt: position.beitrag_alt, neu: position.beitrag_neu }
}

export interface Summenergebnis {
  sumAlt: number
  sumNeu: number
  /** Ersparnis, im selben Zyklus wie sumAlt/sumNeu (z.B. €/Quartal) — nicht auf Jahr umgerechnet. */
  ersparnis: number
  /** Mehrbeitrag, im selben Zyklus wie sumAlt/sumNeu — nicht auf Monat umgerechnet. */
  mehrbeitrag: number
}

/**
 * =SUM(...) je Spalte, dann =MAX(0,alt-neu) bzw. =MAX(0,neu-alt) — beide Werte
 * bleiben bewusst im Zyklus der Übersicht (z.B. €/Quartal bei zyklus=
 * vierteljaehrlich), statt sie fix auf Jahr/Monat umzurechnen. So zeigt die UI
 * für jeden Zyklus eine in sich stimmige Einheit statt einer versteckten
 * Umrechnung neben einer Tabelle in einer anderen Einheit.
 */
export function berechneSummen(uebersicht: Beitragsuebersicht): Summenergebnis {
  let sumAlt = 0
  let sumNeu = 0
  for (const position of uebersicht.positionen) {
    const { alt, neu } = effektiveWerte(position, uebersicht.fahrzeuge, uebersicht.flotte_aktiv)
    sumAlt += alt || 0
    sumNeu += neu || 0
  }
  return {
    sumAlt,
    sumNeu,
    ersparnis: Math.max(0, sumAlt - sumNeu),
    mehrbeitrag: Math.max(0, sumNeu - sumAlt),
  }
}

export interface VertragZuBeitragspositionInput {
  sparte: string
  /** Bereits als Zahl geparster Beitrag (siehe parseBeitrag in beitragsuebersicht-zyklus.ts). */
  betragRoh: number
  /** Vom Nutzer bestätigter Zyklus des gelesenen Betrags. */
  betragZyklus: Zyklus
  /** Zyklus der Ziel-Übersicht — Betrag wird bei Abweichung umgerechnet. */
  zielZyklus: Zyklus
  spalte: 'alt' | 'neu'
  versicherungsgesellschaft?: string | null
  beginn?: string | null
  ende?: string | null
  /** Original-Freitext der KI ("521,60 EUR jährlich") — nur für die Bemerkung. */
  beitragOriginalText?: string | null
}

/**
 * Baut eine BeitragsPosition aus einem per KI erkannten Vertrag/Angebot —
 * gemeinsam genutzt vom serverseitigen Übernahme-Endpunkt (Kontakt-Dokumente-
 * Tab, KI-Upload-Seite) UND vom Direkt-Upload innerhalb der Beitragsübersicht
 * selbst (dort ohne Server-Roundtrip, da der Nutzer den Entwurf noch nicht
 * gespeichert haben muss).
 */
export function baueBeitragspositionAusVertrag(input: VertragZuBeitragspositionInput): BeitragsPosition {
  const istEigenvertrag = input.spalte === 'neu'
  const wurdeUmgerechnet = input.betragZyklus !== input.zielZyklus
  const betrag = wurdeUmgerechnet
    ? konvertiereBetrag(input.betragRoh, input.betragZyklus, input.zielZyklus)
    : input.betragRoh
  const originalText = input.beitragOriginalText ?? String(input.betragRoh)

  return {
    sparte: input.sparte,
    versicherer_alt: istEigenvertrag ? '' : input.versicherungsgesellschaft?.trim() || '',
    beitrag_alt: istEigenvertrag ? null : betrag,
    beitrag_neu: istEigenvertrag ? betrag : null,
    beginn: input.beginn || null,
    ablauf: input.ende || null,
    bemerkung: wurdeUmgerechnet
      ? `Automatisch aus Vertragsupload übernommen: „${originalText}" (umgerechnet)`
      : `Automatisch aus Vertragsupload übernommen: „${originalText}"`,
    automatisch_uebernommen: true,
  }
}
