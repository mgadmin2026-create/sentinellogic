import type { HelpArticle } from '@/types/help'

export const regelnArticles: HelpArticle[] = [
  {
    id: 'regeln.overview',
    area: 'regeln',
    title: 'Automatisierungsregeln — Überblick',
    isPageDefault: true,
    route: '/regeln',
    matchMode: 'exact',
    keywords: ['automatisierung', 'wenn dann'],
    body:
      'Automatisierungsregeln legen fest, was automatisch passiert, wenn ein neuer Kontakt aus einer bestimmten Quelle eingeht — z.B. automatische Zuordnung zu einer Dialfire-Kampagne, ein KlickTipp-Tag oder eine Benachrichtigung.\n\n' +
      'Jede Regel besteht aus einer WENN-Bedingung (z.B. Quelle = Facebook) und einer DANN-Aktion (z.B. Felder befüllen, Sync auslösen, benachrichtigen).',
  },
  {
    id: 'regeln.wenn-dann',
    area: 'regeln',
    title: 'WENN / DANN verstehen',
    keywords: ['bedingung', 'aktion', 'quelle', 'trigger'],
    body:
      'WENN beschreibt die Bedingung, unter der die Regel greift — meist die Quelle des Kontakts (Facebook, Calendly, CSV, E-Mail, Manuell).\n\n' +
      'DANN beschreibt, was automatisch ausgeführt wird: Felder automatisch befüllen (z.B. Dialfire-Kampagne/Task, KlickTipp-Tag), eine Synchronisation auslösen, und optional eine Benachrichtigung per E-Mail versenden.',
  },
  {
    id: 'regeln.erstellen',
    area: 'regeln',
    title: 'Regel erstellen/bearbeiten',
    keywords: ['neue regel', 'status', 'aktivieren'],
    body:
      'Beim Anlegen: Quelle auswählen, Versicherungsprodukt (optional), KlickTipp-Tag, Dialfire-Kampagne und -Task zuordnen, Status (aktiv/inaktiv) setzen und festlegen, ob bei Auslösung eine Benachrichtigung verschickt werden soll.\n\n' +
      'Inaktive Regeln bleiben gespeichert, greifen aber nicht — praktisch, um eine Regel vorübergehend zu pausieren, ohne sie zu löschen.',
  },
  {
    id: 'regeln.verlauf',
    area: 'regeln',
    title: 'Verlauf: Was hat die Regel bewirkt?',
    keywords: ['historie', 'nachvollziehen', 'protokoll', 'sync-fehler', 'angelegt', 'synchronisiert'],
    body:
      '„Verlauf" unter jeder Regel klappt auf, welche Kontakte die Regel tatsächlich verändert hat — und was danach passiert ist.\n\n' +
      'Je Zeile siehst du:\n' +
      '- Zeitpunkt und ob die Regel automatisch beim Kontakteingang oder manuell über „Anwenden" gelaufen ist\n' +
      '- den Kontakt, mit Hinweis „neu angelegt", wenn er in diesem Zuge entstanden ist\n' +
      '- welche Felder gesetzt wurden (Dialfire-Kampagne, Task, Status, KlickTipp-Tag)\n' +
      '- ob die Übertragung an Dialfire und KlickTipp geklappt hat; bei einem Fehler steht die Meldung im Klartext darunter\n\n' +
      'Der Sync-Stand zeigt immer die letzte Rückmeldung zu diesem Kontakt — ein späterer erfolgreicher Lauf hebt einen früheren Fehler also auf. KlickTipp-Kontakte und Tags werden direkt durch Sentimental Logic übertragen.\n\n' +
      'Steht dort „keinen Kontakt verändert", wurde die Regel zwar ausgeführt, es passte aber kein Kontakt zur eingestellten Quelle. Das ist kein Fehler.',
  },
  {
    id: 'regeln.manuelle-ausfuehrung',
    area: 'regeln',
    title: 'Manuelle Ausführung',
    keywords: ['batch', 'nachträglich anwenden', 'zähler', 'runs'],
    body:
      'Eine Regel lässt sich auch nachträglich manuell auf bereits bestehende, passende Kontakte anwenden (Batch-Ausführung) — nützlich, wenn eine Regel erst nach der Kontakterstellung angelegt wurde.\n\n' +
      'Der Zähler an jeder Regel zeigt, wie oft sie insgesamt schon ausgeführt wurde.',
  },
]
