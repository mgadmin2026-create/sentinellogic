// Leitfaden fürs Erstgespräch — pro Sparte eine geordnete Liste von Fragen,
// die der Mitarbeiter beim ersten Anruf durchgeht. Jede Frage ist auf
// bestehende contacts-Spalten gemappt; es werden keine neuen Felder
// angelegt, nur eine geführte Reihenfolge + Gesprächsleitfaden-Text darüber.
//
// Neue Sparte hinzufügen: einfach einen weiteren Eintrag in diesem Record
// ergänzen. Fehlt eine Sparte hier, zeigt die Kachel einen Platzhalter statt
// eines Fehlers.
export interface LeitfadenFeld {
  feld: string
  label: string
  typ?: 'text' | 'date' | 'number' | 'checkbox'
}

export interface LeitfadenFrage {
  id: string
  frage: string
  felder: LeitfadenFeld[]
  // true = reine Anzeige (Bestätigungs-Recap), keine erneute Eingabe
  nurAnzeige?: boolean
}

export interface SpartenLeitfaden {
  titel: string
  fragen: LeitfadenFrage[]
  abschluss: string
}

export const ERSTGESPRAECH_LEITFAEDEN: Record<string, SpartenLeitfaden> = {
  Unternehmerschutz: {
    titel: 'Leitfaden Unternehmerschutz Paket für Lead',
    fragen: [
      {
        id: 'firma',
        frage: 'Wie lautet Ihre vollständige Anschrift?',
        felder: [
          { feld: 'company_name', label: 'Firmenname' },
          { feld: 'rechtsform', label: 'Rechtsform' },
          { feld: 'street', label: 'Straße' },
          { feld: 'hausnummer', label: 'Hausnummer' },
          { feld: 'postal_code', label: 'PLZ' },
          { feld: 'city', label: 'Ort' },
        ],
      },
      {
        id: 'gewerbe_seit',
        frage: 'Seit wann besteht Ihr Gewerbe?',
        felder: [{ feld: 'seit_wann_gewerbe', label: 'Gewerbe seit', typ: 'date' }],
      },
      {
        id: 'gf_geburtsdatum',
        frage: 'Könnten Sie mir Ihr Geburtsdatum nennen?',
        felder: [{ feld: 'geburtstag_gf_inhaber', label: 'Geburtsdatum GF/Inhaber', typ: 'date' }],
      },
      {
        id: 'taetigkeit',
        frage: 'Können Sie mir kurz Ihre Tätigkeit beschreiben?',
        felder: [{ feld: 'industry', label: 'Branche / Tätigkeit' }],
      },
      {
        id: 'mitarbeiter',
        frage: 'Wie viele Mitarbeiter haben Sie?',
        felder: [{ feld: 'mitarbeitanzahl', label: 'Mitarbeiteranzahl', typ: 'number' }],
      },
      {
        id: 'umsatz',
        frage: 'Wie hoch ist Ihr Jahresumsatz?',
        felder: [{ feld: 'jahresumsatz', label: 'Jahresumsatz' }],
      },
      {
        id: 'inhaltssumme',
        frage: 'Was ist der Wert Ihrer Waren oder Inhalte?',
        felder: [{ feld: 'inhaltssumme', label: 'Inhaltssumme' }],
      },
      {
        id: 'interesse',
        frage: 'Sie haben sich als Firmenprofis eingetragen. Welche Art von Versicherung interessiert Sie besonders?',
        felder: [{ feld: 'versicherungstyp', label: 'Interesse an Versicherung' }],
      },
      {
        id: 'vorversicherung',
        frage: 'Haben Sie bereits eine Vorversicherung?',
        felder: [
          { feld: 'bestandskunde', label: 'Bestandskunde', typ: 'checkbox' },
          { feld: 'versicherungsgesellschaft', label: 'Versicherungsgesellschaft' },
        ],
      },
      {
        id: 'bestaetigung',
        frage: 'Könnten Sie bitte Ihren Firmennamen sowie Ihre Telefonnummer und E-Mail-Adresse bestätigen?',
        felder: [
          { feld: 'company_name', label: 'Firmenname' },
          { feld: 'phone_mobile', label: 'Telefon' },
          { feld: 'email', label: 'E-Mail' },
        ],
        nurAnzeige: true,
      },
    ],
    abschluss: 'Abschluss: Folgetermin vereinbaren, um ein Angebot zuzuschicken & zu besprechen.',
  },
}
