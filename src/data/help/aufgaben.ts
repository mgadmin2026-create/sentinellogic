import type { HelpArticle } from '@/types/help'

export const aufgabenArticles: HelpArticle[] = [
  {
    id: 'aufgaben.overview',
    area: 'aufgaben',
    title: 'Aufgaben — Überblick',
    isPageDefault: true,
    route: '/aufgaben',
    matchMode: 'exact',
    keywords: ['todo', 'aufgabenliste'],
    body:
      'Die Aufgabenliste zeigt alle Aufgaben über alle Kontakte hinweg, mit Suche, Status- und weiteren Filtern.\n\n' +
      '- Suche nach Titel oder Kontaktname\n' +
      '- "Meine Aufgaben" blendet auf die dir zugewiesenen Aufgaben ein\n' +
      '- Status-Filter (Offen/In Bearbeitung/Erledigt) und weitere Filter nach Priorität/Verantwortlichem\n' +
      '- "+ Neue Aufgabe" legt eine Aufgabe an, optional mit Kontaktbezug\n\n' +
      'Jede Aufgabe hat eigene Kommentare — mit @-Erwähnung, um Kolleg:innen einzubeziehen.',
  },
  {
    id: 'aufgaben.suche-filter',
    area: 'aufgaben',
    title: 'Suche & Filter',
    keywords: ['meine aufgaben', 'status', 'priorität', 'verantwortlicher'],
    body:
      'Die Suche durchsucht Titel und zugeordneten Kontaktnamen. "Meine Aufgaben" ist ein Schnellfilter, der nur die dir zugewiesenen Aufgaben zeigt.\n\n' +
      'Zusätzlich lässt sich nach Status (Offen/In Bearbeitung/Erledigt), Priorität (Niedrig/Mittel/Hoch) und Verantwortlichem filtern — alle Filter lassen sich kombinieren.',
  },
  {
    id: 'aufgaben.neue-aufgabe',
    area: 'aufgaben',
    title: 'Neue Aufgabe anlegen',
    keywords: ['titel', 'beschreibung', 'fällig', 'kontakt zuordnen'],
    body:
      'Pflichtfelder: Titel, Fälligkeitsdatum und Verantwortlicher. Optional: Beschreibung, Priorität und ein zugeordneter Kontakt.\n\n' +
      'Eine Aufgabe kann auch ganz ohne Kontaktbezug angelegt werden (z.B. für interne To-dos) — dann ist allerdings kein Datei-Anhang an Kommentaren möglich, da dafür ein Kontakt zur Ablage nötig ist.',
  },
  {
    id: 'aufgaben.status-prioritaet',
    area: 'aufgaben',
    title: 'Status & Priorität ändern',
    keywords: ['offen', 'in bearbeitung', 'erledigt', 'niedrig', 'hoch'],
    body:
      'Status und Priorität lassen sich direkt in der Liste per Dropdown ändern, ohne die Aufgabe extra zu öffnen. Für alle weiteren Felder (Titel, Beschreibung, Fälligkeit, Verantwortlicher, Kontakt) die Aufgabe anklicken — das öffnet das vollständige Bearbeiten-Fenster inklusive Kommentarverlauf.',
  },
  {
    id: 'aufgaben.kommentare',
    area: 'aufgaben',
    title: 'Kommentare an Aufgaben',
    keywords: ['erwähnung', '@', 'weiterleiten', 'hilfe anfordern'],
    body:
      'Jede Aufgabe hat einen eigenen Kommentarverlauf — sichtbar im Bearbeiten-Fenster, ganz unten.\n\n' +
      'Typische Anwendungsfälle: eine falsch zugewiesene Aufgabe mit @-Erwähnung an die richtige Person weiterleiten, oder mit @-Erwähnung um Unterstützung bei einer Aufgabe bitten. Mit @Alle erreichst du das ganze Team.',
  },
]
