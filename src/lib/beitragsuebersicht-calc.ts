// Gemeinsame Berechnungslogik für die Beitragsübersicht — von der
// Bearbeiten-Ansicht UND der PDF-Generierung genutzt, damit beide garantiert
// dasselbe Ergebnis zeigen. Spiegelt exakt die Formeln aus der Excel-Vorlage.
import type { Beitragsuebersicht, BeitragsPosition, FlottenFahrzeug } from '@/types/beitragsuebersicht'
import { ZAHLUNGEN_PRO_JAHR } from './beitragsuebersicht-zyklus'

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
  ersparnisProJahr: number
  mehrbeitragProMonat: number
}

/**
 * =SUM(...) je Spalte, dann =MAX(0,alt-neu) bzw. =MAX(0,(neu-alt)/12) — beide
 * Werte werden zyklus-normalisiert (sumAlt/sumNeu selbst bleiben im Zyklus der
 * Übersicht, unkonvertiert). Kollabiert bei zyklus='jaehrlich' (Faktor 1)
 * exakt auf die ursprüngliche, jahresbasierte Formel.
 */
export function berechneSummen(uebersicht: Beitragsuebersicht): Summenergebnis {
  let sumAlt = 0
  let sumNeu = 0
  for (const position of uebersicht.positionen) {
    const { alt, neu } = effektiveWerte(position, uebersicht.fahrzeuge, uebersicht.flotte_aktiv)
    sumAlt += alt || 0
    sumNeu += neu || 0
  }
  const faktor = ZAHLUNGEN_PRO_JAHR[uebersicht.zyklus ?? 'jaehrlich']
  const sumAltJahr = sumAlt * faktor
  const sumNeuJahr = sumNeu * faktor
  return {
    sumAlt,
    sumNeu,
    ersparnisProJahr: Math.max(0, sumAltJahr - sumNeuJahr),
    mehrbeitragProMonat: Math.max(0, (sumNeuJahr - sumAltJahr) / 12),
  }
}
