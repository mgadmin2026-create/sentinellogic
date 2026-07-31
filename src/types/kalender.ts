// Vereinheitlichter Kalender-Eintrag — fasst Termine, Aufgaben-Fälligkeiten
// und Geburtstage (aus contacts.geburtstag) zu einer gemeinsamen Darstellung
// zusammen, damit alle drei "Kalender" im selben Raster nebeneinander
// erscheinen können (togglebar in der Sidebar, wie bei STRATO).
export type KalenderQuelle = 'termine' | 'aufgaben' | 'geburtstage'

export interface KalenderEintrag {
  id: string
  quelle: KalenderQuelle
  titel: string
  start: Date
  end: Date
  ganztaegig: boolean
  farbe: string
  ort?: string
  contactName?: string
  raw: any
}

export const QUELLEN_FARBEN: Record<KalenderQuelle, { bg: string; border: string; text: string; punkt: string }> = {
  termine: { bg: 'bg-blue-500', border: 'border-blue-600', text: 'text-white', punkt: 'bg-blue-500' },
  aufgaben: { bg: 'bg-amber-500', border: 'border-amber-600', text: 'text-white', punkt: 'bg-amber-500' },
  geburtstage: { bg: 'bg-pink-400', border: 'border-pink-500', text: 'text-white', punkt: 'bg-pink-400' },
}

export const QUELLEN_LABEL: Record<KalenderQuelle, string> = {
  termine: 'Termine',
  aufgaben: 'Aufgaben-Fälligkeiten',
  geburtstage: 'Geburtstage',
}
