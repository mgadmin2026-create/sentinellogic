import type { HelpArticle } from '@/types/help'

export const syncArticles: HelpArticle[] = [
  {
    id: 'sync.overview',
    area: 'sync',
    title: 'Synchronisation — Überblick',
    isPageDefault: true,
    route: '/sync',
    matchMode: 'exact',
    keywords: ['lead-import', 'quellen'],
    body:
      'Zentrale Steuerung, woher neue Leads automatisch importiert werden: Facebook Lead Ads, Calendly, E-Mail (IMAP) und CSV-Import.\n\n' +
      'Jede Quelle kann automatisch in festen Intervallen synchronisieren oder manuell per Klick. Unten im Sync-Protokoll lässt sich jeder Lauf im Detail nachvollziehen.',
  },
  {
    id: 'sync.quellen-kacheln',
    area: 'sync',
    title: 'Quellen-Kacheln',
    keywords: ['facebook', 'calendly', 'imap', 'csv', 'status', 'auto-sync'],
    body:
      'Jede Kachel zeigt eine Quelle mit Verbindungsstatus (verbunden/Konfiguration ausstehend/inaktiv), dem Zeitpunkt der letzten Synchronisation und einem Auto-Sync-Schalter mit einstellbarem Intervall.\n\n' +
      '"Jetzt synchronisieren" löst pro Quelle einen sofortigen manuellen Lauf aus, unabhängig vom eingestellten Intervall. Bei Facebook lässt sich zusätzlich eine Vorschau der neuen Leads vor dem eigentlichen Import einblenden.',
  },
  {
    id: 'sync.alle-synchronisieren',
    area: 'sync',
    title: '„Alle synchronisieren"',
    keywords: ['manuell', 'sofort'],
    body:
      'Löst für alle aktiven (nicht-inaktiven) Quellen gleichzeitig einen manuellen Sync-Lauf aus — praktisch, um kurz vor einem Team-Meeting sicherzustellen, dass alle Leads aktuell sind.',
  },
  {
    id: 'sync.protokoll',
    area: 'sync',
    title: 'Sync-Protokoll',
    keywords: ['log', 'importiert', 'duplikate', 'fehler'],
    body:
      'Jeder Sync-Lauf wird protokolliert: Datum, Quelle, Anzahl importierter Leads, erkannte Duplikate, Fehler und Gesamtstatus. Eine Zeile aufklappen zeigt die Details — z.B. welche Namen konkret importiert wurden oder woran ein Fehler lag.',
  },
]
