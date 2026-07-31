import type { HelpArticle } from '@/types/help'

export const kalenderArticles: HelpArticle[] = [
  {
    id: 'kalender.overview',
    area: 'kalender',
    title: 'Kalender — Überblick',
    isPageDefault: true,
    route: '/kalender',
    matchMode: 'exact',
    keywords: ['termine', 'fälligkeiten', 'strato'],
    body:
      'Der Kalender zeigt drei Quellen gemeinsam in einem Raster: echte Termine mit Uhrzeit (blau), Aufgaben-Fälligkeiten (orange) und Geburtstage aus den Kontaktdaten (pink) — jede einzeln aus-/einblendbar über "Meine Kalender" links.\n\n' +
      '"+ Neuer Termin" legt einen echten Termin mit Start-/Endzeit an. Ein Klick auf eine leere Zeitzelle im Tag-/Wochenraster tut dasselbe, vorbefüllt mit der angeklickten Uhrzeit.',
  },
  {
    id: 'kalender.ansicht',
    area: 'kalender',
    title: 'Ansichten: Tag, Arbeitswoche, Woche, Monat, Jahr',
    keywords: ['umschalten', 'navigation', 'vor', 'zurück', 'stundenraster'],
    body:
      'Über das Dropdown oben rechts zwischen fünf Ansichten wechseln. Tag/Arbeitswoche/Woche zeigen ein Stundenraster mit roter Linie für die aktuelle Uhrzeit; Monat zeigt ein 6-Wochen-Raster mit Termin-Kürzeln pro Tag; Jahr zeigt alle 12 Monate kompakt nebeneinander.\n\n' +
      '"‹ Heute ›" navigiert im jeweils passenden Schritt (Tag/Woche/Monat/Jahr). Ein Klick auf einen Tag in der Monatsansicht springt in die Tagesansicht; ein Klick in der Jahresansicht springt in die Monatsansicht.',
  },
  {
    id: 'kalender.meine-kalender',
    area: 'kalender',
    title: '"Meine Kalender" — Quellen ein-/ausblenden',
    keywords: ['termine', 'aufgaben', 'geburtstage', 'farbe', 'checkbox'],
    body:
      'Drei Quellen erscheinen im selben Kalender, farblich unterschieden:\n\n' +
      '- Termine (blau) — echte, im CRM angelegte Termine mit Uhrzeit\n' +
      '- Aufgaben-Fälligkeiten (orange) — offene Aufgaben, angezeigt an ihrem Fälligkeitsdatum als ganztägiger Eintrag\n' +
      '- Geburtstage (pink) — aus dem Geburtsdatum-Feld der Kontakte, erscheinen automatisch jedes Jahr wieder\n\n' +
      'Ein Klick auf einen Aufgaben- oder Geburtstags-Eintrag öffnet die zugehörige Aufgabe bzw. den Kontakt; ein Klick auf einen Termin öffnet ihn zum Bearbeiten.',
  },
  {
    id: 'kalender.termin-bearbeiten',
    area: 'kalender',
    title: 'Termin anlegen, bearbeiten, löschen',
    keywords: ['ganztägig', 'ort', 'kontakt', 'verantwortlicher'],
    body:
      'Ein Termin braucht mindestens Titel, Start und Ende. "Ganztägig" blendet die Uhrzeitfelder aus und rechnet den Termin auf den ganzen Tag. Optional: Ort, Beschreibung, Verknüpfung zu einem Kontakt und ein Verantwortlicher aus dem Team.\n\n' +
      'Beim Bearbeiten eines bestehenden Termins steht unten links ein "Löschen"-Button zur Verfügung.',
  },
]
