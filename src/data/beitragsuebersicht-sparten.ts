// Feste Sparten-Vorbelegung pro Kontakttyp, aus der Excel-Vorlage
// "Beitragsuebersicht_Vorlage_Allianz_Guen" übernommen. Wird nur beim
// erstmaligen Anlegen einer Beitragsübersicht verwendet, um leere Zeilen
// vorzubelegen — danach ist die Liste frei erweiterbar/löschbar.
export const SPARTEN_PRIVAT: string[] = [
  'Privathaftpflicht',
  'Hausratversicherung',
  'Wohngebäudeversicherung',
  'Kfz-Versicherung',
  'Rechtsschutzversicherung',
  'Unfallversicherung',
  'Berufsunfähigkeitsversicherung',
  'Risikolebensversicherung',
  'Krankenvollversicherung',
  'Krankenzusatzversicherung',
  'Pflegevorsorge',
  'Private Altersvorsorge (Rente)',
  'Riester- / Förderrente',
  'Betriebliche Altersvorsorge (bAV)',
]

export const SPARTEN_GEWERBE: string[] = [
  'Betriebs- / Firmenhaftpflicht',
  'Inhaltsversicherung',
  'Ertragsausfall / Betriebsunterbrechung',
  'Firmengebäudeversicherung',
  'Maschinenversicherung',
  'Elektronikversicherung',
  'Firmen-Rechtsschutz',
  'Strafrechtsschutz',
  'D&O-Versicherung',
  'Cyber-Versicherung',
  'Gruppenunfallversicherung',
  'Kfz-Flotte / Firmenfahrzeuge',
  'Betriebliche Altersvorsorge (bAV)',
  'Betriebliche Krankenversicherung (bKV)',
]

export const KFZ_FLOTTE_SPARTE = 'Kfz-Flotte / Firmenfahrzeuge'
