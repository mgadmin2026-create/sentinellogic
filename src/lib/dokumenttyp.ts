// Gemeinsame Dokumenttyp-Definitionen — von der KI-Analyse geliefert
// (src/lib/ki-upload.ts), an Dokumenten-Listen (Kontakt-Tab, globale Übersicht)
// und der KI-Upload-Prüfmaske genutzt.
export type Dokumenttyp = 'police' | 'angebot' | 'nachtrag' | 'rechnung' | 'sonstiges'

export const DOKUMENTTYP_OPTIONEN: { value: Dokumenttyp; label: string }[] = [
  { value: 'police', label: 'Vertrag / Police' },
  { value: 'angebot', label: 'Angebot' },
  { value: 'nachtrag', label: 'Nachtrag' },
  { value: 'rechnung', label: 'Rechnung' },
  { value: 'sonstiges', label: 'Sonstiges' },
]

export const DOKUMENTTYP_LABEL: Record<Dokumenttyp, string> = {
  police: 'Vertrag',
  angebot: 'Angebot',
  nachtrag: 'Nachtrag',
  rechnung: 'Rechnung',
  sonstiges: 'Sonstiges',
}

// Filter-Buckets für die Dokumentenlisten: "Nachtrag" zählt inhaltlich zum
// Vertrag und bekommt bewusst keinen eigenen Filter — der genaue Typ bleibt
// aber pro Dokument gespeichert. NULL (nicht klassifiziert) fällt unter
// "Sonstiges".
export type DokumenttypFilter = 'alle' | 'vertraege' | 'angebote' | 'rechnungen' | 'sonstiges'

export const DOKUMENTTYP_FILTER_OPTIONEN: { value: DokumenttypFilter; label: string }[] = [
  { value: 'alle', label: 'Alle' },
  { value: 'vertraege', label: 'Verträge' },
  { value: 'angebote', label: 'Angebote' },
  { value: 'rechnungen', label: 'Rechnungen' },
  { value: 'sonstiges', label: 'Sonstiges' },
]

export function dokumenttypZuFilter(typ: string | null | undefined): DokumenttypFilter {
  switch (typ) {
    case 'police':
    case 'nachtrag':
      return 'vertraege'
    case 'angebot':
      return 'angebote'
    case 'rechnung':
      return 'rechnungen'
    default:
      return 'sonstiges'
  }
}

export function dokumenttypBadgeLabel(typ: string | null | undefined): string {
  return typ && typ in DOKUMENTTYP_LABEL ? DOKUMENTTYP_LABEL[typ as Dokumenttyp] : 'Sonstiges'
}
