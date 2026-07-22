# Sentinel Logic — CLAUDE.md

> Zentrale Dokumentation für das Sentinel Logic Projekt.
> Einzelne Source of Truth für Architecture, Features und Development.

---

## Was ist Sentinel Logic?

Ein CRM + Vertriebssystem für Versicherungsmakler und B2B-Vertriebsteams.
Fokus: Lead-Management, 12-Schritt-Pipeline, Aktivitäts-Tracking und automatisierte Workflows.

---

## Tech-Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 14 + TypeScript | React-basiert, App Router |
| **Styling** | Tailwind CSS | Utility-first CSS |
| **Database** | Supabase PostgreSQL | pgvector-ready, RLS-capable |
| **Auth** | Supabase Auth (`@supabase/ssr`) | Session-based Login, Middleware-Zugriffsschutz, Rollen admin/mitarbeiter |
| **Hosting** | Vercel | Auto-deploy on `git push main` |
| **Email** | Resend API | Transaktional (Domain: guen-versicherung.de, verifiziert) |
| **Document Storage** | Google Drive OAuth | Zentrale System-Ablage + Kompression |
| **CRM Sync** | Dialfire API + KlickTipp API | Lead-Routing, Task-Erstellung, Tagging |
| **Automation** | Supabase Edge Functions | Trigger-basierte Workflows |
| **KI-Extraktion** | Claude API (claude-opus-4-8) | KI Upload: Dokument-Analyse (PDF/Vision, Structured Outputs) |
| **Version** | 0.8.0 — Mitarbeiterdashboard, eigene E-Mail-Domain, Cc/Bcc & Anhänge | Aktiv in Entwicklung |

---

## Supabase Schema (aktuell)

### Core Tables

| Table | Purpose | Key Columns |
|-------|---------|------------|
| `contacts` | Kontakt-Stammdaten | id, first_name, last_name, email, source, status, pipeline_stage, archived_at, dialfire_campaign_id, dialfire_task_name_field, dialfire_id, klicktipp_id, automation_disabled |
| `activities` | Aktivitäts-Audit-Trail | id, contact_id, type, description, data, created_at |
| `tasks` | Aufgaben pro Kontakt | id, contact_id, title, status, priority, due_date, archived_at |
| `rules` | Automation Rules | id, name, active, condition_source, actions (JSON), runs |
| `users` | Teambenutzer | id, email, name, active |
| `dokumente_metadata` | Google Drive Dokumente-Index | id, contact_id, file_name, file_size, compressed_size, compression_ratio, google_drive_file_id, uploaded_at |
| `google_drive_system_token` | OAuth System-Token (Single-Row) | id, access_token, refresh_token, expires_at, connected_email, root_folder_id |
| `drive_ordner_map` | Drive-IDs der Kategorie-Unterordner pro Kontakt (für Rename-Propagation) | kontakt_id, pfad, drive_folder_id |
| `tags` | Interne, frei vergebbare Kontakt-Tags (v0.6.0) | id, name, created_at, updated_at |
| `contact_tag_map` | Zuordnung Kontakt ↔ Tag, n:m (v0.6.0) | id, contact_id, tag_id, created_at |

### Supporting Tables

| Table | Purpose |
|-------|---------|
| `opportunities` | Removed from UI (v0.3.0) |
| `pipeline_stages` | Konfigurierbare 12-Schritt-Pipeline |
| `sync_log` | Sync-History für Lead-Import |

---

## Feature-Status (v0.7.0)

### ✅ Implemented (v0.7.0)

| Feature | Status | Notes |
|---------|--------|-------|
| **Benutzerkonten & Login** | ✅ Done | Supabase Auth (`@supabase/ssr`), `middleware.ts` schützt alle Seiten/APIs außer Login + Webhooks; `public.users.role` als freies Textfeld (nicht Enum) für spätere zusätzliche Rollen; zentrale `isAdmin()`-Prüfung als Basis für spätere granulare Rechtevergabe |
| **Team-Verwaltung (admin-only)** | ✅ Done | `/einstellungen/team`: Mitarbeiter anlegen (Temp-Passwort, kein E-Mail-Versand nötig), Rolle ändern, aktivieren/deaktivieren, Passwort zurücksetzen, löschen |
| **Self-Service-Profil** | ✅ Done | `/profil`: eigenen Namen/E-Mail ändern, eigenes Passwort ändern (mit Verifikation des aktuellen Passworts) — ergänzt den Admin-Passwort-Reset, ersetzt ihn nicht |
| **Kontakt-Verwaltung** | ✅ Done | CRUD, Duplikat-Prüfung, Automation-Integration |
| **Kontakte archivieren** | ✅ Done | Ersetzt Hard-Delete; Bestätigung inkl. Option „Aufgaben mitarchivieren"; Wiederherstellen-Funktion; Liste blendet Archivierte standardmäßig aus (Toggle „Archivierte anzeigen"); echtes Löschen nur noch via direktem Supabase-Zugriff (Tests/Admin) |
| **Interne Tags** | ✅ Done | Eigene `tags`/`contact_tag_map`-Tabellen; Freitext-Input mit Autocomplete; Mehrfach-Filter (UND-Verknüpfung) in der Liste; über NL→SQL-Reporting abfragbar |
| **Kontakte exportieren** | ✅ Done | CSV (alle Spalten), Excel (exceljs) und PDF (Querformat, `@react-pdf/renderer`) — respektiert alle aktiven Listen-Filter |
| **Kontakte importieren (erweitert)** | ✅ Done | Import-Button auch auf `/kontakte` (nicht nur Dashboard); gemeinsame `KontaktImportModal`-Komponente; ~65 statt 16 mappbare Felder |
| **Testdashboard & Regressionstests** | ✅ Done | `/testdashboard`; Playwright E2E gegen Produktion nach jedem Deploy (GitHub Actions); sichere, technisch markierte Testdaten mit automatischer Bereinigung |
| **12-Schritt-Pipeline** | ✅ Done | Stepper, Auto-Status, Fälligkeitsdaten |
| **Activity Logging** | ✅ Done | Alle Kontakt-Änderungen protokolliert + Automation-Events |
| **Aufgaben-Management** | ✅ Done | Tasks mit Status, Priorität, Fälligkeitsdatum |
| **Aktivitäten-Tab** | ✅ Done | Chronologische Timeline mit Automation-Events |
| **Release Notes** | ✅ Done | In-App Release-History mit Banners |
| **Automation Rules** | ✅ Done | Trigger auf source (Facebook, Calendly, CSV, Email, Manuell); Auto-Feld-Befüllung (Dialfire Campaign/Task, KlickTipp Tags); Manuelle Batch-Ausführung |
| **Automation Engine** | ✅ Done | Läuft automatisch bei Kontakt-Erstellung; matched Regel → setzt Felder → triggt Sync |
| **KlickTipp Sync** | ✅ Done | Auto-Sync bei Kontakt-Erstellung mit Tag "Sentinel"; Activity Logging |
| **Dialfire Sync** | ✅ Done | Create-Pfad + Batch-Pfad; Edge Function mit per-Rule Task-Name; Payload: Alle Felder (Adresse, Industrie, Mitarbeiterzahl, etc.) |
| **Google Drive Dokumentenablage** | ✅ Done | Zentrale System-Ablage (nicht per-User); OAuth mit Auto-Refresh; Kompression (sharp für Bilder/75%, gzip Docs); Statistik-Tracking; Globales `/dokumente` + Kontakt-Tabs; bei Refresh-Token-Fehlern automatischer Admin-Alarm per Mail (Cooldown 6h, `src/lib/drive-token-alert.ts`) statt stillem Fehlschlag beim nächsten Mitarbeiter-Upload |
| **E-Mail-Benachrichtigungen** | ✅ Done | Resend API; Auto-Pfad (pro Kontakt) + Manuell-Pfad (Summary pro Lauf); Versendet wenn send_notification=true in Regel |
| **Kontakt-E-Mail (manuell)** | ✅ Done | `ContactEmailModal` + `POST /api/kontakte/[id]/email`: freier Compose mit optionalem Cc/Bcc (mehrere Adressen, Komma-getrennt) und Datei-Anhängen (Resend-Limit 35MB); Anhänge werden zusätzlich automatisch als Dokument (Kategorie „Sonstiges", `created_by=email`) beim Kontakt abgelegt — Ablage-Fehler blockieren den Versand nicht |
| **Regeln-Management** | ✅ Done | `/regeln` Page: Anlegen, Bearbeiten, Löschen, Manuelle Ausführung, Counter (runs), Benachrichtigungen |
| **Dokumenten-Ordnerstruktur** | ✅ Done | Konfigurierbar je Kontakt-Typ (privat/gewerbe) in `/einstellungen/dokumente`; max. 2 Ebenen; Rename propagiert auf bestehende Drive-Ordner (drive_ordner_map); Kategorie-Dropdown + Filter beim Upload |
| **KI Upload** | ✅ Done | `/ki-upload`: Versicherungsdokument (PDF/Foto, auch gescannt) → Claude-Analyse (claude-opus-4-8, Vision + Structured Outputs) → Prüfmaske → Kontakt (Quelle ki_upload, E-Mail optional) + Drive-Ablage in passender Kategorie; Duplikat → anhängen; Vermittler wird nicht als Kontakt extrahiert |

## Konsolidierte Feature-Roadmap (Stand 2026-07-21)

Diese Roadmap ist unabhängig vom ursprünglichen Angebotsumfang und priorisiert alle aktuell bekannten Produktanforderungen. Bereits implementierte Grundlagen bleiben im Abschnitt `Feature-Status` dokumentiert.

**Prioritäten:** `Hoch` = als Nächstes bzw. phasenbestimmend, `Mittel` = nach den Kernabhängigkeiten, `Niedrig` = bewusst zurückgestellt.

### Phase A — Stabiler CRM-Kern, einheitliche Automatisierung und Telefonie

**Ziel:** Den bestehenden CRM-Kern produktiv stabilisieren, Placetel vollständig abnehmen und Automation/Synchronisation zu einem einheitlich steuerbaren System zusammenführen.

| Feature | Priorität | Stand | Nächster Schritt / Zielbild |
|---------|-----------|-------|-----------------------------|
| **Vollständiger Regressionstest** | Hoch | 🟡 Testsystem und E2E-Katalog vorhanden | Gesamtlauf ausführen, fachliche Restfehler dokumentieren und kritische Fehler schließen |
| **Placetel Click-to-Call** | Hoch | 🧪 MVP implementiert | Echten Pilotanruf mit Gesprächsdauer, Auflegegrund und Abschlussstatus erfolgreich abnehmen |
| **Placetel Notify-/Ergebnisverarbeitung** | Hoch | 🧪 HMAC, offizielle Statuswerte, Dauer und Gesprächsergebnis vorbereitet | Reale Provider-Callbacks prüfen, Fehlerfälle absichern und Automationsfolgen testen |
| **Automation + Synchronisation vereinheitlichen** | Hoch | 🟡 Mehrere getrennte Engines, Routen, Edge Functions und Logs vorhanden | Gemeinsame Ausführungsarchitektur für Events, manuelle Läufe und zeitgesteuerte Jobs schaffen |
| **Einheitliche Cron-/Scheduler-Logik** | Hoch | 🔴 Fehlt als gemeinsamer Baustein | Zentrale Jobdefinition, Sperren gegen Doppelläufe, Wiederholungen, Zeitfenster und Laufhistorie implementieren |
| **Einheitliches Log-Handling** | Hoch | 🟡 Activities, `sync_log` und anbieterspezifische Logs vorhanden | Einheitliches Lauf-/Eventmodell mit Korrelation zwischen Kontakt, Regel, Job und Integration schaffen |
| **Einheitliches Fehler- und Retry-Handling** | Hoch | 🟡 Fehlerbehandlung pro Integration vorhanden | Standardisierte Fehlerklassen, Retry-Strategie, Dead-Letter-Status und manuelle Wiederholung einführen |
| **Automation-/Sync-Control-Center UI** | Hoch | 🟡 Regeln- und Integrationsseiten teilweise vorhanden | Jobs, letzte Läufe, Fehler, Wiederholungen, Pausieren/Aktivieren und Health-Status zentral anzeigen |
| **Mitarbeiterdashboard** | Hoch | 🟢 `/dashboard` personalisiert: Heute im Fokus, Meine Kontakte, Letzte Aktivitäten, Meine Pipeline, Team-Umschalter für Admins | Stabil halten; ggf. „Abschlussquote" um echten 30-Tage-Zeitverlauf ergänzen sobald historische Snapshots existieren |
| **Facebook Lead-Import produktiv abnehmen** | Mittel | 🟢 Webhook und manueller Sync implementiert | Echten Lead-End-to-End-Lauf inklusive Dubletten, Automation und Downstream-Sync durchführen |
| **KlickTipp-Synchronisation vervollständigen** | Mittel | 🟢 Kontakt-/Tag-Sync vorhanden | Statusänderung → Tag-Rücksynchronisation und Fehlerwiederholung vereinheitlichen |
| **Gewerbedaten-Recherche** | Mittel | 🔴 Nur Datenmodell/Mock-Bausteine vorhanden | Zulässige Datenquellen und einen realistischen Recherche-MVP festlegen |
| **KI-Gesprächsvorbereitung** | Mittel | 🔴 Bisher nur statischer Alt-Platzhalter | Echten KI-Endpunkt, strukturierte Ausgabe und manuelle Prüfung implementieren |
| **Dialfire-Synchronisation** | Niedrig | 🟢 Create-/Pull-Pfade vorhanden | Nur stabil halten; kein größerer Ausbau, wenn Placetel den operativen Bedarf ersetzt |
| **Dialfire-Kampagnenflexibilität** | Niedrig | 🟡 Teilweise konfigurierbar | Nur noch notwendige Hardcodierungen entfernen; keine neue Fachlogik priorisieren |
| **Granulare Rechte pro Benutzer** | Niedrig | 🟡 Rollenarchitektur vorbereitet | Erst nach Stabilisierung der Kernprozesse eine Berechtigungsmatrix definieren |
| **TikTok Lead-Import** | Niedrig | 🔴 Nur als Kontaktquelle vorhanden | Erst nach Facebook-Abnahme und konkretem Kampagnenbedarf anbinden |
| **Google-/YouTube-Lead-Import** | Niedrig | 🔴 Nicht implementiert | Konkrete Google-Leadquelle und Zugriff vor einer Umsetzung klären |

### Phase B — AmisNow, Angebote und minimale Kundenkommunikation

**Ziel:** Den operativen Verkaufsprozess mit AmisNow verbinden, das Angebotshandling fachlich entscheiden und eine kleine eigene Kommunikationslösung für die wichtigsten Abläufe bereitstellen.

| Feature | Priorität | Stand | Nächster Schritt / Zielbild |
|---------|-----------|-------|-----------------------------|
| **AmisNow-Personenanlage** | Hoch | 🧪 Browser-MVP vorhanden | Stabilen End-to-End-Pilot mit freigegebenen Testdaten, Jobstatus und Fehlerbehandlung abschließen |
| **AmisNow-Angebotsberechnung** | Hoch | 🧪 Agent-Job vorbereitet | Reale Berechnung abnehmen und Angebotsnummer, Beitrag und Fehlerstatus verlässlich zurückschreiben |
| **AmisNow-Jobsteuerung** | Hoch | 🟡 Job-/Result-Grundlagen vorhanden | Warteschlange, Wiederholung, Timeout, manuelle Freigabe und Monitoring produktionsfest machen |
| **Entscheidung Angebotshandling** | Hoch | ⚪ Offen | Fachlich entscheiden, wie Opportunity, Angebot, Angebotsversion, Dokument und Vertrag zusammenhängen |
| **Angebotsverwaltung/-Tracking** | Mittel | 🟡 Opportunities und Dokumente als Grundlagen vorhanden | Erst nach Produktentscheidung ein eindeutiges Datenmodell und Statussystem implementieren |
| **Angebotsupload und Versionen** | Mittel | 🔴 Kein strukturiertes Angebot vorhanden | Dokumentreferenz, Versicherer, Tarif, Version, Gültigkeit und Nachfassdatum modellieren |
| **Angebotsversand** | Mittel | 🔴 Kein durchgängiger Angebotsworkflow | Versand zunächst per E-Mail mit Vorlage, Protokoll und manueller Freigabe umsetzen |
| **Automatische Angebots-Follow-ups** | Mittel | 🔴 Aufgabenbasis vorhanden | Nach Scheduler-Grundlage automatisch Aufgabe/Erinnerung aus Angebotsstatus und Frist erzeugen |
| **Angebotsannahme → Vertrag** | Mittel | 🔴 Kein durchgängiger Übergang | Angenommenes Angebot kontrolliert in einen Vertrag überführen |
| **Vertragsverwaltung** | Mittel | 🟡 KI-erzeugte Verträge und Anzeige vorhanden | Manuelles CRUD, Status, Dokumentbezug und Vertragslebenszyklus ergänzen |
| **E-Mail-Vorlagen** | Hoch | 🟡 Freier E-Mail-Editor inkl. Cc/Bcc + Anhänge vorhanden, Vorlagen fehlen | Vorlagenverwaltung mit Platzhaltern, Vorschau und manueller Freigabe bauen |
| **Vorlagen: Datenanfrage, Kündigung, Termin** | Hoch | 🔴 Fehlen | Fachtexte und erlaubte Kontakt-/Vertragsplatzhalter definieren und integrieren |
| **Eigene minimale Kommunikationslösung** | Hoch | 🔴 Nur ausgehende E-Mail und WhatsApp-Link vorhanden | Schlanken Nachrichten-/Aktivitätsfluss für die wichtigsten Kontaktfälle bauen; keine vollständige Omnichannel-Inbox voraussetzen |
| **Terminbuchungs-Webhook → Aktivität/GF-Mail** | Mittel | 🔴 Echte Calendly-Integration fehlt | Nach Zugang Buchung empfangen, Kontakt zuordnen, protokollieren und GF benachrichtigen |
| **Externe Kalenderintegration** | Niedrig | 🟡 Interner Aufgabenkalender vorhanden | Nur bei belegtem Bedarf Google-/Outlook-Sync planen |
| **SuperChat-Integration/Ablösung** | Niedrig | 🔴 Nicht umgesetzt | Hinter die eigene Minimallösung stellen; später Integration, Migration oder vollständige Ablösung neu bewerten |
| **SuperChat-Datenmigration** | Niedrig | 🔴 Nicht umgesetzt | Erst nach strategischer SuperChat-Entscheidung betrachten |
| **Vollständiges E-Mail-Postfach / Unified Inbox** | Niedrig | 🔴 Nicht umgesetzt | Als separates Ausbauprojekt behandeln |
| **Kundenportal** | Niedrig | 🔴 Nicht umgesetzt | Nach der minimalen Kommunikation als eigenständiges MVP neu definieren |

### Phase C — Dokumente, Gemini-Umbau, zeitgesteuerte Prozesse und Reporting

**Ziel:** Die Dokumenten- und KI-Verarbeitung auf Gemini umstellen, wiederkehrende Prozesse auf der gemeinsamen Scheduler-Architektur aufbauen und echte Kennzahlen bereitstellen.

| Feature | Priorität | Stand | Nächster Schritt / Zielbild |
|---------|-----------|-------|-----------------------------|
| **KI-Upload: Claude → Gemini API** | Hoch | 🟢 Bestehender Flow nutzt Claude | Providerabstraktion einführen, Gemini-Analyse mit gleichwertigem strukturiertem Schema implementieren und per Regression vergleichen |
| **Gemini-Migration sicher abnehmen** | Hoch | 🔴 Noch nicht begonnen | PDF, Foto, Scan, Vermittler-Falle, Dublette, Vertragsdaten und Fehlerfälle gegen bestehenden Testkatalog prüfen |
| **Claude-Laufzeit nach Migration entfernen** | Mittel | 🟡 Aktuell produktiver Provider | Erst nach erfolgreicher Gemini-Abnahme Runtime-Aufrufe und nicht mehr benötigte Konfiguration entfernen |
| **KI-Upload → Folgeaufgabe** | Hoch | 🔴 Kontakt, Dokument und Vertrag vorhanden; Aufgabe fehlt | Dokumenttypabhängige, konfigurierbare Folgeaufgabe erzeugen |
| **Dokumentenablage** | — | 🟢 Google Drive, Kategorien und Kompression umgesetzt | Stabil halten und in neue Workflows einbinden |
| **HiDrive vs. Google Drive** | Mittel | ⚪ Google Drive umgesetzt, Zielentscheidung offen | Google Drive als dauerhafte Lösung bestätigen oder Migration separat planen |
| **KI-Dokumentensuche** | Mittel | 🔴 Embeddings/pgvector-Pipeline fehlt | Extraktion, Chunking, Berechtigungen, Embeddings und Suche implementieren |
| **Zeitbasierte Workflows** | Hoch | 🔴 Fachlogik fehlt | Auf der Phase-A-Scheduler-Logik wiederkehrende fachliche Jobs definieren |
| **Geburtstagsautomation** | Mittel | 🔴 Nicht implementiert | Empfänger, Vorlage, Freigabe, Opt-out und Doppelversandschutz definieren |
| **Jubiläumsautomation** | Mittel | 🔴 Nicht implementiert | Fachliches Jubiläumsdatum und Versandregeln klären |
| **Jährlicher Versicherungscheck** | Hoch | 🔴 Nicht implementiert | Vertragsbezogenen Prüftermin, Aufgabe und Kommunikationsvorlage umsetzen |
| **Vertragsablauf-/Nachfass-Erinnerungen** | Hoch | 🟡 Vertragsdaten und Aufgaben vorhanden | Vorlaufzeiten, Eskalation, Laufhistorie und Wiederholungsregeln ergänzen |
| **After-Sales-Prozess** | Mittel | 🟡 Pipeline-Schritt `Nachbereitung` vorhanden | Echten vertragsbezogenen statt rein linearen Kontaktprozess modellieren |
| **Echte Dashboard-KPIs** | Hoch | 🟡 Mehrere Werte teilweise statisch | Leads, Aufgaben, Angebote, Abschlüsse und Conversion aus echten Daten berechnen |
| **Reporting & Analytics** | Mittel | 🟡 NL→SQL und Grundansichten vorhanden | Berechtigungen, Angebots-/Vertrags-KPIs, Zeiträume und Exporte erweitern |
| **Erweiterte Filter auf allen Listen** | Mittel | 🟢 Kontakte/Aufgaben weit fortgeschritten | Verbleibende Listen funktional angleichen |

### Phase D — Erweiterter KI-Kern, Produktreife und langfristiger Ausbau

**Ziel:** Erst nach stabilen Kernprozessen erweiterte KI-Funktionen und optionale Produkt-/SaaS-Fähigkeiten umsetzen.

| Feature | Priorität | Stand | Nächster Schritt / Zielbild |
|---------|-----------|-------|-----------------------------|
| **Police ↔ AmisNow-Datenabgleich** | Hoch | 🔴 Nicht implementiert | Nach stabiler AmisNow-Anbindung Felder, Toleranzen und Prüfbericht definieren |
| **Abweichungs-/Deckungslückenerkennung** | Mittel | 🔴 Nicht implementiert | Fachregeln und nachvollziehbare Begründungen mit manueller Prüfung entwickeln |
| **Automatische Verkaufsargumente** | Mittel | 🔴 Nicht implementiert | Als Assistenzvorschlag mit Quellenbezug und Freigabe umsetzen |
| **Kündigungsschreiben vorbereiten** | Mittel | 🔴 Nicht implementiert | Beitragserhöhung/Ablauf erkennen und nur einen manuell freizugebenden Entwurf erzeugen |
| **Weitere KI-Agenten** | Niedrig | 🟡 AmisNow-Agent als erster MVP | Einsatzfelder einzeln priorisieren und jeweils mit eigener Abnahme planen |
| **SaaS-/Mandantenfähigkeit** | Niedrig | 🟡 Auth/Rollen vorhanden, Mandantenmodell fehlt | Organisationen, Datenisolation und mandantenbezogene Konfiguration als separates Ausbauprojekt planen |
| **Kundenportal-Ausbau** | Niedrig | 🔴 Nicht implementiert | Nur nach eigener Minimallösung und konkretem Portal-MVP priorisieren |
| **DSGVO-Auskunfts- und Löschprozess** | Niedrig / zuletzt | 🟡 Archivierung vorhanden, vollständiger Prozess fehlt | Ganz am Ende von Phase D Aufbewahrung, Export, Freigabe und endgültige Löschung definieren |

### Phasenübergreifend — iterativ einplanen

Diese Arbeiten sind keine einmaligen Abschlussblöcke. Sie werden in jeder Phase gemeinsam mit den jeweiligen Features geplant und abgeschlossen.

| Thema | Verbindliche Arbeitsweise |
|-------|--------------------------|
| **Systemdokumentation** | Architektur, Konfiguration, Datenmodell, Integrationen und Betriebsabläufe nach jeder wesentlichen Änderung aktualisieren |
| **Tests & QA** | Für jedes Feature Abnahmekriterien und passende API-/E2E-Regressionstests ergänzen; vollständigen Katalog regelmäßig ausführen |
| **Benutzerschulung** | Neue oder geänderte Arbeitsabläufe phasenweise demonstrieren, kurz dokumentieren und mit den betroffenen Benutzern testen |
| **Release Notes** | Jede produktive Funktionsänderung in den In-App Release Notes festhalten |
| **Monitoring und Datenschutz** | Logging, Datenminimierung, Berechtigungen und externe Datenweitergabe bei jedem Integrationsfeature mitprüfen |

### ❌ Removed

- Opportunities (aus UI entfernt, v0.3.0)
- Kontakte kopieren (unfertige Krücke ohne eigenen Endpoint, v0.6.0)

---

## API Routes

### Contacts

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/kontakte` | GET | Liste aller Kontakte (`includeArchived=true` um Archivierte einzuschließen, sonst standardmäßig ausgeblendet); liefert `tags` pro Kontakt |
| `/api/kontakte` | POST | Neuen Kontakt erstellen + Activity Log |
| `/api/kontakte/[id]` | GET | Kontakt mit Activities, Tasks, Tags laden |
| `/api/kontakte/[id]` | PATCH | Kontakt aktualisieren, Pipeline-Fortschritt + Activity Log |
| `/api/kontakte/[id]` | DELETE | **Archiviert** den Kontakt (Soft-Delete, `archived_at`); Body `{ archiveTasks?: boolean }`; echtes Löschen nur via direktem Supabase-Zugriff |
| `/api/kontakte/[id]/restore` | POST | Archivierten Kontakt wiederherstellen; Body `{ restoreTasks?: boolean }` |
| `/api/kontakte/[id]/tags` | PUT | Kompletten Tag-Satz eines Kontakts ersetzen; Body `{ tagIds: string[] }` |
| `/api/kontakte/[id]/email` | POST | E-Mail an Kontakt (Resend); FormData `to, cc?, bcc?, subject, body, attachments?[]`; Anhänge zusätzlich automatisch in Dokumente abgelegt |
| `/api/kontakte/export` | GET | Export als `?format=csv\|xlsx\|pdf`, respektiert dieselben Filter wie die Liste |
| `/api/kontakt-tags` | GET, POST | Tags auflisten (optional `?search=`) / anlegen (Create-or-Get, case-insensitiv) |
| `/api/kontakt-tags/[id]` | PATCH, DELETE | Tag umbenennen (propagiert überall) / löschen |

### Activities (Auto-Logged)

| Event | Logged | Details |
|-------|--------|---------|
| Kontakt erstellt | ✅ Yes | first_name, last_name |
| Pipeline-Schritt geändert | ✅ Yes | old/new stage, label |
| Status geändert | ✅ Yes | old/new status |
| Kontakt bearbeitet | ⏳ Ready | Fields changed |
| Kontakt archiviert | ✅ Yes | Contact name, tasksArchived |
| Kontakt wiederhergestellt | ✅ Yes | Contact name |
| Task erstellt | ⏳ Ready | Task title |
| Datei hochgeladen | ⏳ Ready | File name, category |

---

## UI Structure

### Main Pages

| Page | Path | Purpose |
|------|------|---------|
| Dashboard | `/` | Mitarbeiterdashboard: personalisierte KPIs, Heute im Fokus (überfällig/heute), Meine Kontakte, Letzte Aktivitäten, Meine Pipeline, Team-Umschalter (Admin), CSV-Import |
| Kontakte | `/kontakte` | Kontakt-Liste mit Prozess-Fortschritt, Import/Export, Tag-Filter, Archiv-Toggle |
| Kontakt-Detail | `/kontakte/[id]` | Tab-Interface (Übersicht, Prozess, Aktivitäten, Aufgaben, Dialfire, Dokumente, Verträge, Automation) + Tags-Leiste |
| Testdashboard | `/testdashboard` | Regressionstest-Übersicht, Testläufe, Umgebungsstatus (v0.6.0) |
| Release Notes | `/release-notes` | In-App Feature-History |

### Tabs im Kontakt-Detail

1. **Übersicht** — Kontaktdaten, Status (Archiviert-Badge statt Dropdown wenn archiviert), Quelle, Qualität
2. **Prozess** — 12-Schritt-Stepper mit Checkboxes & Fälligkeitsdaten
3. **Aktivitäten** — Audit-Trail aller Änderungen
4. **Aufgaben** — Task-Liste mit Status & Priorität
5. **Dialfire, Dokumente, Verträge, Automation** — siehe jeweilige Abschnitte
6. **Tags** (v0.6.0) — Persistente Leiste oberhalb der Tabs, Freitext-Input mit Autocomplete, Speichern bei jeder Änderung

---

## Activity Logging System

### Architecture

📄 `src/lib/activities-logger.ts` — Zentrale Logging-Funktionen

```typescript
export async function logContactCreated(contactId, contactName)
export async function logContactUpdated(contactId, contactName, changes)
export async function logContactDeleted(contactId, contactName)
export async function logPipelineStageChanged(contactId, contactName, oldStage, newStage, stageLabel)
export async function logPipelineStepCompleted(contactId, contactName, stepLabel, completedAt)
export async function logTaskCreated(contactId, contactName, taskTitle)
export async function logFileUploaded(contactId, contactName, fileName, category)
export async function logNoteUpdated(contactId, contactName)
export async function logStatusChanged(contactId, contactName, oldStatus, newStatus)
```

### Currently Logged (v0.3.0)

✅ Kontakt erstellt
✅ Pipeline-Schritt geändert
✅ Status geändert

### Ready to Integrate

⏳ Kontakt bearbeitet (detaillierte Änderungen)
⏳ Kontakt gelöscht
⏳ Task erstellt
⏳ Datei hochgeladen
⏳ Notiz aktualisiert

---

## Development Guidelines

### Do's

- ✅ Commit bei jeder Feature/Fix
- ✅ **Teste ALLE Funktionalitätserweiterungen** (UI/API/Automation) vor dem Push
  - Nutze `verify` Skill oder starte dev server: `npm run dev`
  - Verifiziere: Datenspeicherung, Edge Cases, Error Handling
  - Kein Push ohne Test ✓
- ✅ Update Release Notes
- ✅ Nutze Activity Logger in API Routes
- ✅ Respektiere 12-Schritt-Pipeline

### Don'ts

- ❌ Nicht ins founder-os Repo pushen!
- ❌ Hardcoded Status (nutze pipeline_stage → auto-Status)
- ❌ Breaking changes ohne Release Notes
- ❌ Activity Logging in Frontend (nur in API)

---

## Recent Changes

### v0.8.0 (2026-07-22) — Mitarbeiterdashboard, eigene E-Mail-Domain, Cc/Bcc & Anhänge

**Mitarbeiterdashboard (Roadmap Phase A):**
- ✅ `/dashboard` komplett personalisiert statt globaler KPIs mit Platzhalterwerten
- ✅ „Heute im Fokus": überfällige + heute fällige eigene Aufgaben gebündelt, Direkt-Erledigen per Checkbox
- ✅ „Meine Kontakte": nur zugewiesene Kontakte, nach Pipeline-Fortschritt sortiert (statt globaler „letzte 10")
- ✅ „Letzte Aktivitäten" und „Meine Pipeline" auf eigene Kontakte gescoped
- ✅ Team/Ich-Umschalter für Admins (gleiche Widgets ohne Verantwortlicher-Filter)
- ✅ Neue API: `assigned_user_id`-Filter für `GET /api/kontakte`, neue Route `GET /api/aktivitaeten`

**E-Mail-Infrastruktur:**
- ✅ Absenderdomain von geliehener `onlinefirst.eu` auf eigene, verifizierte `guen-versicherung.de` umgestellt (alle drei Versandpfade)
- ✅ Admin-Alarm bei fehlgeschlagenem Google-Drive-Token-Refresh (`src/lib/drive-token-alert.ts`, Cooldown 6h) — Mitarbeiter merken von einer kaputten Drive-Verbindung nichts mehr, Admins werden gezielt per Mail informiert

**Kontakt-E-Mail — Cc/Bcc & Anhänge:**
- ✅ `ContactEmailModal` + `POST /api/kontakte/[id]/email`: optionale Cc/Bcc-Empfänger (mehrere Adressen, Komma-getrennt), Datei-Anhänge (Resend-Limit 35MB)
- ✅ Anhänge werden zusätzlich automatisch als Dokument beim Kontakt abgelegt (Kategorie „Sonstiges", `created_by=email`); Ablage-Fehler blockieren den Versand nicht
- 🐛 Zwei Bugfixes am Anhang-Datei-Input, beide nur in der Produktions-Build reproduzierbar (nicht im Dev-Server): (1) `e.target.value = ''`-Reset direkt nach dem Auslesen der FileList verhinderte zuverlässig, dass die Datei in den State kam; (2) `<input>` war innerhalb des `<label>` verschachtelt statt als Geschwister-Element über `id`/`htmlFor` verbunden (Muster von `KontaktDokumenteTab` übernommen, das nachweislich funktioniert)

### v0.6.0 (2026-07-20) — Kontakte: Archivieren, Tags, Export & erweiterter Import

**Archivieren statt Löschen:**
- ✅ Migration 0041: `contacts.archived_at`, `tasks.archived_at`
- ✅ `DELETE /api/kontakte/[id]` archiviert jetzt (Soft-Delete) statt zu löschen; optional inkl. verknüpfter Aufgaben (`archiveTasks`-Flag im Body)
- ✅ Neuer `POST /api/kontakte/[id]/restore` Endpoint (optional `restoreTasks`)
- ✅ Bestätigungs-Popups (Liste + Detail) mit Checkbox „Zugehörige Aufgaben ebenfalls archivieren"
- ✅ Kontakte-Liste blendet Archivierte standardmäßig aus; Toggle „Archivierte anzeigen"
- ✅ Status-Spalte/-Feld zeigt bei archivierten Kontakten überall „Archiviert" statt des (weiterhin intern gespeicherten) Business-Status — Liste (Desktop+Mobile), Detail-Header, Kontakt-Übersicht
- ✅ Echtes Löschen nur noch über direkten Supabase-Zugriff (Tests/Admin); bestehende Test-Bereinigung (`prepare_test_run`) läuft unverändert per SQL weiter

**Kopieren entfernt:**
- ✅ `handleCopyKontakt` + zugehörige Buttons vollständig zurückgebaut

**Import erweitert:**
- ✅ CSV-Import-Modal aus `dashboard/page.tsx` in eigene Komponente `KontaktImportModal.tsx` extrahiert, jetzt auch auf `/kontakte` nutzbar (Button neben „Neu")
- ✅ Mappbare Felder von 16 auf ~65 erweitert (gruppiert: Kontakt, Firma, Adresse, Klassifikation, Notizen, PKV, Gewerbe, Versicherung 1–5, Konfiguration)
- ✅ `public/leads-beispiel.csv` neu mit Feldern aus mehreren Gruppen (Adresse, Kontakt-Typ, Sparte, Notizen)
- ✅ Bugfix: `POST /api/kontakte` übernahm `sparte`, `qualität`, `bestandskunde`, `versicherungstyp`, `rechtsform`, `anrede`, `bemerkung`, `versicherungsgesellschaft`, `zahlweise`, `kontoinhaber`, `iban`, `inhaltssumme`, `beitrag_vorsorge`, `geburtstag_gf_inhaber`, `geschaeftsfuehrer_anzahl`, `seit_wann_gewerbe` bisher gar nicht beim Anlegen (wirkungslos sowohl über die Maske als auch beim Import) — jetzt ergänzt

**Export neu implementiert:**
- ✅ `GET /api/kontakte/export?format=csv|xlsx|pdf` — ein Endpoint für alle drei Formate, respektiert alle aktiven Listen-Filter (Status, Suche, Quelle, Typ, Pipeline-Stufe, Sparte, Prüfgrund, Tags, Archiviert-Sichtbarkeit)
- ✅ CSV: alle Spalten inkl. Tags. Excel (`exceljs`): kuratiertes Spaltenset, formatierte Kopfzeile. PDF (`@react-pdf/renderer`): A4 Querformat, dunkle Kopfzeile, Filter-Zusammenfassung
- ⚠️ `xlsx` (SheetJS) bewusst nicht verwendet — ungepatchte High-Severity-CVEs (Prototype Pollution, ReDoS) ohne Fix auf npm

**Interne Tags:**
- ✅ Neue Tabellen `tags`/`contact_tag_map` (Migration 0041); `/api/kontakt-tags` (GET/POST, Create-or-Get case-insensitiv), `/api/kontakt-tags/[id]` (PATCH/DELETE)
- ✅ `TagInput`-Komponente (Pills + Freitext + Autocomplete) in `KontaktEditModal` und Kontakt-Detailseite
- ✅ Mehrfach-Tag-Filter (UND-Verknüpfung) in der Kontakte-Liste
- ✅ `report-schema.ts` um `tags`/`contact_tag_map` + `archived_at` ergänzt, damit das NL→SQL-Reporting-Tool Tag-Fragen beantworten kann

**Testdashboard & Regressionstests:**
- ✅ `/testdashboard`, `tests/e2e/` (Playwright), `.github/workflows/regression-tests.yml` — läuft automatisch nach jedem erfolgreichen Deploy gegen Produktion
- ✅ Test-Kontakte technisch markiert (`[TEST]`/`[TESTDATEN]`/`pw+<run-id>@example.invalid`), automatische Bereinigung vor jedem Lauf
- ✅ 5 neue Specs: Archivieren+Wiederherstellen, Kopieren-Regression, Import mit erweitertem Feld, Export (CSV-Inhalt + Excel/PDF-Smoke-Test), Tags (anlegen/zuweisen/filtern/umbenennen)

### v0.5.0 (2026-07-07) — KI Upload & Intelligente Dokumentenablage

**KI Upload (`/ki-upload`):**
- ✅ `lib/ki-upload.ts`: claude-opus-4-8 mit nativem PDF/Vision-Input + Structured Outputs (json_schema)
- ✅ Prompt-Regeln: Versicherungsnehmer ≠ Vermittler/Makler; Hauptperson bei Mehrpersonen-Dokumenten; Kategorie nur aus konfigurierter Struktur (Fallback Sonstiges); kontakt_typ-Ableitung (GmbH → gewerbe)
- ✅ analyze-Route: Extraktion + Duplikat-Kandidat (E-Mail > Name > Firma)
- ✅ commit-Route orchestriert bestehende Routen (POST /api/kontakte + /dokumente) — Automation, KlickTipp, Dialfire laufen mit; Duplikat → Dokument anhängen
- ✅ Prüfmaske: alle Felder editierbar vor Übernahme; Quelle `ki_upload` (auch als Regel-Trigger)
- ✅ E-Mail bei Kontakten optional (Migration 0024); Vertragsnummer/Beitrag/Laufzeit/weitere Personen → Notizen
- ✅ E2E verifiziert mit 7 Test-PDFs inkl. gescanntem 11-Seiter (Vision) und Vermittler-Falle

**Dokumenten-Ordnerstruktur:**
- ✅ `contacts.kontakt_typ` (privat|gewerbe, Default gewerbe) — Toggle im Modal, Select in Übersicht
- ✅ Struktur-Editor in `/einstellungen/dokumente` je Typ (max. 2 Ebenen, „Sonstiges" fix)
- ✅ Lazy Drive-Unterordner beim Upload; `drive_ordner_map` persistiert IDs
- ✅ Rename propagiert auf alle bestehenden Drive-Ordner des Typs + Metadaten
- ✅ Kategorie-Dropdown beim Upload, Badge + Filter in Dokumentenlisten (Migration 0023)

**Fixes/Security:**
- ✅ PATCH-Whitelist um Versicherungsfelder ergänzt (Übersicht speicherte sie still nicht)
- ✅ `.env.local.bak`/`.env.dialfire` aus Git-Tracking entfernt (Werte in Historie → Rotation empfohlen)

### v0.4.0 (2026-07-05) — Automation, Integrations & Document Management

**Automation Engine & Rules:**
- ✅ `automation-engine.ts` implementiert; läuft automatisch bei Kontakt-Erstellung
- ✅ Regelunterschiede (condition_source) und automatische Feld-Befüllung
- ✅ Manuelle Batch-Ausführung via `/api/rules/[id]/apply-batch`; Counter inkrementiert auch bei 0 Kontakten
- ✅ `/regeln` Seite: Anlegen, Bearbeiten, Löschen, Manuell-Button, Benachrichtigungen
- ✅ Activity Logging für Automation-Events (automation_executed, automation_skipped, notification_sent/failed)

**E-Mail-Benachrichtigungen:**
- ✅ `rule-notifications.ts` Lib (Resend API)
- ✅ Auto-Pfad: Eine Mail pro Kontakt wenn Regel matcht
- ✅ Manuell-Pfad: Eine Summary-Mail pro Batch-Lauf (kein Spam)
- ✅ Versendet von noreply@onlinefirst.eu (Domain verifiziert)

**Dialfire Sync — Bug Fixes:**
- ✅ Fehlende `dialfire_campaign_id` in Batch-Payload gefixt
- ✅ Fehlende Felder hinzugefügt: `industry`, `source`, `mitarbeitanzahl`, `jahresumsatz`
- ✅ Per-Regel Task-Name (contact.dialfire_task_name_field) hat Priorität über Kampagnen-Default
- ✅ Edge-Function aktualisiert: Payload-Struktur standardisiert

**Google Drive Dokumentenablage:**
- ✅ Zentrale System-Token-Ablage (nicht per-User); `google_drive_system_token` Single-Row-Tabelle
- ✅ OAuth mit Auto-Refresh; Ablage unter "SentinelLogic Dokumente" Root-Ordner
- ✅ Kompression: sharp (Bilder/JPEG/PNG → 75% Qualität), gzip Level 9 (PDF/Docs); Fallback auf Original
- ✅ Statistik-Tracking: original_size, compressed_size, compression_ratio per Datei
- ✅ Global `/dokumente` Seite: Übersicht, Statistik-Kacheln, Suche, Drive-Link
- ✅ Kontakt-Tabs: Upload-UI mit Drag&Drop, Kompression-Metriken, Drive-Folder-Link pro Kontakt

**KlickTipp Sync:**
- ✅ Auto-Sync bei Kontakt-Erstellung mit "Sentinel" Tag
- ✅ Activity Logging (klicktipp_synced, klicktipp_sync_failed)

### v0.3.0 (2026-06-22) — Activity Logging Release

- ✅ Activity Logging System mit `src/lib/activities-logger.ts`
- ✅ `activities` & `tasks` Tabellen in Supabase
- ✅ Aktivitäten-Tab im Kontakt-Detail
- ✅ Aufgaben-Tab im Kontakt-Detail
- ✅ Opportunities aus UI entfernt

### v0.2.0 (2026-06-20) — Pipeline Release

- ✅ 12-Schritt-Pipeline
- ✅ Process Stepper UI
- ✅ Release Notes System

---

## Known Issues & Open Tasks

### High Priority (v0.4+)

- [ ] **Dialfire Kampagnen-Flexibilität:** Nur 2 IDs hartcodiert in Edge-Function (GENS85UE5SU4SSC7, SFU6DSEG4RU2Z6HX); sollte via system_config konfigurierbar sein
- [ ] **Auto/Manuell Toggles:** Kontakt-Detail braucht Pro-Feld Toggles (dialfire_campaign_auto, dialfire_task_auto, etc.)
- [ ] **Automation Settings UI:** `/einstellungen` neue Sektion für Kampagnen/Tasks/Tags config (Textareas → system_config)
- [ ] **Dialfire Test-Kontakt:** YWAY4QBKJVWG69PQ noch manuell in Dialfire UI löschen

### Medium Priority (v0.5+)

- [ ] Task-API Routes (vollständiges CRUD)
- [ ] User Authentication & Sessions
- [ ] Team Permissions & Rollen
- [ ] Advanced Search & Filtering
- [ ] Regression-Tests für Automation-Engine
- [ ] **`assigned_user_name` kaputt:** Feld in `ALLOWED_UPDATE_FIELDS` und im „Verantwortlicher"-Input von `KontaktEditModal` referenziert, Spalte existiert aber nicht in `contacts` — jedes Speichern mit gesetztem Wert schlägt mit 500 fehl (gefunden v0.6.0, noch nicht behoben)

---

## Commands

```bash
npm run dev          # Entwicklung
npm run build        # Production Build
git push origin main # Deploy zu Vercel
```

---

## Kritische Dateien (v0.4.0)

| Datei | Zweck |
|-------|-------|
| `src/lib/automation-engine.ts` | Automation-Logik: Regel-Matching, Feld-Befüllung, Sync-Trigger |
| `src/lib/rule-notifications.ts` | E-Mail-Benachrichtigungen via Resend (Auto + Batch) |
| `src/app/api/rules/[id]/apply-batch/route.ts` | Manuelle Batch-Ausführung + Zähler + Mail |
| `src/app/regeln/page.tsx` | UI für Regel-Verwaltung und manuelle Ausführung |
| `supabase/functions/send-to-dialfire/index.ts` | Edge-Function: Dialfire API Integration mit Kampagnen-Mapping |
| `src/lib/google-drive-oauth.ts` | Google Drive OAuth + Kompression + Folder-Struktur |
| `src/app/api/kontakte/[id]/dokumente/route.ts` | Document Upload + Kompression + Metadata-Speicherung |
| `src/app/einstellungen/dokumente/page.tsx` | OAuth-Connection UI |
| `src/app/dokumente/page.tsx` | Global Document Overview + Stats |
| `supabase/migrations/0022_google_drive_system_token.sql` | Google Drive System-Token Single-Row-Tabelle |
| `supabase/migrations/0041_kontakte_archive_and_tags.sql` | `contacts.archived_at`, `tasks.archived_at`, `tags`, `contact_tag_map` (v0.6.0) |
| `src/app/api/kontakte/export/route.ts` | Export-Endpoint (CSV/Excel/PDF) |
| `src/lib/kontakte-export-pdf.tsx` | PDF-Layout (`@react-pdf/renderer`) |
| `src/lib/kontakte-filters.ts` | Gemeinsame Filter-Prädikate für Liste + Export |
| `src/components/KontaktImportModal.tsx` | Gemeinsames Import-Modal (Dashboard + Kontakte) |
| `src/components/TagInput.tsx` | Freitext-Tag-Eingabe mit Autocomplete |
| `tests/e2e/` | Playwright-Regressionstests, Muster in `testdashboard.spec.ts` |

---

*Last Updated: 2026-07-22 — v0.8.0 Mitarbeiterdashboard, eigene E-Mail-Domain (guen-versicherung.de), Cc/Bcc & Anhänge im Kontakt-E-Mail-Versand, Google-Drive-Token-Admin-Alarm*
