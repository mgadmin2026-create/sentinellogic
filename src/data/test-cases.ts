export type TestPriority = 'Kritisch' | 'Hoch' | 'Mittel'
export type TestState = 'Geplant' | 'Bereit'

export interface TestCaseDefinition {
  id: string
  name: string
  description: string
  steps: string[]
  area: string
  priority: TestPriority
  state: TestState
  kind: string
  /** Exakte Playwright-Titel, über die historische Durchführungen zugeordnet werden. */
  resultTitles: string[]
}

export const TEST_CASES: TestCaseDefinition[] = [
  {
    id: 'E2E-001',
    name: 'Testdashboard und Testbetrieb anzeigen',
    description: 'Prüft, ob das Testdashboard erreichbar ist und die zentralen Informationen zu Testfällen, Durchführungen und sicherem Live-Testbetrieb anzeigt.',
    steps: [
      'Die Seite /testdashboard öffnen.',
      'Überschrift, Test-Kennzahlen und Testfallkatalog prüfen.',
      'Den Bereich „Durchführungen“ öffnen und die Einzeltestergebnisse des neuesten Laufs prüfen.',
      'Den Bereich „Testbetrieb“ öffnen und die Live-Sicherheitsregeln prüfen.',
    ],
    area: 'Qualitätssicherung',
    priority: 'Kritisch',
    state: 'Bereit',
    kind: 'E2E',
    resultTitles: ['zeigt Testfälle und den Live-sicheren Testbetrieb'],
  },
  {
    id: 'E2E-002',
    name: 'Lead anlegen und wiederfinden',
    description: 'Stellt sicher, dass ein neuer, eindeutig markierter Testkontakt vollständig gespeichert und anschließend über die Kontaktsuche gefunden wird.',
    steps: [
      'Die Kontaktübersicht öffnen und die Neuanlage starten.',
      'Eindeutig markierte Testdaten in die Pflichtfelder eintragen.',
      'Den Kontakt speichern und die Erfolgsmeldung prüfen.',
      'Nach Name und E-Mail suchen und die gespeicherten Werte vergleichen.',
    ],
    area: 'Kontakte',
    priority: 'Kritisch',
    state: 'Geplant',
    kind: 'E2E',
    resultTitles: [],
  },
  {
    id: 'E2E-003',
    name: 'Lead bearbeiten und Status ändern',
    description: 'Prüft, ob Stammdaten und Bearbeitungsstatus eines vorhandenen Testkontakts dauerhaft geändert werden können.',
    steps: [
      'Einen markierten Testkontakt anlegen.',
      'Die Detailansicht öffnen und Stammdaten bearbeiten.',
      'Den Kontaktstatus ändern und speichern.',
      'Die Seite neu laden und alle Änderungen erneut prüfen.',
    ],
    area: 'Kontakte',
    priority: 'Kritisch',
    state: 'Geplant',
    kind: 'E2E',
    resultTitles: [],
  },
  {
    id: 'E2E-004',
    name: 'Geschützte Seite ohne Anmeldung blockieren',
    description: 'Verifiziert, dass nicht angemeldete Besucher keine geschützten Kunden- oder Kontaktdaten aufrufen können.',
    steps: [
      'Eine neue Browsersitzung ohne Anmeldung starten.',
      'Eine geschützte Anwendungsseite direkt aufrufen.',
      'Weiterleitung zur Anmeldung oder eine Zugriffssperre prüfen.',
      'Sicherstellen, dass keine geschützten Inhalte sichtbar sind.',
    ],
    area: 'Berechtigungen',
    priority: 'Hoch',
    state: 'Geplant',
    kind: 'E2E',
    resultTitles: [],
  },
  {
    id: 'E2E-005',
    name: 'Fehlerfall einer Integration behandeln',
    description: 'Prüft, ob eine fehlgeschlagene externe Übertragung kontrolliert behandelt, verständlich protokolliert und ohne Datenverlust beendet wird.',
    steps: [
      'Einen markierten Testkontakt für den Integrationslauf vorbereiten.',
      'Einen definierten, ungefährlichen Integrationsfehler auslösen.',
      'Fehlermeldung und Aktivitätsprotokoll prüfen.',
      'Sicherstellen, dass der Kontakt erhalten bleibt und erneut verarbeitet werden kann.',
    ],
    area: 'Integrationen',
    priority: 'Hoch',
    state: 'Geplant',
    kind: 'E2E',
    resultTitles: [],
  },
  {
    id: 'E2E-006',
    name: 'Kontakt archivieren, Aufgabe mitarchivieren, wiederherstellen',
    description: 'Prüft den vollständigen Archivierungsablauf eines Kontakts einschließlich einer verknüpften Aufgabe und der anschließenden Wiederherstellung.',
    steps: [
      'Einen markierten Testkontakt und eine zugehörige Testaufgabe anlegen.',
      'Den Kontakt suchen und „Archivieren“ auswählen.',
      'Das Mitarchivieren der Aufgabe bestätigen.',
      'Prüfen, dass der Kontakt aus der Standardansicht verschwindet und in der Archivansicht erscheint.',
      'Kontakt und Aufgabe wiederherstellen und den gespeicherten Zustand prüfen.',
    ],
    area: 'Kontakte',
    priority: 'Kritisch',
    state: 'Bereit',
    kind: 'E2E',
    resultTitles: ['archiviert einen Kontakt inkl. Aufgabe und stellt ihn wieder her'],
  },
  {
    id: 'E2E-007',
    name: 'Kopieren-Button bleibt entfernt (Regression)',
    description: 'Sichert ab, dass die absichtlich entfernte Kopierfunktion nicht versehentlich wieder in der Kontaktliste erscheint.',
    steps: [
      'Die Kontaktübersicht öffnen.',
      'Die Aktionen eines sichtbaren Kontakts prüfen.',
      'Sicherstellen, dass kein Button mit der Funktion „Kopieren“ vorhanden ist.',
    ],
    area: 'Kontakte',
    priority: 'Mittel',
    state: 'Bereit',
    kind: 'E2E',
    resultTitles: ['zeigt keinen Kopieren-Button mehr in der Kontaktliste'],
  },
  {
    id: 'E2E-008',
    name: 'CSV-Import mit erweiterten Feldern über /kontakte',
    description: 'Prüft, ob eine CSV-Datei auf der Kontaktseite importiert wird und ein erweitertes Feld wie „Sparte“ dauerhaft im Kontakt gespeichert bleibt.',
    steps: [
      'Auf /kontakte den CSV-Import öffnen.',
      'Eine markierte Testdatei mit Vorname, Nachname, E-Mail, Firma und Sparte hochladen.',
      'Die automatische Zuordnung der Spalte „Sparte“ prüfen.',
      'Den Import ausführen und die Erfolgsmeldung kontrollieren.',
      'Den Kontakt erneut abrufen und den gespeicherten Wert „PKV“ prüfen.',
    ],
    area: 'Kontakte',
    priority: 'Hoch',
    state: 'Bereit',
    kind: 'E2E',
    resultTitles: ['Import-Button ist auf /kontakte sichtbar und übernimmt erweiterte Felder'],
  },
  {
    id: 'E2E-009',
    name: 'Export als CSV, Excel und PDF',
    description: 'Prüft, ob die aktuell gefilterten Kontakte in allen angebotenen Formaten als korrekt benannte Datei heruntergeladen werden können.',
    steps: [
      'Einen eindeutig markierten Testkontakt anlegen.',
      'Die Kontaktliste nach diesem Kontakt filtern.',
      'CSV exportieren und prüfen, ob die Datei die Test-E-Mail enthält.',
      'Excel exportieren und Dateiendung sowie Download prüfen.',
      'PDF exportieren und Dateiendung sowie Download prüfen.',
    ],
    area: 'Kontakte',
    priority: 'Hoch',
    state: 'Bereit',
    kind: 'E2E',
    resultTitles: [
      'CSV-Export enthält die gefilterten Kontaktdaten',
      'Excel- und PDF-Export liefern herunterladbare Dateien',
    ],
  },
  {
    id: 'E2E-010',
    name: 'Tag anlegen, zuweisen, filtern und umbenennen',
    description: 'Prüft den Lebenszyklus eines internen Tags von der Anlage über die Kontaktzuordnung und Filterung bis zur Umbenennung.',
    steps: [
      'Einen markierten Testkontakt öffnen und einen eindeutigen Test-Tag anlegen.',
      'Den Tag dem Kontakt zuweisen und die Persistenz nach einem Reload prüfen.',
      'In der Kontaktübersicht nach dem Tag filtern und den Kontakt prüfen.',
      'Den Tag umbenennen und die Änderung in der Kontaktansicht kontrollieren.',
      'Den Test-Tag abschließend wieder entfernen.',
    ],
    area: 'Kontakte',
    priority: 'Mittel',
    state: 'Bereit',
    kind: 'E2E',
    resultTitles: ['Tag anlegen, zuweisen, filtern und umbenennen'],
  },
]
