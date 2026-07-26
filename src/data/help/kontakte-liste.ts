import type { HelpArticle } from '@/types/help'

export const kontakteListeArticles: HelpArticle[] = [
  {
    id: 'kontakte-liste.overview',
    area: 'kontakte-liste',
    title: 'Kontakte — Überblick',
    isPageDefault: true,
    route: '/kontakte',
    matchMode: 'exact',
    keywords: ['kontaktliste', 'kundenliste'],
    body:
      'Die Kontaktliste zeigt alle Kontakte mit Suche, Filtern, anpassbaren Spalten und Export. Ein Klick auf eine Zeile öffnet die vollständige Kontaktdetailseite.\n\n' +
      '- Suche + Filter (Status, Quelle, Tags, Verantwortlicher)\n' +
      '- Spalten anpassen: welche Felder in der Tabelle sichtbar sind\n' +
      '- Export als CSV, Excel oder PDF (berücksichtigt die aktiven Filter)\n' +
      '- Import neuer Kontakte per CSV\n' +
      '- Archivieren/Wiederherstellen statt endgültigem Löschen',
  },
  {
    id: 'kontakte-liste.suche-filter',
    area: 'kontakte-liste',
    title: 'Suche & Filter',
    keywords: ['status filter', 'quelle', 'tags filter', 'archiviert anzeigen'],
    body:
      'Die Suche durchsucht Name, E-Mail und Firma. Zusätzlich lässt sich nach Status, Quelle und Tags filtern (mehrere Tags gleichzeitig = UND-Verknüpfung).\n\n' +
      'Archivierte Kontakte sind standardmäßig ausgeblendet — über den Schalter "Archivierte anzeigen" werden sie sichtbar.',
  },
  {
    id: 'kontakte-liste.spalten-anpassen',
    area: 'kontakte-liste',
    title: 'Spalten anpassen',
    keywords: ['tabelle', 'ansicht', 'reihenfolge'],
    body:
      'Über "Spalten anpassen" lässt sich auswählen, welche Felder in der Tabelle angezeigt werden, in welcher Reihenfolge, und wie kompakt die Zeilen dargestellt werden. Die Einstellung bleibt für deine Ansicht erhalten.',
  },
  {
    id: 'kontakte-liste.export-import',
    area: 'kontakte-liste',
    title: 'Export & Import',
    keywords: ['csv', 'excel', 'xlsx', 'pdf', 'importieren'],
    body:
      'Export: CSV, Excel oder PDF — enthält immer nur die Kontakte, die den aktuell aktiven Filtern entsprechen.\n\n' +
      'Import: CSV-Datei mit Kontaktdaten hochladen, Felder den passenden Spalten zuordnen, Duplikate werden vor dem Import geprüft.',
  },
  {
    id: 'kontakte-liste.archivieren',
    area: 'kontakte-liste',
    title: 'Archivieren statt Löschen',
    keywords: ['löschen', 'wiederherstellen', 'papierkorb'],
    body:
      'Kontakte werden nicht endgültig gelöscht, sondern archiviert — das lässt sich jederzeit rückgängig machen ("Wiederherstellen"). Beim Archivieren kann optional festgelegt werden, ob zugehörige offene Aufgaben mitarchiviert werden sollen.',
  },
  {
    id: 'kontakte-liste.tabelle-aktionen',
    area: 'kontakte-liste',
    title: 'Zeilen-Aktionen',
    keywords: ['notiz hinzufügen', 'details', 'schnellnotiz'],
    body:
      'Pro Zeile: Klick auf den Kontaktnamen öffnet die Detailseite. Über die Aktionsspalte lässt sich außerdem direkt eine Schnellnotiz hinzufügen, ohne die Detailseite zu öffnen, sowie archivieren/wiederherstellen.',
  },
]
