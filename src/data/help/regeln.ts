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
    id: 'regeln.manuelle-ausfuehrung',
    area: 'regeln',
    title: 'Manuelle Ausführung',
    keywords: ['batch', 'nachträglich anwenden', 'zähler', 'runs'],
    body:
      'Eine Regel lässt sich auch nachträglich manuell auf bereits bestehende, passende Kontakte anwenden (Batch-Ausführung) — nützlich, wenn eine Regel erst nach der Kontakterstellung angelegt wurde.\n\n' +
      'Der Zähler an jeder Regel zeigt, wie oft sie insgesamt schon ausgeführt wurde.',
  },
]
