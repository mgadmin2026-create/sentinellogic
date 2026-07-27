import type { HelpArticle } from '@/types/help'

export const reportingArticles: HelpArticle[] = [
  {
    id: 'reporting.overview',
    area: 'reporting',
    title: 'Selektion — Überblick',
    isPageDefault: true,
    route: '/reporting',
    matchMode: 'exact',
    keywords: ['auswertung', 'kpi', 'nl2sql', 'freitext'],
    body:
      'Frag in eigenen Worten nach einer Auswertung — z.B. „Wie viele Kontakte kamen diesen Monat über Facebook?" — die Anfrage wird live in eine Datenbankabfrage übersetzt und als Tabelle dargestellt.\n\n' +
      'Kein SQL-Wissen nötig, aber wer möchte, kann sich die generierte Abfrage zur Kontrolle anzeigen lassen.',
  },
  {
    id: 'reporting.eingabe',
    area: 'reporting',
    title: 'Frage stellen',
    keywords: ['prompt', 'beispiel', 'freitext'],
    body:
      'Frage in das Textfeld eintippen und auf "📊 Auswerten" klicken. Die vorgeschlagenen Beispiel-Fragen als Chips liefern eine schnelle Orientierung, welche Art von Fragen funktioniert.',
  },
  {
    id: 'reporting.ergebnis',
    area: 'reporting',
    title: 'Ergebnis & SQL-Ansicht',
    keywords: ['tabelle', 'csv export', 'generierte sql'],
    body:
      'Das Ergebnis erscheint als Tabelle, dazu eine kurze Erklärung der Auswertung in Textform. Über "Generierte SQL anzeigen" lässt sich die tatsächlich ausgeführte Abfrage einsehen — praktisch zur Kontrolle oder falls das Ergebnis unerwartet aussieht.\n\n' +
      'Über den Export-Button lässt sich das Ergebnis als CSV herunterladen.',
  },
]
