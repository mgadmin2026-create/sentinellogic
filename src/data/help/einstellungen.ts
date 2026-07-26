import type { HelpArticle } from '@/types/help'

export const einstellungenArticles: HelpArticle[] = [
  {
    id: 'einstellungen.overview',
    area: 'einstellungen',
    title: 'Einstellungen — Überblick',
    isPageDefault: true,
    route: '/einstellungen',
    matchMode: 'exact',
    keywords: ['konfiguration', 'admin'],
    body:
      'Zentrale Anlaufstelle für alle Konfigurationsbereiche:\n\n' +
      '- Vertriebs-Prozess: die 12 Pipeline-Schritte anpassen\n' +
      '- Integration Setup: Dialfire-Kampagnen/Tasks und KlickTipp-Tags konfigurieren\n' +
      '- Dokumente & Google Drive: zentrale Drive-Verbindung und Ordnerstruktur\n' +
      '- E-Mail-Vorlagen: Vorlagen für den Kontakt-E-Mail-Versand\n' +
      '- Team (nur für Admins): Mitarbeiter-Konten und Rollen verwalten',
  },
  {
    id: 'einstellungen.prozess',
    area: 'einstellungen',
    title: 'Vertriebs-Prozess konfigurieren',
    isPageDefault: true,
    route: '/einstellungen/prozess',
    matchMode: 'exact',
    keywords: ['pipeline schritte', '12 schritte', 'stepper anpassen'],
    body:
      'Hier lassen sich die 12 Schritte der Vertriebspipeline anpassen, die auf jeder Kontaktdetailseite als Stepper erscheinen — z.B. Bezeichnung oder Reihenfolge der Schritte ändern.',
  },
  {
    id: 'einstellungen.integration',
    area: 'einstellungen',
    title: 'Integration Setup',
    isPageDefault: true,
    route: '/einstellungen/integration',
    matchMode: 'exact',
    keywords: ['dialfire kampagne', 'dialfire task', 'klicktipp tag'],
    body:
      'Pflegt die Auswahllisten für Dialfire-Kampagnen, Dialfire-Tasks und KlickTipp-Tags, die in Automatisierungsregeln und beim Anlegen von Kontakten zur Verfügung stehen.\n\n' +
      'Jede Zeile im Textfeld entspricht einem Eintrag (ID/Name), der danach in Dropdowns an anderer Stelle im CRM auswählbar ist.',
  },
  {
    id: 'einstellungen.dokumente-drive',
    area: 'einstellungen',
    title: 'Dokumente & Google Drive',
    isPageDefault: true,
    route: '/einstellungen/dokumente',
    matchMode: 'exact',
    keywords: ['oauth verbinden', 'ordnerstruktur', 'kategorien'],
    body:
      '„Mit Google Drive verbinden" richtet das zentrale System-Konto ein, in dem alle Dokumente aller Kontakte abgelegt werden — ein einziges gemeinsames Konto, nicht pro Mitarbeiter.\n\n' +
      'Darunter lässt sich die Ordnerstruktur je Kontakt-Typ (Privat/Gewerbe) konfigurieren, bis zu zwei Ebenen tief — das bestimmt, welche Kategorien beim Datei-Upload zur Auswahl stehen.\n\n' +
      'Falls die Verbindung abläuft (Token-Refresh schlägt fehl), erhalten Admins automatisch eine Benachrichtigungs-Mail — die Verbindung muss dann hier erneut hergestellt werden.',
  },
  {
    id: 'einstellungen.mail-vorlagen',
    area: 'einstellungen',
    title: 'E-Mail-Vorlagen verwalten',
    isPageDefault: true,
    route: '/einstellungen/mail-vorlagen',
    matchMode: 'exact',
    keywords: ['vorlage anlegen', 'platzhalter', 'betreff'],
    body:
      'Hier lassen sich E-Mail-Vorlagen anlegen, bearbeiten und löschen — jederzeit frei erweiterbar. Jede Vorlage hat Betreff und Text mit Platzhaltern wie {{vorname}}, {{nachname}}, {{firma}} oder {{versicherungsgesellschaft}}, die beim Versenden automatisch durch die echten Kontaktdaten ersetzt werden.\n\n' +
      'Die Vorlage befüllt beim E-Mail-Versand nur Betreff und Text vor — vor dem tatsächlichen Senden bleibt alles frei editierbar, es wird nichts automatisch verschickt.',
  },
  {
    id: 'einstellungen.team',
    area: 'einstellungen',
    title: 'Team verwalten',
    isPageDefault: true,
    route: '/einstellungen/team',
    matchMode: 'exact',
    keywords: ['mitarbeiter anlegen', 'rolle', 'admin', 'passwort zurücksetzen', 'nur admins'],
    body:
      'Nur für Admins sichtbar. Hier werden Mitarbeiter-Konten angelegt (mit temporärem Passwort — kein E-Mail-Versand nötig, die Zugangsdaten einmalig direkt weitergeben), Rollen (Admin/Mitarbeiter) geändert, Konten aktiviert/deaktiviert und Passwörter zurückgesetzt.\n\n' +
      'Jeder Mitarbeiter kann zusätzlich unter „Mein Profil" selbst seinen Namen und sein Passwort ändern.',
  },
]
