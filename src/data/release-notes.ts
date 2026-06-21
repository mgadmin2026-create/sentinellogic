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
