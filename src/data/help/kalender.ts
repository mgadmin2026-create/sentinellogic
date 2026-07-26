import type { HelpArticle } from '@/types/help'

export const kalenderArticles: HelpArticle[] = [
  {
    id: 'kalender.overview',
    area: 'kalender',
    title: 'Kalender — Überblick',
    isPageDefault: true,
    route: '/kalender',
    matchMode: 'exact',
    keywords: ['termine', 'fälligkeiten'],
    body:
      'Der Kalender zeigt deine Aufgaben nach Fälligkeitsdatum, wahlweise in Monats- oder Wochenansicht.\n\n' +
      'Rechts daneben: ein Status-Filter (Nicht erledigt/Alle) und die Detailliste aller Aufgaben des gerade ausgewählten Tages.',
  },
  {
    id: 'kalender.ansicht',
    area: 'kalender',
    title: 'Monats- & Wochenansicht',
    keywords: ['umschalten', 'navigation', 'vor', 'zurück'],
    body:
      'Über die Umschalter oben rechts zwischen Monats- und Wochenansicht wechseln. Mit den Pfeilen daneben zum vorherigen bzw. nächsten Zeitraum springen.\n\n' +
      'Ein Klick auf einen Tag in der Monatsansicht wählt ihn aus und zeigt seine Aufgaben in der rechten Spalte.',
  },
  {
    id: 'kalender.status-filter',
    area: 'kalender',
    title: 'Status-Filter',
    keywords: ['nicht erledigt', 'alle', 'erledigte aufgaben ausblenden'],
    body:
      '"Nicht erledigt" blendet bereits abgeschlossene Aufgaben aus der Kalenderansicht aus — praktisch für den täglichen Überblick. "Alle" zeigt auch bereits erledigte Aufgaben, z.B. zur Rückschau.',
  },
  {
    id: 'kalender.ausgewaehlter-tag',
    area: 'kalender',
    title: 'Ausgewählter Tag',
    keywords: ['tagesdetails', 'liste'],
    body:
      'Zeigt alle Aufgaben des aktuell ausgewählten Tages als Liste. Ein Klick auf eine Aufgabe öffnet sie zum Bearbeiten, inklusive Kommentarverlauf.',
  },
]
