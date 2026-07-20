// Release Notes — Versionshistorie und neue Features
// Diese Datei definiert alle Release Notes für die App

export interface ReleaseNoteFeature {
  title: string
  description: string
  category: 'feature' | 'improvement' | 'fix' | 'security'
  icon?: string
}

export interface ReleaseNote {
  version: string // Semantic versioning: "0.2.0"
  date: string // ISO format: "2026-06-20"
  title: string // Kurztitel für Banner
  summary: string // 1-2 Sätze für Banner
  features: ReleaseNoteFeature[]
  breaking_changes?: string[]
  known_issues?: string[]
  next_release_date?: string
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: '0.6.0',
    date: '2026-07-20',
    title: 'Kontakte: Archivieren, Tags, Export & erweiterter Import',
    summary:
      'Kontakte werden jetzt archiviert statt gelöscht, bekommen interne Tags, lassen sich als CSV/Excel/PDF exportieren und der Import bietet fast alle Kontaktfelder zum Mappen an',
    features: [
      {
        title: 'Kontakte archivieren statt löschen',
        description:
          'Der Löschen-Button archiviert Kontakte jetzt reversibel statt sie endgültig zu entfernen — inkl. Option, verknüpfte Aufgaben mitzuarchivieren. Archivierte Kontakte werden aus der Liste ausgeblendet (Toggle „Archivierte anzeigen") und lassen sich jederzeit wiederherstellen. Status zeigt überall „Archiviert" statt des zuletzt gültigen Business-Status. Echtes, endgültiges Löschen ist nur noch über direkten Datenbankzugriff möglich.',
        category: 'feature',
        icon: '🗄️',
      },
      {
        title: 'Interne Tags',
        description:
          'Kontakte lassen sich mit frei definierbaren Tags versehen (Freitext-Eingabe mit Autocomplete) und in der Liste nach mehreren Tags gleichzeitig filtern. Tags sind auch über das NL→SQL-Reporting-Tool abfragbar.',
        category: 'feature',
        icon: '🏷️',
      },
      {
        title: 'Export als CSV, Excel oder PDF',
        description:
          'Neuer Export-Button in der Kontaktliste: CSV mit allen Feldern, Excel mit formatierter Kopfzeile, PDF im Querformat mit Filter-Zusammenfassung. Der Export berücksichtigt alle aktiven Filter (Status, Quelle, Sparte, Tags, ...).',
        category: 'feature',
        icon: '⬇️',
      },
      {
        title: 'CSV-Import erweitert',
        description:
          'Der Import-Button ist jetzt auch direkt in der Kontaktübersicht verfügbar, nicht mehr nur im Dashboard. Beim Spalten-Mapping stehen fast alle Kontaktfelder zur Auswahl (vorher nur 16 von rund 65).',
        category: 'improvement',
        icon: '📥',
      },
      {
        title: 'Kontakte kopieren entfernt',
        description:
          'Die unfertige Kopieren-Funktion (kein eigener Endpoint, unklares Verhalten bei Duplikaten) wurde entfernt.',
        category: 'improvement',
        icon: '🧹',
      },
      {
        title: 'Fehlende Felder beim Anlegen behoben',
        description:
          'Sparte, Qualität, Bestandskunde, Rechtsform, Anrede, Bemerkung und mehrere Versicherungs-/Gewerbefelder wurden beim Neuanlegen eines Kontakts (Maske wie CSV-Import) bisher stillschweigend verworfen — jetzt werden sie korrekt gespeichert.',
        category: 'fix',
        icon: '🛠️',
      },
      {
        title: 'Regressionstests im Testdashboard',
        description:
          'Fünf neue Playwright-Tests decken Archivieren, Import, Export und Tags ab und laufen automatisch nach jedem Deploy gegen die Produktions-App.',
        category: 'improvement',
        icon: '✅',
      },
    ],
    breaking_changes: ['Kontakte kopieren ist nicht mehr verfügbar.'],
    known_issues: [
      'Das Feld „Verantwortlicher" (assigned_user_name) im Kontakt-Bearbeiten-Formular verweist auf eine nicht existierende Datenbankspalte und schlägt beim Speichern fehl — vorbestehender Bug, noch nicht behoben.',
    ],
  },
  {
    version: '0.5.0',
    date: '2026-07-07',
    title: 'KI Upload & Intelligente Dokumentenablage',
    summary:
      'Versicherungsdokumente hochladen — die KI erkennt den Kunden, legt den Kontakt an und ordnet die Datei automatisch in Google Drive ein',
    features: [
      {
        title: 'KI Upload',
        description:
          'Neue Seite /ki-upload: Police, Angebot oder Nachtrag hochladen (PDF oder Foto, auch gescannte Dokumente). Die KI extrahiert Kunde, Adresse, Versicherungsdaten und Vertragsnummer, erkennt Privat/Gewerbe und unterscheidet Versicherungsnehmer vom Vermittler. Nach Prüfung in der editierbaren Maske: ein Klick legt den Kontakt an und legt die Datei ab.',
        category: 'feature',
        icon: '🤖',
      },
      {
        title: 'Duplikat-Erkennung beim KI Upload',
        description:
          'Existiert der Kunde bereits (E-Mail, Name oder Firma), wird das Dokument wahlweise an den bestehenden Kontakt angehängt statt einen Doppelkontakt zu erzeugen.',
        category: 'feature',
        icon: '🔍',
      },
      {
        title: 'Konfigurierbare Ordnerstruktur pro Kontakt-Typ',
        description:
          'In Einstellungen → Dokumente lässt sich die Drive-Ordnerstruktur je Kontakt-Typ (Privat/Gewerbe) verwalten: Kategorien + Unterkategorien (max. 2 Ebenen). Umbenennen wirkt automatisch auf alle bestehenden Kunden-Ordner in Google Drive.',
        category: 'feature',
        icon: '🗂️',
      },
      {
        title: 'Kontakt-Typ Privat/Gewerbe',
        description:
          'Neues Feld am Kontakt (Modal, Übersicht) — steuert, welche Dokumenten-Ordnerstruktur beim Upload gilt. Der KI Upload erkennt den Typ automatisch (z.B. GmbH → Gewerbe).',
        category: 'feature',
        icon: '🏢',
      },
      {
        title: 'Upload mit Kategorie-Auswahl',
        description:
          'Beim Dokument-Upload im Kontakt wählbar, unter welcher Kategorie die Datei in Drive abgelegt wird. Kategorie-Badge und Filter in der Dokumentenliste und auf /dokumente.',
        category: 'improvement',
        icon: '📎',
      },
      {
        title: 'Regel-Trigger "KI Upload"',
        description:
          'Automatisierungsregeln können auf die neue Quelle "KI Upload" reagieren — z.B. automatisch Dialfire-Kampagne oder KlickTipp-Tag setzen.',
        category: 'improvement',
        icon: '⚡',
      },
      {
        title: 'Versicherungsfelder speicherbar',
        description:
          'Gesellschaft, Sparte, Zahlweise, IBAN & Co. in der Kontakt-Übersicht wurden beim Speichern bisher still verworfen — jetzt behoben.',
        category: 'fix',
        icon: '🛠️',
      },
      {
        title: 'Secrets aus dem Repository entfernt',
        description:
          'Env-Dateien mit Zugangsdaten aus dem Git-Tracking entfernt und .gitignore verschärft.',
        category: 'security',
        icon: '🔐',
      },
    ],
    breaking_changes: [],
    known_issues: [
      'E-Mail ist jetzt optional bei Kontakten — KlickTipp-Sync läuft nur bei vorhandener E-Mail',
    ],
    next_release_date: '2026-07-20',
  },
  {
    version: '0.4.0',
    date: '2026-07-05',
    title: 'Automationen, Integrationen & Zentrale Dokumentenablage',
    summary:
      'Automation-Engine mit Regeln, E-Mail-Benachrichtigungen, Dialfire-Fixes und zentrale Google-Drive-Dokumentenablage mit Kompression',
    features: [
      {
        title: 'Automation-Engine',
        description:
          'Regeln (/regeln) laufen automatisch bei jeder Kontakt-Erstellung: je nach Quelle werden Dialfire-Kampagne, Task und KlickTipp-Tags gesetzt und die Syncs ausgelöst. Manuelle Batch-Ausführung auf Bestandskontakte inklusive Zähler.',
        category: 'feature',
        icon: '⚡',
      },
      {
        title: 'E-Mail-Benachrichtigungen aus Regeln',
        description:
          'Regeln mit hinterlegter Benachrichtigungs-E-Mail versenden jetzt tatsächlich: pro neuem Kontakt (automatisch) bzw. eine Zusammenfassung pro manuellem Lauf.',
        category: 'feature',
        icon: '📧',
      },
      {
        title: 'Zentrale Google-Drive-Dokumentenablage',
        description:
          'Alle Dokumente landen im Drive EINES zentralen System-Kontos (einmalig in Einstellungen → Dokumente verbinden). Pro Kunde wird automatisch ein Ordner angelegt; Bilder und PDFs werden komprimiert (Ersparnis wird angezeigt).',
        category: 'feature',
        icon: '📁',
      },
      {
        title: 'Globale Dokumenten-Übersicht',
        description:
          'Neue Seite /dokumente: alle Dateien über alle Kontakte mit Statistiken (Anzahl, Speicher, Ersparnis), Suche und Direktlinks zu Google Drive.',
        category: 'feature',
        icon: '📄',
      },
      {
        title: 'Dialfire-Sync repariert',
        description:
          'Batch-Sync übergibt jetzt die Kampagnen-ID korrekt; Branche, Herkunft und weitere Felder kommen in Dialfire an; der Task kommt aus der jeweiligen Regel.',
        category: 'fix',
        icon: '📞',
      },
    ],
    breaking_changes: [],
    known_issues: [
      'Dialfire-Kampagnen sind in der Edge-Function hinterlegt (aktuell 2 Kampagnen) — neue Kampagnen erfordern ein Function-Update',
    ],
    next_release_date: '2026-07-07',
  },
  {
    version: '0.3.1',
    date: '2026-06-22',
    title: 'Tasks UX: Clickable Rows & Detail Page',
    summary: 'Vollständige Task-Verwaltung mit Detail-Seite, Status-Editing und verbesserter Navigation',
    features: [
      {
        title: 'Aufgaben-Detail-Seite',
        description:
          'Neue `/aufgaben/[id]` Seite zum Anzeigen, Bearbeiten und Löschen einzelner Aufgaben. Edit-Mode mit allen Feldern (Titel, Beschreibung, Fällig, Priorität, Status).',
        category: 'feature',
        icon: '📄',
      },
      {
        title: 'Status-Dropdown überall',
        description:
          'Status ist jetzt überall bearbeitbar: im Kontakt-Detail als Dropdown, in der Aufgabenliste als Dropdown. Änderungen werden sofort gespeichert.',
        category: 'improvement',
        icon: '⚡',
      },
      {
        title: 'Klickbare Zeilen (Links)',
        description:
          'Kontakte & Aufgaben sind jetzt klickbar: Ganz Zeile führt zur Detail-Seite. Kontakt-Name wird in Aufgaben-Liste angezeigt.',
        category: 'improvement',
        icon: '🔗',
      },
      {
        title: 'Aufgaben ohne Kontakt erstellen',
        description:
          'contact_id ist jetzt optional — Aufgaben können global erstellt werden (nicht nur pro Kontakt). Ideal für persönliche To-Dos.',
        category: 'improvement',
        icon: '✓',
      },
      {
        title: 'Kontakt-Info in Aufgaben',
        description:
          'In der Aufgabenliste wird der zugehörige Kontakt angezeigt (mit Link). In der Detail-Seite kann man zum Kontakt navigieren.',
        category: 'feature',
        icon: '👤',
      },
    ],
    breaking_changes: [],
    known_issues: [
      'User-Beziehung (assigned_user) noch nicht implementiert',
      'Opportunity-Beziehung noch nicht implementiert',
    ],
    next_release_date: '2026-07-05',
  },
  {
    version: '0.3.0',
    date: '2026-06-22',
    title: 'Activity Logging & Audit Trail',
    summary: 'Umfassendes Aktivitäts-Protokoll für alle Kontakt-Änderungen mit automatischem Audit Trail',
    features: [
      {
        title: 'Activity Logging System',
        description:
          'Alle Aktivitäten rund um einen Kontakt werden automatisch protokolliert: Anlage, Bearbeitung, Prozessfortschritt, Statusänderungen. Jede Aktivität zeigt Timestamp und Details.',
        category: 'feature',
        icon: '📝',
      },
      {
        title: 'Aktivitäten-Tab',
        description:
          'Neue "Aktivitäten" Sektion im Kontakt-Detail zeigt vollständige Chronik aller Änderungen mit Zeitstempel. Visuell als Timeline dargestellt.',
        category: 'feature',
        icon: '📋',
      },
      {
        title: 'Tasks & Aufgaben-Management',
        description:
          'Neue "Aufgaben" Tab im Kontakt-Detail. Aufgaben können erstellt, bearbeitet und als erledigt markiert werden. Fälligkeitsdatum, Priorität und Status-Tracking.',
        category: 'feature',
        icon: '✓',
      },
      {
        title: 'Opportunities entfernt',
        description:
          'Opportunities-Tab wurde aus der UI entfernt. Fokus liegt auf Kontakt-Management, Pipeline und Aufgaben.',
        category: 'improvement',
        icon: '🗑️',
      },
      {
        title: 'Audit Trail für Compliance',
        description:
          'Vollständige Aktivitätshistorie für Compliance und Nachverfolgung. Wer hat was wann gemacht — alles protokolliert.',
        category: 'security',
        icon: '🔐',
      },
    ],
    breaking_changes: [
      'Opportunities-Tab wurde aus der UI entfernt (Daten in DB bleiben erhalten)',
    ],
    known_issues: [
      'DELETE-Operation (Kontakt löschen) loggt noch nicht automatisch',
      'File-Upload-Logging noch nicht implementiert',
    ],
    next_release_date: '2026-07-01',
  },
  {
    version: '0.2.0',
    date: '2026-06-20',
    title: '12-Schritt-Vertriebsprozess & Process Stepper',
    summary: 'Neue 12-Schritt-Pipeline mit visuellen Meilensteinen für Vertriebsprozess-Management',
    features: [
      {
        title: '12-Schritt-Vertriebsprozess',
        description:
          'Konfigurierbare Vertriebspipeline mit 12 definierten Schritten (Lead kommt rein → Nachbereitung). Schritt-Labels sind umbenennbar via Einstellungen.',
        category: 'feature',
        icon: '🎯',
      },
      {
        title: 'Process Stepper (Detail-Seite)',
        description:
          'Neue "Prozess" Tab zeigt alle 12 Schritte mit visuellen Indikatoren: ✓ Erledigt (grün), ⊙ Aktuell (gelb), ○ Kommend (grau). Pro Schritt: Checkbox + Fälligkeitsdatum.',
        category: 'feature',
        icon: '📊',
      },
      {
        title: '"Nächster Schritt" Navigation',
        description:
          'Automatische Navigation durch die Pipeline. Ein Klick markiert aktuellen Schritt als erledigt und rückt zum nächsten vor. Status wird automatisch abgeleitet.',
        category: 'feature',
        icon: '➜',
      },
      {
        title: 'Kontaktlisten-Update',
        description:
          'Kontaktliste zeigt jetzt den aktuellen Schritt (nicht mehr nur 4er-Status) + 12er-Fortschrittsbalken statt 4er-Bar.',
        category: 'improvement',
        icon: '📋',
      },
      {
        title: 'Auto-Status-Ableitung',
        description:
          'Beim Fortschreiten wird der Kontakt-Status automatisch aktualisiert (Schritt 1-3 → Neu, 4-7 → Kontaktiert, 8-10 → Qualifiziert, 11-12 → Kunde).',
        category: 'improvement',
        icon: '⚙️',
      },
      {
        title: '"Quelle" Feld für Kontakte',
        description:
          'Neue "Quelle" Information für Kontakte (Manuell, CSV, Facebook, TikTok, Calendly, E-Mail). Anzeige in Kontaktliste + Detail-Seite + Edit-Modal.',
        category: 'feature',
        icon: '🏷️',
      },
      {
        title: 'Kontakt-Kopier-Funktion',
        description: 'Neue "Kopieren" Button in Kontaktliste. Erstellt Duplikat mit " (Kopie)" Suffix im Namen.',
        category: 'feature',
        icon: '📋',
      },
      {
        title: 'Dashboard API Migration',
        description: 'Dashboard nutzt jetzt zentrale /api/kontakte API statt separater /api/leads. Einheitliche Datenverwaltung für alle Ventures.',
        category: 'improvement',
        icon: '🔄',
      },
    ],
    breaking_changes: [
      'Status-Dropdown in Kontakt-Edit-Modal entfernt (Status wird jetzt automatisch vom Prozessschritt abgeleitet)',
    ],
    known_issues: ['Notizen-Feld wird beim ersten Anlegen noch nicht korrekt angezeigt'],
  },
  {
    version: '0.1.0',
    date: '2026-06-01',
    title: 'Initial Launch',
    summary: 'Sentinel Logic MVP: Kontaktverwaltung, Aufgaben, Opportunities, CSV-Import',
    features: [
      {
        title: 'Zentrale Kontaktverwaltung',
        description:
          'Vollständige CRUD für Kontakte mit 16 bearbeitbaren Feldern (Name, Email, Telefone, Firma, Position, Adresse, Notizen, Quelle).',
        category: 'feature',
        icon: '👤',
      },
      {
        title: 'Aufgaben & Opportunities',
        description: 'Task & Opportunity Management mit Status-Tracking, Prioritäten, Fälligkeitsdaten und Verantwortlichenzuweisung.',
        category: 'feature',
        icon: '✓',
      },
      {
        title: 'CSV-Import mit Duplikat-Erkennung',
        description: 'Batch-Import von Kontakten aus CSV. Automatische Duplikat-Erkennung basierend auf Email + Name Kombination.',
        category: 'feature',
        icon: '📤',
      },
      {
        title: 'Aktivitäts-Timeline',
        description: 'Alle Änderungen werden automatisch geloggt (Erstellen, Status-Änderung, Notizen-Edits, etc.)',
        category: 'feature',
        icon: '📝',
      },
      {
        title: 'Kontakt-Detail-Seite',
        description:
          '6-Tab Detail-Ansicht: Übersicht (mit Notizen, Adresse, Metadata) + Aktivitäten + Aufgaben + Opportunities + Dokumente (Placeholder).',
        category: 'feature',
        icon: '📖',
      },
      {
        title: '4-Schritt-Kontakt-Pipeline',
        description: 'Einfache Pipeline mit 4 Status: Neu → Kontaktiert → Qualifiziert → Kunde.',
        category: 'feature',
        icon: '🔄',
      },
    ],
  },
]

export function getLatestRelease(): ReleaseNote | null {
  return RELEASE_NOTES.length > 0 ? RELEASE_NOTES[0] : null
}

export function getReleaseByVersion(version: string): ReleaseNote | null {
  return RELEASE_NOTES.find(r => r.version === version) || null
}

export function getUnreadVersions(readVersions: string[]): ReleaseNote[] {
  return RELEASE_NOTES.filter(r => !readVersions.includes(r.version))
}
