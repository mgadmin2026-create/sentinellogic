import type { HelpArticle } from '@/types/help'

export const kiUploadArticles: HelpArticle[] = [
  {
    id: 'ki-upload.overview',
    area: 'ki-upload',
    title: 'KI Upload — Überblick',
    isPageDefault: true,
    route: '/ki-upload',
    matchMode: 'exact',
    keywords: ['dokument analyse', 'police', 'automatisch anlegen'],
    body:
      'Versicherungsdokument hochladen (Police, Angebot oder Nachtrag, als PDF oder Foto — auch gescannt) — die KI erkennt automatisch die Kundendaten, schlägt einen Kontakt vor und legt das Dokument in der passenden Kategorie in Google Drive ab.\n\n' +
      'Ablauf: Hochladen → KI analysiert → Prüfmaske kontrollieren und ggf. korrigieren → Kontakt wird angelegt (oder das Dokument an einen bestehenden Kontakt angehängt, falls ein Duplikat erkannt wird).',
  },
  {
    id: 'ki-upload.upload',
    area: 'ki-upload',
    title: 'Dokument hochladen',
    keywords: ['drag drop', 'foto', 'pdf', 'scan'],
    body:
      'Datei per Klick auswählen oder direkt in das gestrichelte Feld ziehen. Unterstützt werden PDF sowie Fotos (JPEG/PNG/WebP) bis 30 MB — auch fotografierte oder gescannte Dokumente werden erkannt.',
  },
  {
    id: 'ki-upload.pruefmaske',
    area: 'ki-upload',
    title: 'Prüfmaske',
    keywords: ['korrigieren', 'duplikat', 'kontakttyp', 'weitere personen'],
    body:
      'Die KI zeigt eine Zusammenfassung des erkannten Dokuments sowie alle extrahierten Kontakt-, Versicherungs- und Vertragsdaten zur Kontrolle an — vor dem Speichern lässt sich jedes Feld korrigieren.\n\n' +
      'Wird ein bereits vorhandener Kontakt erkannt (Duplikat), wird das Dokument stattdessen an diesen bestehenden Kontakt angehängt statt einen neuen anzulegen. Werden im Dokument weitere Personen erwähnt (z.B. Mitversicherte), landen diese als Notiz, nicht als eigener Kontakt — nur die vermittelnde Person wird nie automatisch als Kontakt extrahiert.',
  },
  {
    id: 'ki-upload.ablage',
    area: 'ki-upload',
    title: 'Ablage & Fertigstellung',
    keywords: ['google drive', 'kategorie', 'fertig', 'abschluss'],
    body:
      'Beim Speichern wird die Kategorie für die Google-Drive-Ablage automatisch anhand des Kontakttyps vorgeschlagen, lässt sich aber vor dem Abschluss noch ändern.\n\n' +
      'Nach Abschluss zeigt die Erfolgsseite einen direkten Link zum neu angelegten (oder ergänzten) Kontakt, sowie die Möglichkeit, direkt das nächste Dokument hochzuladen.',
  },
]
