// Gemeinsame Angebot-Status-Definitionen — von der Angebote-Pipeline-Seite,
// der Kontakt-Kachel und den KI-Upload-/Dokumente-Übernahme-Formularen genutzt.
export type AngebotStatus = 'in_erstellung' | 'versendet' | 'in_verhandlung' | 'gewonnen' | 'verloren'

export const ANGEBOT_STATUS_OPTIONEN: { value: AngebotStatus; label: string }[] = [
  { value: 'in_erstellung', label: 'In Erstellung' },
  { value: 'versendet', label: 'Versendet' },
  { value: 'in_verhandlung', label: 'In Verhandlung' },
  { value: 'gewonnen', label: 'Gewonnen' },
  { value: 'verloren', label: 'Verloren' },
]

export const ANGEBOT_STATUS_LABEL: Record<AngebotStatus, string> = {
  in_erstellung: 'In Erstellung',
  versendet: 'Versendet',
  in_verhandlung: 'In Verhandlung',
  gewonnen: 'Gewonnen',
  verloren: 'Verloren',
}

// Gleiche Farblogik wie STATUS_COLORS für Kontakte (src/app/kontakte/page.tsx):
// neutral -> blau -> gelb -> grün/rot am Ende des Lebenszyklus.
export const ANGEBOT_STATUS_FARBE: Record<AngebotStatus, string> = {
  in_erstellung: 'bg-gray-100 text-gray-800',
  versendet: 'bg-blue-100 text-blue-800',
  in_verhandlung: 'bg-yellow-100 text-yellow-800',
  gewonnen: 'bg-emerald-100 text-emerald-800',
  verloren: 'bg-red-100 text-red-800',
}

export function angebotStatusLabel(status: string | null | undefined): string {
  return status && status in ANGEBOT_STATUS_LABEL ? ANGEBOT_STATUS_LABEL[status as AngebotStatus] : status || '—'
}

export function angebotStatusFarbe(status: string | null | undefined): string {
  return status && status in ANGEBOT_STATUS_FARBE ? ANGEBOT_STATUS_FARBE[status as AngebotStatus] : 'bg-gray-100 text-gray-800'
}
