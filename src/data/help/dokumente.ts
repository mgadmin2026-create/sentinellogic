import type { HelpArticle } from '@/types/help'

export const dokumenteArticles: HelpArticle[] = [
  {
    id: 'dokumente.overview',
    area: 'dokumente',
    title: 'Dokumente — Überblick',
    isPageDefault: true,
    route: '/dokumente',
    matchMode: 'exact',
    keywords: ['google drive', 'ablage', 'dateien'],
    body:
      'Zentrale Übersicht aller hochgeladenen Dokumente über alle Kontakte hinweg. Jede Datei wird automatisch in Google Drive abgelegt und komprimiert (Bilder und PDFs).\n\n' +
      'Der eigentliche Upload erfolgt immer über einen Kontakt (Kontaktdetail → Dokumente-Kachel) oder automatisch über E-Mail-Anhänge und Kommentar-Anhänge — diese Seite hier ist die durchsuchbare Gesamtübersicht.',
  },
  {
    id: 'dokumente.stats',
    area: 'dokumente',
    title: 'Statistik-Kacheln',
    keywords: ['anzahl', 'komprimiert', 'gespart'],
    body:
      'Zeigt die Gesamtzahl der Dokumente, die komprimierte Gesamtgröße und den durch die Kompression eingesparten Speicherplatz.',
  },
  {
    id: 'dokumente.google-drive-verbindung',
    area: 'dokumente',
    title: 'Google-Drive-Verbindung',
    keywords: ['nicht verbunden', 'oauth', 'token', 'reconnect'],
    body:
      'Wenn Google Drive nicht verbunden ist, erscheint ein Hinweis mit einem Link zur Verbindungs-Einstellung — dort lässt sich das zentrale System-Konto (neu) verbinden.\n\n' +
      'Ist die Verbindung bereits eingerichtet, aber der Token abgelaufen (z.B. nach längerer Nichtnutzung), schlägt der automatische Refresh fehl — in diesem Fall werden die Admins automatisch per E-Mail benachrichtigt, und die Verbindung muss unter Einstellungen → Dokumente erneut hergestellt werden.',
  },
  {
    id: 'dokumente.suche-tabelle',
    area: 'dokumente',
    title: 'Suche & Tabelle',
    keywords: ['download', 'original', 'ersparnis'],
    body:
      'Die Suche filtert nach Dateiname oder zugeordnetem Kontakt. Die Tabelle zeigt pro Dokument: Dateiname, zugehörigen Kontakt, Original- und komprimierte Größe, Ersparnis in Prozent, Upload-Datum und eine Download-Aktion.',
  },
]
