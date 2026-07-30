import type { HelpArticle } from '@/types/help'

export const kontaktDetailArticles: HelpArticle[] = [
  {
    id: 'kontakt-detail.overview',
    area: 'kontakt-detail',
    title: 'Kontaktdetail — Überblick',
    isPageDefault: true,
    route: '/kontakte',
    matchMode: 'prefix',
    keywords: ['kontaktseite', 'kundenkarte'],
    body:
      'Die Kontaktdetailseite ist die zentrale Arbeitsansicht für einen einzelnen Kontakt. Alles, was du für diesen Kontakt brauchst, findest du hier gebündelt:\n\n' +
      '- Kopfzeile: Name, Status, Kontaktdaten und die wichtigsten Aktionen (Anrufen, E-Mail, AMIS, Bearbeiten, Archivieren)\n' +
      '- Tags & Notizen direkt darunter\n' +
      '- Prozess-Stepper: wo der Kontakt gerade in der 12-Schritte-Pipeline steht\n' +
      '- Kacheln mit den Kerndaten (Kontakt, Unternehmen, Versicherung & Verträge, Dokumente, Telefonie & Sync)\n' +
      '- Rechts die Arbeits-Spalte: nächste Aufgabe, Aktivitäten-Verlauf, Kommentare\n\n' +
      'Jede Kachel zeigt nur den Überblick — auf "Bearbeiten" oder "→" klicken öffnet ein Seitenpanel mit allen Details bzw. der vollständigen Historie. Neben jeder Kachel-Überschrift findest du außerdem ein ❓-Symbol für Hilfe genau zu diesem Bereich.',
  },
  {
    id: 'kontakt-detail.kopfzeile',
    area: 'kontakt-detail',
    title: 'Kopfzeile & Aktionen',
    keywords: ['anrufen', 'placetel', 'amis', 'archivieren', 'e-mail senden'],
    body:
      'Die Kopfzeile zeigt Name, Archiviert-Badge (falls zutreffend), Status-Badge und eine Meta-Zeile mit Geburtstag/Alter, Firma, E-Mail-Adresse und dem Verantwortlichen.\n\n' +
      'Aktionen von links nach rechts:\n' +
      '- 📞 Anruf-Button: startet einen Placetel-Callback zur hinterlegten Nummer (Nummer steht direkt im Button)\n' +
      '- ✉️ E-Mail: öffnet den Compose-Dialog mit optionalem Cc/Bcc, Datei-Anhang und Vorlagen-Auswahl\n' +
      '- ⚡ AMIS: Person in AMIS.NOW anlegen bzw. Angebot berechnen lassen\n' +
      '- ℹ️ AMIS-Status: zeigt den letzten AMIS-Job-Status\n' +
      '- ✏️ Bearbeiten: öffnet das vollständige Bearbeiten-Panel mit allen Feldern\n' +
      '- 🗑️ Archivieren: Bestätigungsdialog, optional werden zugehörige Aufgaben mitarchiviert\n' +
      '- ⋯ Weitere Aktionen: direkter Telefonanruf (tel:) und WhatsApp-Chat',
  },
  {
    id: 'kontakt-detail.tags-notizen',
    area: 'kontakt-detail',
    title: 'Tags & Notizen',
    keywords: ['label', 'schlagwort', 'notiz'],
    body:
      'Direkt unter der Kopfzeile: Tags links, Notiz rechts.\n\n' +
      'Tags sind frei vergebbare Schlagwörter (z.B. "Premium", "Kunde") — Eingabe mit Enter bestätigen, per × wieder entfernen. Tags lassen sich in der Kontaktliste als Filter nutzen.\n\n' +
      'Die Notiz ist ein freies Textfeld mit automatischem Speichern (kurz nach dem Tippen, kein Speichern-Button nötig). Auf die gekürzte Vorschau klicken, um sie aufzuklappen und zu bearbeiten.',
  },
  {
    id: 'kontakt-detail.prozess-stepper',
    area: 'kontakt-detail',
    title: 'Vertriebsprozess (12 Schritte)',
    keywords: ['pipeline', 'stepper', 'schritt'],
    body:
      'Der Stepper zeigt die 12-Schritte-Pipeline von "Lead kommt rein" bis "Nachbereitung". Der aktuelle Schritt ist hervorgehoben, erledigte Schritte sind grün markiert.\n\n' +
      'Auf "Alle Schritte →" klicken öffnet ein Panel mit der vollständigen Ansicht: jeder Schritt lässt sich einzeln als erledigt markieren, mit einem Fälligkeitsdatum versehen, und "Nächster Schritt" springt automatisch zum darauffolgenden Schritt.',
  },
  {
    id: 'kontakt-detail.kontakt-kachel',
    area: 'kontakt-detail',
    title: 'Kachel „Kontakt"',
    keywords: ['mobil', 'adresse', 'büro', 'privat', 'gewerbe'],
    body:
      'Zeigt Mobilnummer, Büronummer, Adresse und den Kontakttyp (Privat oder Gewerbe).\n\n' +
      '"Bearbeiten" öffnet das vollständige Bearbeiten-Panel und springt direkt zu den Grunddaten — dort lassen sich auch Felder ändern, die auf der Kachel nicht angezeigt werden (z.B. Geschlecht, Geburtstag).',
  },
  {
    id: 'kontakt-detail.unternehmen-kachel',
    area: 'kontakt-detail',
    title: 'Kachel „Unternehmen"',
    keywords: ['firma', 'branche', 'rechtsform', 'mitarbeiterzahl', 'jahresumsatz', 'b2b'],
    body:
      'Nur relevant bei Gewerbekunden: Branche, Rechtsform, Mitarbeiterzahl und Jahresumsatz.\n\n' +
      'Bei Privatkunden bleiben diese Felder leer ("—") — das ist normal und kein Fehler.',
  },
  {
    id: 'kontakt-detail.versicherung-vertraege',
    area: 'kontakt-detail',
    title: 'Kachel „Versicherung & Verträge"',
    keywords: ['sparte', 'prüfgrund', 'vorversicherung', 'pkv', 'vertrag'],
    body:
      'Zeigt Sparte, Prüfgrund und die Vorversicherung sowie — falls vorhanden — bereits erfasste PKV-Verträge.\n\n' +
      '"Verträge →" öffnet die vollständige Vertragsverwaltung dieses Kontakts (strukturierte Vertragsdatensätze, nicht nur die Vorversicherung). "Bearbeiten" öffnet das Panel mit allen Versicherungsfeldern, inklusive aller fünf möglichen PKV-Vertragsslots.',
  },
  {
    id: 'kontakt-detail.beitragsuebersicht',
    area: 'kontakt-detail',
    title: 'Kachel „Beitragsübersicht"',
    keywords: ['sparten vergleich', 'ersparnis', 'mehrbeitrag', 'kfz-flotte', 'pdf', 'angebot'],
    body:
      'Sparten-Vergleich zwischen dem bisherigen Beitrag des Kunden und dem Allianz-Angebot — die digitale Version der bekannten Beitragsübersicht-Vorlage. Es gibt eine laufende Übersicht pro Kontakt: jedes Speichern überschreibt den bisherigen Stand, es wird nicht versioniert.\n\n' +
      '"Bearbeiten →" öffnet die Sparten-Tabelle mit Alt-/Neu-Beitrag, Beginn, Ablauf und Bemerkung pro Zeile — beim ersten Öffnen vorbelegt mit den üblichen Sparten für Privat- bzw. Gewerbekunden. Differenz, Summenzeile und die Ersparnis-/Mehrbeitrag-Box werden immer automatisch berechnet, nie händisch eingetragen.\n\n' +
      'Bei Gewerbekunden mit 4 oder mehr Fahrzeugen lässt sich zusätzlich das Flottenblatt aktivieren — dessen Summe fließt automatisch in die Sparten-Zeile „Kfz-Flotte / Firmenfahrzeuge" ein. Bei 1–3 Fahrzeugen einfach direkt in dieser Zeile eintragen.\n\n' +
      '"PDF herunterladen" erzeugt ein Dokument im Layout der bekannten Excel-Vorlage zum Ausdrucken oder für das Kundengespräch.',
  },
  {
    id: 'kontakt-detail.dokumente',
    area: 'kontakt-detail',
    title: 'Kachel „Dokumente"',
    keywords: ['upload', 'google drive', 'ablage', 'anhang'],
    body:
      '"Öffnen →" öffnet die Dokumentenverwaltung dieses Kontakts: Datei-Upload per Klick oder Drag & Drop, Kategorie-Auswahl, Vorschau, Download und Löschen.\n\n' +
      'Alle Dokumente werden automatisch in einem zentralen Google-Drive-Ordner abgelegt und beim Upload komprimiert (Bilder und PDFs). Anhänge aus E-Mails und Kommentaren landen ebenfalls automatisch hier.',
  },
  {
    id: 'kontakt-detail.telefonie-sync',
    area: 'kontakt-detail',
    title: 'Kachel „Telefonie & Sync"',
    keywords: ['placetel', 'dialfire', 'klicktipp', 'automation', 'integration'],
    body:
      'Vier Zeilen, jede öffnet ein eigenes Panel:\n\n' +
      '- Placetel-Anrufe: vollständige Anrufhistorie zu diesem Kontakt\n' +
      '- Dialfire: Synchronisations-Status und eingehende Antworten aus dem Dialfire-Callcenter, inkl. Anruf-Notizen\n' +
      '- Automation: zeigt, ob eine Automatisierungsregel für diesen Kontakt aktiv ist, und erlaubt manuelles Eingreifen\n' +
      '- KlickTipp & Integrations: schreibgeschützte Übersicht der externen IDs (Dialfire, KlickTipp) dieses Kontakts',
  },
  {
    id: 'kontakt-detail.erstgespraech',
    area: 'kontakt-detail',
    title: 'Kachel „Erstgespräch"',
    keywords: ['leitfaden', 'anruf', 'fragebogen', 'erstanruf', 'sparte', 'unternehmerschutz'],
    body:
      'Ein sparten-spezifischer Gesprächsleitfaden fürs erste Telefonat mit dem Kontakt — die Fragen orientieren sich an der hinterlegten Sparte (z.B. Unternehmerschutz).\n\n' +
      'Die Kachel selbst zeigt nur einen kurzen Hinweis, welche Sparte hinterlegt ist. "Bearbeiten" öffnet den vollständigen Leitfaden in einem Panel von rechts (wie bei Aufgaben/Dokumenten) — darin zuerst Vorname/Nachname/E-Mail/Telefon direkt editierbar, dann das Notizen-Feld, darunter die Fragen.\n\n' +
      'Jede Frage zeigt den vorgeschlagenen Gesprächseinstieg in Anführungszeichen, darunter die zugehörigen Felder direkt editierbar. Antworten werden lokal gesammelt und erst über "Antworten speichern" übernommen — es geht also kein Request pro Tastendruck raus. "↓ Zum Ende" / "↑ Zum Anfang" springen innerhalb des Panels.\n\n' +
      'Der letzte Punkt ist eine reine Bestätigungs-Anzeige (Firmenname/Telefon/E-Mail laut Datensatz), keine erneute Eingabe. Der Abschluss-Hinweis führt zu "+ Aufgabe: Folgetermin anlegen" — legt eine neue Aufgabe mit vorbelegtem Titel "Beratungstermin" an.\n\n' +
      'Ist für den Kontakt keine Sparte gesetzt oder existiert für die Sparte noch kein Leitfaden, zeigt die Kachel einen entsprechenden Hinweis statt eines Fehlers.',
  },
  {
    id: 'kontakt-detail.naechste-aufgabe',
    area: 'kontakt-detail',
    title: 'Kachel „Nächste Aufgabe"',
    keywords: ['aufgabe', 'fällig', 'überfällig', 'erledigt'],
    body:
      'Zeigt die am frühesten fällige offene Aufgabe zu diesem Kontakt, mit "Überfällig"-Badge falls das Fälligkeitsdatum bereits verstrichen ist.\n\n' +
      '"✓ Erledigt" markiert sie direkt als erledigt. "+ Neue Aufgabe" legt eine weitere Aufgabe für diesen Kontakt an. "Historie (n) →" öffnet die komplette Aufgabenliste dieses Kontakts mit Status-Filtern — ein Klick auf eine Zeile öffnet sie zum Bearbeiten, inklusive Kommentarverlauf.',
  },
  {
    id: 'kontakt-detail.aktivitaeten',
    area: 'kontakt-detail',
    title: 'Kontakthistorie',
    keywords: ['verlauf', 'protokoll', 'log', 'timeline', 'aktivitäten', 'fachlich', 'technisch'],
    body:
      'Die vollständige, chronologische Historie eines Kontakts — erreichbar über das ⋯-Menü oben im Kopfbereich (nicht mehr als eigene Kachel in der Übersicht).\n\n' +
      'Standardmäßig siehst du nur fachlich relevante Ereignisse: Kontakt angelegt, Status-/Pipeline-Änderungen, Aufgabe erstellt, Datei hochgeladen, Notiz, E-Mail gesendet.\n\n' +
      'Technische Einträge (Sync-Vorgänge mit Dialfire/KlickTipp/Superchat/Facebook, automatische Regelausführung, reine Feld-Updates) sind standardmäßig ausgeblendet, weil sie zahlenmäßig dominieren und den fachlichen Verlauf überdecken würden. Über "+ N technische Einträge anzeigen" lassen sie sich bei Bedarf einblenden — z.B. um einen Sync-Fehler nachzuvollziehen.',
  },
  {
    id: 'kontakt-detail.kommentare',
    area: 'kontakt-detail',
    title: 'Kachel „Kommentare"',
    keywords: ['erwähnung', 'mention', 'at', '@', 'team', 'anhang'],
    body:
      'Interne Kommentare zu diesem Kontakt — sichtbar für das gesamte Team, nicht nur für dich.\n\n' +
      'Mit @ ein Teammitglied erwähnen (z.B. @Max) benachrichtigt diese Person per E-Mail und zeigt es unter "Erwähnungen" an. Mit @Alle erreichst du das ganze Team auf einmal.\n\n' +
      'Über "📎 Datei anhängen" lässt sich eine Datei direkt an den Kommentar hängen — sie wird automatisch in den Dokumenten dieses Kontakts abgelegt.',
  },
]
