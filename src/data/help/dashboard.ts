import type { HelpArticle } from '@/types/help'

export const dashboardArticles: HelpArticle[] = [
  {
    id: 'dashboard.overview',
    area: 'dashboard',
    title: 'Dashboard — Überblick',
    isPageDefault: true,
    route: '/dashboard',
    matchMode: 'exact',
    keywords: ['startseite', 'übersicht'],
    body:
      'Das Dashboard ist deine persönliche Startseite — alles, was für dich heute relevant ist, auf einen Blick:\n\n' +
      '- KPI-Kacheln: die wichtigsten Kennzahlen deiner Kontakte\n' +
      '- Heute im Fokus: deine überfälligen und heute fälligen Aufgaben\n' +
      '- Meine Kontakte: die dir zugewiesenen Kontakte nach Fortschritt sortiert\n' +
      '- Letzte Aktivitäten und Pipeline-Übersicht\n' +
      '- Schnellzugriff für die häufigsten Aktionen\n\n' +
      'Admins können über "Team"/"Meine Ansicht" zwischen der eigenen und der gesamten Team-Sicht umschalten.',
  },
  {
    id: 'dashboard.kpi-kacheln',
    area: 'dashboard',
    title: 'KPI-Kacheln',
    keywords: ['kennzahlen', 'überfällig', 'heute fällig', 'abschlussquote'],
    body:
      'Vier Kennzahlen auf einen Blick: Anzahl Kontakte (deine bzw. gesamt, je nach Ansicht), überfällige Aufgaben, heute fällige Aufgaben und die Abschlussquote.\n\n' +
      'In der Team-Ansicht (nur für Admins) beziehen sich die Zahlen auf das gesamte Team, nicht nur auf dich.',
  },
  {
    id: 'dashboard.heute-im-fokus',
    area: 'dashboard',
    title: '„Heute im Fokus"',
    keywords: ['aufgaben', 'überfällig', 'erledigt'],
    body:
      'Zeigt deine überfälligen und heute fälligen Aufgaben gebündelt an einer Stelle — die Reihenfolge priorisiert automatisch Überfälliges zuerst.\n\n' +
      'Über die Checkbox lässt sich eine Aufgabe direkt als erledigt markieren, ohne den zugehörigen Kontakt öffnen zu müssen.',
  },
  {
    id: 'dashboard.meine-kontakte',
    area: 'dashboard',
    title: '„Meine Kontakte"',
    keywords: ['zugewiesen', 'fortschritt', 'pipeline-stand'],
    body:
      'Zeigt nur die dir zugewiesenen Kontakte (bzw. alle, in der Team-Ansicht), sortiert nach Fortschritt in der 12-Schritte-Pipeline — Kontakte mit dem meisten Handlungsbedarf stehen oben.\n\n' +
      'Ein Klick auf einen Kontakt öffnet direkt seine Detailseite.',
  },
  {
    id: 'dashboard.aktivitaeten',
    area: 'dashboard',
    title: '„Letzte Aktivitäten"',
    keywords: ['verlauf', 'protokoll'],
    body:
      'Ein gebündelter Feed der zuletzt protokollierten Ereignisse über alle deine Kontakte hinweg (bzw. alle Kontakte in der Team-Ansicht) — E-Mails, Statusänderungen, Anrufe und mehr.',
  },
  {
    id: 'dashboard.pipeline',
    area: 'dashboard',
    title: '„Meine Pipeline" / „Team-Pipeline"',
    keywords: ['fortschrittsbalken', 'schritte', 'verteilung'],
    body:
      'Zeigt, wie viele deiner Kontakte (bzw. aller Kontakte im Team) sich gerade in welchem der 12 Pipeline-Schritte befinden — als Balkendiagramm, längster Balken = meiste Kontakte in diesem Schritt.',
  },
  {
    id: 'dashboard.schnellzugriff',
    area: 'dashboard',
    title: '„Schnellzugriff"',
    keywords: ['neuer kontakt', 'neue aufgabe', 'termin', 'csv import', 'shortcuts'],
    body:
      'Vier häufig genutzte Aktionen direkt vom Dashboard aus, ohne erst zur jeweiligen Seite zu navigieren: Neuer Kontakt, Neue Aufgabe, Termin planen (öffnet den Kalender) und CSV importieren.',
  },
  {
    id: 'dashboard.ansicht-umschalter',
    area: 'dashboard',
    title: '„Meine Ansicht" / „Team"',
    keywords: ['admin', 'umschalten', 'toggle'],
    body:
      'Nur für Admins sichtbar: schaltet alle Dashboard-Kacheln zwischen der persönlichen Sicht (nur eigene Kontakte/Aufgaben) und der Team-Sicht (alle Mitarbeiter) um. Mitarbeiter ohne Admin-Rolle sehen ausschließlich ihre eigene Ansicht.',
  },
]
