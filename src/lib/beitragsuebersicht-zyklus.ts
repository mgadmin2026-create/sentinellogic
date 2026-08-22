// Zyklus (Zahlweise) der Beitragsübersicht — eine Einstellung für die ganze
// Übersicht. Fehlt das Feld auf einem Kontakt (Altdaten vor Einführung dieses
// Features), wird überall 'jaehrlich' angenommen (Rückwärtskompatibilität).
export type Zyklus = 'monatlich' | 'vierteljaehrlich' | 'halbjaehrlich' | 'jaehrlich'

export const ZAHLUNGEN_PRO_JAHR: Record<Zyklus, number> = {
  monatlich: 12,
  vierteljaehrlich: 4,
  halbjaehrlich: 2,
  jaehrlich: 1,
}

export const ZYKLUS_LABEL: Record<Zyklus, string> = {
  monatlich: 'Monat',
  vierteljaehrlich: 'Quartal',
  halbjaehrlich: 'Halbjahr',
  jaehrlich: 'Jahr',
}

export const ZYKLUS_OPTIONEN: { value: Zyklus; label: string }[] = [
  { value: 'monatlich', label: 'Monatlich' },
  { value: 'vierteljaehrlich', label: 'Vierteljährlich' },
  { value: 'halbjaehrlich', label: 'Halbjährlich' },
  { value: 'jaehrlich', label: 'Jährlich' },
]

/**
 * Erkennt den Zyklus aus Freitext (z.B. "zahlweise" oder "beitrag" aus der
 * KI-Dokumentenanalyse). Liefert null bei Uneindeutigkeit — der Aufrufer muss
 * dann explizit nachfragen statt zu raten.
 */
export function erkenneZyklus(freitext: string | null | undefined): Zyklus | null {
  if (!freitext) return null
  const t = freitext.toLowerCase()
  if (/monatlich|monatsweise|pro monat|€\s*\/\s*monat/.test(t)) return 'monatlich'
  if (/vierteljährlich|vierteljaehrlich|quartalsweise|pro quartal|je quartal/.test(t)) return 'vierteljaehrlich'
  if (/halbjährlich|halbjaehrlich|halbjahresweise|pro halbjahr/.test(t)) return 'halbjaehrlich'
  if (/jährlich|jaehrlich|jahresbeitrag|pro jahr|jahresweise/.test(t)) return 'jaehrlich'
  return null
}

/** Rechnet einen Betrag von einem Zyklus in einen anderen um, auf 2 Nachkommastellen gerundet. */
export function konvertiereBetrag(betrag: number, von: Zyklus, nach: Zyklus): number {
  if (von === nach) return betrag
  const faktor = ZAHLUNGEN_PRO_JAHR[von] / ZAHLUNGEN_PRO_JAHR[nach]
  return Math.round(betrag * faktor * 100) / 100
}

// KI liefert den Beitrag als freien Text ("521,60 EUR jährlich", "1.200 €
// p.a."), keine Zahl — hier auf einen Euro-Betrag reduziert. Punkte gelten
// als Tausendertrennzeichen (deutsches Format), Komma als Dezimaltrennzeichen.
// Bewusst client-sicher (kein Server-Import) — wird sowohl serverseitig
// (beitragsuebersicht-uebernahme.ts) als auch clientseitig (Beitragsübersicht-
// Panel-Upload) genutzt.
export function parseBeitrag(raw?: string | null): number | null {
  if (!raw) return null
  const bereinigt = raw.replace(/\./g, '')
  const match = bereinigt.match(/(\d+)(?:,(\d+))?/)
  if (!match) return null
  const value = Number(`${match[1]}.${match[2] || '0'}`)
  return Number.isFinite(value) && value > 0 ? value : null
}

/**
 * Default-Zielspalte aus contract_type: eigen (Allianz-Angebot Melih/Derya
 * Gün) → "neu", fremd/unknown → "alt" (sicherer Default, überschreibbar).
 */
export function defaultSpalte(contractType: 'eigen' | 'fremd' | 'unknown' | null | undefined): 'alt' | 'neu' {
  return contractType === 'eigen' ? 'neu' : 'alt'
}
