// Typen für das eingebaute Hilfe-System (Kundendokumentation + kontextsensitive Hilfe).
// Inhalte werden im Code gepflegt (siehe src/data/help/), nicht über die DB —
// analog zum bestehenden RELEASE_NOTES-Muster in src/data/release-notes.ts.
export type HelpArea =
  | 'dashboard'
  | 'kontakte-liste'
  | 'kontakt-detail'
  | 'aufgaben'
  | 'kalender'
  | 'dokumente'
  | 'ki-upload'
  | 'sync'
  | 'regeln'
  | 'reporting'
  | 'erwaehnungen'
  | 'einstellungen'

export const HELP_AREA_LABELS: Record<HelpArea, string> = {
  dashboard: 'Dashboard',
  'kontakte-liste': 'Kontakte',
  'kontakt-detail': 'Kontaktdetail',
  aufgaben: 'Aufgaben',
  kalender: 'Kalender',
  dokumente: 'Dokumente',
  'ki-upload': 'KI Upload',
  sync: 'Synchronisation',
  regeln: 'Automatisierungen',
  reporting: 'Reporting',
  erwaehnungen: 'Erwähnungen',
  einstellungen: 'Einstellungen',
}

// Reihenfolge, in der Bereiche auf /hilfe angezeigt werden — folgt der Sidebar-Navigation.
export const HELP_AREA_ORDER: HelpArea[] = [
  'dashboard',
  'kontakte-liste',
  'kontakt-detail',
  'aufgaben',
  'kalender',
  'dokumente',
  'ki-upload',
  'sync',
  'regeln',
  'reporting',
  'erwaehnungen',
  'einstellungen',
]

export interface HelpArticle {
  /** Stabil, kebab-case, Konvention "<bereich>.<abschnitt>", z.B. "kontakt-detail.dokumente" */
  id: string
  area: HelpArea
  title: string
  /** Reiner Text: Absätze durch "\n\n" getrennt, Aufzählungspunkte als Zeilen mit "- " Präfix */
  body: string
  /** Zusätzliche Suchbegriffe/Synonyme, die nicht zwingend in title/body vorkommen */
  keywords?: string[]
  /** true = wird als Seiten-Standardhilfe verwendet (Taste "?"), wenn keine Kachel-Hilfe passt */
  isPageDefault?: boolean
  /** Nur bei isPageDefault gesetzt: exakter Pfad bzw. Präfix (siehe matchMode) */
  route?: string
  /**
   * "exact" (Standard): route muss dem Pfad exakt entsprechen — für alle statischen Seiten.
   * "prefix": route + "/…" — nur für echte dynamische Routen nötig (aktuell nur /kontakte/[id]),
   * damit z.B. die Kontaktdetail-Standardhilfe nicht mit der Kontakte-Listen-Standardhilfe kollidiert.
   */
  matchMode?: 'exact' | 'prefix'
}
