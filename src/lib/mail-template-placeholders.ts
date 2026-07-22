// Platzhalter-Ersetzung für E-Mail-Vorlagen im Kontakt-Compose-Flow.
// Syntax: {{platzhalter}} — unbekannte oder leere Platzhalter werden zu "".
export interface PlaceholderContact {
  first_name?: string | null
  last_name?: string | null
  company_name?: string | null
  email?: string | null
  phone_mobile?: string | null
  phone_office?: string | null
  versicherungsgesellschaft?: string | null
  sparte?: string | null
}

export function fillTemplatePlaceholders(text: string, kontakt: PlaceholderContact): string {
  const values: Record<string, string> = {
    vorname: kontakt.first_name || '',
    nachname: kontakt.last_name || '',
    name: [kontakt.first_name, kontakt.last_name].filter(Boolean).join(' '),
    firma: kontakt.company_name || '',
    email: kontakt.email || '',
    telefon: kontakt.phone_mobile || kontakt.phone_office || '',
    versicherungsgesellschaft: kontakt.versicherungsgesellschaft || '',
    sparte: kontakt.sparte || '',
  }

  return text.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => values[key] ?? '')
}
