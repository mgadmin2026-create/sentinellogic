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
| **Version** | 0.13.0 — Lauf-Historie der Automatisierungsregeln | Aktiv in Entwicklung |

---

## Supabase Schema (aktuell)

### Core Tables

| Table | Purpose | Key Columns |
|-------|---------|------------|
| `contacts` | Kontakt-Stammdaten | id, first_name, last_name, email, source, status, pipeline_stage, archived_at, dialfire_campaign_id, dialfire_task_name_field, dialfire_id, klicktipp_id, automation_disabled, `beitragsuebersicht` (JSONB, v0.11.0) |
| `activities` | Aktivitäts-Audit-Trail | id, contact_id, type, description, data, created_at |
| `tasks` | Aufgaben pro Kontakt | id, contact_id, title, status, priority, due_date, archived_at |
| `rules` | Automation Rules | id, name, active, condition_source, actions (JSON), runs |
| `users` | Teambenutzer | id, email, name, active |
| `dokumente_metadata` | Google Drive Dokumente-Index | id, contact_id, file_name, file_size, compressed_size, compression_ratio, google_drive_file_id, uploaded_at |
| `google_drive_system_token` | OAuth System-Token (Single-Row) | id, access_token, refresh_token, expires_at, connected_email, root_folder_id |
| `drive_ordner_map` | Drive-IDs der Kategorie-Unterordner pro Kontakt (für Rename-Propagation) | kontakt_id, pfad, drive_folder_id |
| `tags` | Interne, frei vergebbare Kontakt-Tags (v0.6.0) | id, name, created_at, updated_at |
| `contact_tag_map` | Zuordnung Kontakt ↔ Tag, n:m (v0.6.0) | id, contact_id, tag_id, created_at |
| `mail_templates` | E-Mail-Vorlagen (v0.8.0) | id, name, subject, body |
| `comments` | Kommentare, polymorph über `entity_type`/`entity_id` (v0.9.0) | id, entity_type (`task`\|`contact`), entity_id, author_user_id, body, created_at |
| `comment_mentions` | @-Erwähnungen pro Kommentar; „Alle" wird beim Anlegen zu Einzel-Erwähnungen pro aktivem User aufgelöst (v0.9.0) | id, comment_id, mentioned_user_id, read_at |
| `comment_attachments` | Datei-Anhänge an Kommentaren, referenziert `dokumente_metadata` (v0.9.0) | id, comment_id, dokument_id, file_name, file_size |

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
| **Kontakt-E-Mail (manuell)** | ✅ Done | `ContactEmailModal` + `POST /api/kontakte/[id]/email`: freier Compose mit optionalem Cc/Bcc (mehrere Adressen, Komma-getrennt), Datei-Anhängen (Resend-Limit 35MB) und Vorlagen-Dropdown (Platzhalter-Ersetzung, bleibt frei editierbar); Anhänge werden zusätzlich automatisch als Dokument (Kategorie „Sonstiges", `created_by=email`) beim Kontakt abgelegt — Ablage-Fehler blockieren den Versand nicht |
| **Regeln-Management** | ✅ Done | `/regeln` Page: Anlegen, Bearbeiten, Löschen, Manuelle Ausführung, Counter (runs), Benachrichtigungen |
| **Dokumenten-Ordnerstruktur** | ✅ Done | Konfigurierbar je Kontakt-Typ (privat/gewerbe) in `/einstellungen/dokumente`; max. 2 Ebenen; Rename propagiert auf bestehende Drive-Ordner (drive_ordner_map); Kategorie-Dropdown + Filter beim Upload |
| **KI Upload** | ✅ Done | `/ki-upload`: Versicherungsdokument (PDF/Foto, auch gescannt) → Claude-Analyse (claude-opus-4-8, Vision + Structured Outputs) → Prüfmaske → Kontakt (Quelle ki_upload, E-Mail optional) + Drive-Ablage in passender Kategorie; Duplikat → anhängen; Vermittler wird nicht als Kontakt extrahiert |
| **Kommentare & @-Erwähnungen** | ✅ Done | Wiederverwendbare `CommentThread`-Komponente in Kontaktdetail-Kachel und Aufgaben-Bearbeiten-Modal; Einzel- und Gruppen-Erwähnung (`@Alle` → Einzel-Erwähnung pro aktivem User bei Erstellung), Datei-Anhang (nur wenn Kontakt auflösbar, sonst HTTP 400), E-Mail-Benachrichtigung pro Erwähnung, `/erwaehnungen`-Seite + Sidebar-Badge mit Ungelesen-Zähler |
| **Eingebaute Hilfe & Kundendokumentation** | ✅ Done | Rein statisches, im Code gepflegtes Hilfe-System (kein DB-Table, keine API-Route) — `~62` Artikel über `src/data/help/*.ts`. Kachel-genaue Hilfe per ❓-Symbol (`<HelpButton articleId="...">`, ~39 Einfügestellen) öffnet den passenden Artikel im globalen Drawer (`HelpProvider`); Taste `?` öffnet die Seiten-Standardhilfe (Prefix-Match für `/kontakte/[id]`, sonst Exact-Match), unterdrückt in Eingabefeldern und bei bereits offenem anderen Drawer/Modal; vollständiges durchsuchbares Handbuch unter `/hilfe` mit Bereichs-Gruppierung, Volltextsuche und Deep-Linking (`#<articleId>`, Scroll + Highlight) |
| **Beitragsübersicht (Sparten-Vergleich)** | ✅ Done | Digitale Version der Excel-Vorlage „Beitragsuebersicht_Vorlage_Allianz_Guen": eine laufende, unversionierte Übersicht pro Kontakt (`contacts.beitragsuebersicht` JSONB) mit Sparten-Tabelle (Alt-/Neu-Beitrag, Beginn, Ablauf, Bemerkung), automatisch berechneter Differenz/Summenzeile/Ersparnis-Box (nie persistiert, gemeinsames `beitragsuebersicht-calc.ts` für UI + PDF); beim ersten Öffnen mit den festen Privat-/Gewerbe-Sparten vorbelegt (`beitragsuebersicht-sparten.ts`), danach frei erweiterbar; Gewerbekunden mit 4+ Fahrzeugen können ein Flottenblatt aktivieren, dessen Summe automatisch in die Sparten-Zeile „Kfz-Flotte / Firmenfahrzeuge" einfließt (1–3 Fahrzeuge direkt in der Zeile); PDF-Export (`@react-pdf/renderer`) im Layout der Excel-Vorlage |

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
| **E-Mail-Vorlagen** | Hoch | 🟢 `/einstellungen/mail-vorlagen` (CRUD) + Vorlage-Dropdown in `ContactEmailModal` mit Platzhalter-Ersetzung, manuelle Freigabe (Vorlage befüllt nur, sendet nicht automatisch) | Stabil halten; ggf. weitere Platzhalter ergänzen wenn Bedarf entsteht |
| **Vorlagen: Datenanfrage, Kündigung, Termin** | Hoch | 🟢 Alle drei als Start-Vorlagen angelegt, frei erweiter-/bearbeitbar | Texte bei Bedarf fachlich verfeinern |
| **Eigene minimale Kommunikationslösung** | Hoch | 🟢 Kommentare mit @-Erwähnung (Einzel + „Alle") an Kontakten und Aufgaben, Datei-Anhang, E-Mail-Benachrichtigung, `/erwaehnungen`-Übersicht + Sidebar-Badge | Stabil halten; bei Bedarf Kontakt-Kommentare auf weitere Entitäten ausweiten |
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
| `/api/mail-templates` | GET, POST | E-Mail-Vorlagen auflisten / anlegen |
| `/api/mail-templates/[id]` | PATCH, DELETE | Vorlage bearbeiten / löschen |
| `/api/comments` | GET, POST | Kommentare zu `entity_type=task\|contact` + `entity_id` laden / anlegen (FormData: `body`, `mentioned_user_ids`, `mention_all`, `attachments?[]`); Anhänge nur wenn sich ein Kontakt auflösen lässt |
| `/api/mentions` | GET | Eigene @-Erwähnungen, neueste zuerst (`?unread=true` filtert); liefert `unreadCount` |
| `/api/mentions/[id]` | PATCH | Eigene Erwähnung als gelesen markieren |
| `/api/kontakte/[id]/beitragsuebersicht/pdf` | GET | Beitragsübersicht als PDF (`@react-pdf/renderer`, Layout an Excel-Vorlage angelehnt); 400 falls noch keine Übersicht angelegt |

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
| Testdashboard | `/testdashboard` | Regressionstest-Übersicht, Testläufe, Umgebungsstatus (v0.6.0) — **nur Admin-Rolle sichtbar in der Sidebar (v0.11.1)** |
| Release Notes | `/release-notes` | In-App Feature-History |
| Erwähnungen | `/erwaehnungen` | Eigene @-Erwähnungen aus Kommentaren, Alle/Ungelesen-Filter — Seite bleibt für alle Rollen erreichbar, der Sidebar-Einstieg liegt seit v0.11.1 im Profil-Menü (nicht mehr eigener Hauptnav-Eintrag) mit Zähler-Badge am Profilnamen |
| Hilfe | `/hilfe` | Durchsuchbares Hilfe-Handbuch (v0.10.0), siehe eigener Abschnitt unten |
| Selektion (vormals „Reporting") | `/reporting` | NL→SQL-Freitextauswertung, siehe „Reporting & Analytics" — Route/API unverändert `/reporting` bzw. `/api/reporting`, nur die sichtbare Bezeichnung wurde v0.11.1 umbenannt |
| Einstellungen | `/einstellungen` + Unterseiten | KI-Suche, Venture-/Firmendaten, Team, Zahlungsmodelle, Mail-Vorlagen, Produktverwaltungs-Config — **nur Admin-Rolle sichtbar in der Sidebar (v0.11.1)**, Seiten selbst unverändert nur serverseitig admin-only wo bereits vorher der Fall |

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

### v0.13.2 (2026-07-29) — Korrektur: KlickTipp läuft über Zapier, kein Sync-Status im CRM

**Vom Nutzer klargestellt:** Die KlickTipp-Tags werden **über Zapier** gesetzt, nicht über die
KlickTipp-API. Der direkte API-Weg funktioniert nicht (`403 ["API access denied."]`).

- 🐛 Dadurch war die tags zuvor ausgelieferte Lauf-Historie (v0.13.0) **irreführend**: Sie zeigte
  für KlickTipp einen Sync-Status, der niemals „synchronisiert" werden kann — die Zapier-Strecke
  liegt außerhalb der Anwendung und schreibt nichts nach `activities` zurück. Ein Kontakt, dessen
  Tag über Zapier korrekt ankam, wäre im CRM als „nicht erfolgt" bzw. „fehlgeschlagen" erschienen
- ✅ Die Historie zeigt für KlickTipp jetzt nur noch die belegbare Tatsache: **„Tag gesetzt"**,
  wenn die Regel einen Tag am Kontakt gesetzt hat. Kein Übertragungsstatus mehr
- ✅ Fußnote und Hilfe-Artikel `regeln.verlauf` entsprechend richtiggestellt
- ℹ️ Die 20 `klicktipp_sync_failed`-Einträge (letzte am 20.07.2026) stammen aus dem alten
  Direktweg und sind Altrauschen, kein laufender Fehler
- ⬜ Offen: `src/lib/klicktipp-client.ts` und seine Aufrufer (`automation-engine.ts`,
  `api/kontakte`, `api/leads`, `apply-batch`) sind faktisch toter Code, der beim Auslösen weiter
  403-Fehler erzeugt. Im Anwendungscode gibt es **keinen** Zapier-Bezug — der Zap wird außerhalb
  ausgelöst. Aufräumen erst nach Rücksprache

### v0.13.1 (2026-07-29) — Bugfix: Versicherungstyp einer Regel wurde nie gespeichert und nie ausgewertet

**Gemeldetes Symptom:** Im Regel-Dialog lässt sich ein Versicherungstyp auswählen, nach dem
Speichern ist er wieder weg.

**Tatsächliche Ursache — und sie reicht weiter als das Symptom:**
- 🐛 Migration 0030 legte die Spalte als `rules.condition_insurance_product` an. Die gesamte
  Anwendung spricht sie jedoch als `condition_sparte` an — Regel-Formular, `POST/PATCH /api/rules`,
  `automation-engine.ts` und `apply-batch`. Es gab keine Stelle, die zwischen beiden vermittelt
- 🐛 Folge 1: Jedes Speichern des Versicherungstyps brach ab. Direkt reproduziert:
  `Could not find the 'condition_sparte' column of 'rules' in the schema cache`
- 🐛 Folge 2 (schwerwiegender): **Die Sparten-Bedingung hat nie gefiltert.** Beim Lesen liefert die
  Datenbank `condition_insurance_product`; geprüft wurde `rule.condition_sparte` — immer `undefined`,
  die Bedingung `!rule.condition_sparte || …` damit immer wahr. Dasselbe im Batch-Pfad
  (`query.eq('sparte', …)` wurde nie angehängt)
- 🔍 Damit erklärt: Die Regel „Facebook + Unternehmerschutz" trägt in der Datenbank korrekt
  `Unternehmerschutz`, hat aber trotzdem alle Facebook-Kontakte erfasst — darunter vier mit
  Sparte `PKV`. Das war die Fehlzuordnung, die am 29.07. manuell zurückgesetzt werden musste
  (Dialfire-ID, Kampagne und Task bei 5 Kontakten; alte Werte als Aktivität gesichert)
- ✅ Migration 0053 benennt die Spalte in `condition_sparte` um — inklusive Index. Umbenennen statt
  Neuanlage, damit die vorhandenen Werte (`PKV`, `Unternehmerschutz`) erhalten bleiben. Der Name
  passt zudem zu `contacts.sparte`, gegen das verglichen wird. Anwendungscode bleibt unverändert
- ⚠️ Verhaltensänderung nach dem Einspielen: Die Sparten-Bedingung greift erstmals wirklich.
  Bestehende Regeln mit gesetztem Versicherungstyp erfassen ab dann weniger Kontakte als bisher —
  das ist beabsichtigt, aber beim erneuten „Anwenden" spürbar

### v0.13.0 (2026-07-29) — Lauf-Historie der Automatisierungsregeln

**Ausgangslage:** Auf `/regeln` gab es nur einen `runs`-Zähler. Ob eine Regel einen Kontakt
tatsächlich angelegt und ob die Übertragung an Dialfire/KlickTipp funktioniert hat, war nur
über die Aktivitäten am einzelnen Kontakt oder die Vercel-Logs nachvollziehbar.

- 🔍 Datenlage vorab geprüft: Die nötigen Bausteine existieren bereits im Aktivitätsprotokoll
  (`contact_created`, `dialfire_synced` 1.358×, `dialfire_sync_failed` 417×, `klicktipp_sync_failed` 20×,
  `automation_executed` 1.258×). Was fehlte, war die Verknüpfung zur auslösenden Regel
- 🐛 Ursache dafür gefunden: Der **Batch-Pfad** schrieb die Regel-ID nur in den Beschreibungstext
  („Batch: Rule &lt;uuid&gt; applied"), der automatische Pfad dagegen sauber ins Datenfeld.
  Konkret: 34 Einträge strukturiert, 1.215 nur als Text. Beide Pfade schreiben jetzt
  `{ rule_id, trigger }` ins Datenfeld
- ✅ `GET /api/rules/[id]/runs`: liefert je betroffenem Kontakt Zeitpunkt, Auslöser
  (automatisch/manuell), ob der Kontakt neu angelegt wurde, die gesetzten Felder und den
  Sync-Stand für Dialfire und KlickTipp inkl. Fehlertext. Berücksichtigt bewusst **beide**
  Schreibweisen der Regel-ID, damit auch die 1.215 Altdatensätze sichtbar bleiben
- ✅ Aufklappbarer „Verlauf" je Regel auf `/regeln` (`RegelLaufHistorie.tsx`) mit Kopfzeile
  „n betroffene Kontakte · m mit Sync-Fehler" und Verlinkung in die Kundenakte
- ⚠️ Bewusste Einschränkung: Die Sync-Aktivitäten kennen die auslösende Regel nicht — sie werden
  über den Kontakt zugeordnet. Angezeigt wird deshalb der **letzte Sync-Stand des Kontakts**,
  nicht eine erfundene Kausalkette pro Lauf. Ein späterer Erfolg hebt einen früheren Fehler auf;
  das steht auch als Hinweis unter der Tabelle
- ✅ Leerfall wird erklärt statt als Fehler zu wirken: Regeln mit `runs > 0`, aber ohne betroffene
  Kontakte (der Zähler steigt auch bei 0 Treffern) zeigen einen entsprechenden Hinweis
- ✅ Hilfe-Artikel `regeln.verlauf` ergänzt

### v0.12.0 (2026-07-27) — Telefonie: Wählen über Softphone Plus, persönliche Nebenstellen, eingehende Anrufe

**Befund vor der Umsetzung (am Produktivsystem geprüft):**
- 🔍 Die Telefonie war nicht halb gebaut, sondern **gebaut und nie eingeschaltet**: API-Token gültig (Tarif PROFI), Notify-Secret gesetzt, Webhook-Route korrekt — aber **null empfangene Notify-Ereignisse**, weil Notify im Placetel-Portal nie **pro Rufnummer** aktiviert wurde. Das erklärt beide Symptome gleichzeitig: keine Gesprächsdauern und 6 Anrufversuche, die dauerhaft auf `initiated` standen (genau dieser Rückkanal schaltet den Status weiter)
- 🔍 Zweiter Blocker: `users` hatte **keine SIP-Zuordnung**. Alle Anrufe liefen über einen einzigen globalen SIP-Benutzer — nicht unterscheidbar, wer telefoniert hat
- ✅ Der bestehende Webhook-Parser wurde Feld für Feld gegen die offizielle Placetel-Spezifikation (`Placetel/call-control-notify-api`) abgeglichen und ist inhaltlich korrekt — kein Änderungsbedarf

**Entscheidung: Weg B — der Arbeitsplatz wählt selbst**
- ✅ Migration 0052: `users.placetel_sipuid` (mit Eindeutigkeits-Index, damit keine Nebenstelle doppelt vergeben wird) + `system_config.placetel_dial`
- ✅ `POST /api/calls/initiate` entscheidet anhand der Konfiguration, wie gewählt wird, und gibt dem Browser nur noch das auszuführende Kommando zurück. **Validierung, Rate-Limit, Länder-Freigabe, Anrufprotokoll und Aktivität bleiben serverseitig** — der Arbeitsplatz löst lediglich aus
- ✅ Die Verknüpfung mit dem tatsächlichen Gespräch stellt anschließend die Placetel-Rückmeldung über Rufnummer + Zeitfenster her (die bestehende Zuordnungslogik im Webhook unterstützt das bereits)
- ⚠️ Das exakte lokale Kommando von Softphone Plus ist **herstellerseitig nicht öffentlich dokumentiert**. Deshalb sind Methode (`tel` / `local_http`) und URL-Vorlage über `system_config` konfigurierbar — die Korrektur nach dem Test am Arbeitsplatz ist eine Einstellung, kein Deployment. Ziel-Hosts sind bewusst auf `localhost`/`127.0.0.1` begrenzt, sonst könnte eine Fehlkonfiguration Rufnummern an einen fremden Host schicken
- ✅ Client (`dial-client.ts`) behandelt zwei Eigenheiten explizit: localhost gilt trotz HTTPS-Seite als vertrauenswürdig (kein Mixed-Content-Block), und die Anfrage läuft als `no-cors` — das Softphone antwortet voraussichtlich ohne CORS-Freigabe, die Antwort wird aber nicht benötigt

**Persönliche Nebenstellen:**
- ✅ SIP-Zuordnung je Mitarbeiter in `/einstellungen/team`, inkl. „Nach Namen zuordnen" für die eindeutigen Übereinstimmungen (fünf Namen stimmen 1:1 mit Placetel überein). Geräte ohne eigene Person (z. B. „Melih Mobil") bleiben bewusst unzugeordnet und laufen über die Standard-Nebenstelle
- ✅ Ohne Zuordnung greift weiterhin `PLACETEL_DEFAULT_SIPUID`

**Eingehende Anrufe:**
- ✅ Neue Seite `/telefonie/eingehend?nummer=…`, die Softphone Plus beim Klingeln öffnet: genau ein Treffer → direkt in die Kundenakte, mehrere Treffer → Auswahlliste, unbekannt → Rufnummer wird angezeigt und die Anlage eines Kontakts angeboten (nicht erzwungen)
- ⚠️ Im Browser **abheben** ist nicht umgesetzt und war nicht das Ziel: Placetel bietet dafür keine dokumentierte einbettbare Schnittstelle. Angenommen wird der Anruf weiterhin im Softphone
- 🐛 Nebenbei behoben: Die Middleware hat beim Login-Redirect nur den Pfad, nicht den Query-String übernommen — die Rufnummer wäre nach einer Anmeldung verloren gegangen
- 🔒 Nebenbei behoben: Der `next`-Parameter des Logins wurde ungeprüft weitergeleitet (Open Redirect). Jetzt sind nur anwendungsinterne Ziele zulässig

**Gesprächsergebnisse:**
- ✅ Ergebnis `nicht_erreicht` erzeugt automatisch eine Wiedervorlage **in 2 Tagen**, zugeordnet an den Betreuer des Kontakts (sonst an den Anrufenden). Die Notiz aus dem Anruf wird übernommen. Ein Fehlschlag beim Anlegen macht das Speichern des Ergebnisses nicht rückgängig

**Noch offen (Konfiguration, kein Code):**
- ⬜ Notify im Placetel-Portal **pro Rufnummer** aktivieren — ohne diesen Schalter bleiben Gesprächsdauern weiterhin leer
- ⬜ Lokales Wähl-Kommando am Arbeitsplatz verifizieren und ggf. `placetel_dial` anpassen
- ⬜ Action-URL für eingehende Anrufe je Arbeitsplatz im Softphone hinterlegen
- ⬜ Die 6 Altdatensätze mit Status `initiated` bereinigen

### v0.11.2 (2026-07-27) — Bugfix: Gelöschte Dokumente blieben in der Gesamtübersicht sichtbar

**Ursache 1 (Hauptursache): Löschen aus dem CRM war an Google Drive gekoppelt**
- 🐛 `DELETE /api/kontakte/[id]/dokumente`: rief `deleteFileFromGoogleDrive()` auf, BEVOR die Metadaten-Zeile per Soft-Delete (`ordner_archived=true`) markiert wurde. Schlug die Drive-Löschung fehl — aktuell reproduzierbar der Fall, da der Google-Drive-Token-Refresh weiterhin fehlschlägt (siehe „Known Issues" unten, seit 2026-07-22) — brach die gesamte Anfrage mit einem Fehler ab, **bevor** die Datenbank je aktualisiert wurde. Das Dokument blieb dadurch technisch nie gelöscht und tauchte weiter in der Kontakt-Dokumentenliste und der globalen `/dokumente`-Übersicht auf
- ✅ Fix: Die Google-Drive-Löschung läuft jetzt in einem eigenen `try/catch`, das einen Fehler nicht mehr weiterreicht. Das Dokument wird in der Datenbank in jedem Fall als gelöscht markiert (die CRM-Sichtbarkeit hängt nicht mehr von der Erreichbarkeit/dem Zustand von Google Drive ab); schlägt die Drive-Löschung fehl, kommt eine nicht blockierende Warnung (`driveWarning`) in der Antwort zurück, die `KontaktDokumenteTab.tsx` als gelben Hinweis anzeigt („Datei konnte nicht aus Google Drive gelöscht werden … wurde trotzdem aus dem CRM entfernt") — analog zum bestehenden `attachmentWarning`-Muster bei Kommentar-Anhängen
- 🧪 Live gegen die tatsächlich unterbrochene Drive-Verbindung verifiziert: Löschung liefert `success: true` + `driveWarning`, Dokument verschwindet sofort aus Kontakt- und Gesamtübersicht

**Ursache 2 (zusätzlich gefunden): Browser-HTTP-Cache auf `/api/dokumente`**
- 🐛 `fetch('/api/dokumente')` in `src/app/dokumente/page.tsx` sowie `fetch(.../dokumente)` in `KontaktDokumenteTab.tsx` liefen ohne `cache: 'no-store'` — `export const dynamic = 'force-dynamic'` verhindert nur das serverseitige Next.js-Caching, nicht das HTTP-Caching im Browser für einen einfachen GET ohne Cache-Control-Header. Ein frisches `fetch()` derselben URL kurz nach einem vorherigen Aufruf konnte dadurch eine veraltete, den gelöschten Datensatz noch enthaltende Antwort liefern (live reproduziert: ohne `no-store` 17 Dokumente inkl. bereits gelöschtem Datensatz, mit `no-store` korrekt 16)
- ✅ Fix: Beide Fetch-Aufrufe nutzen jetzt `cache: 'no-store'`

### v0.11.1 (2026-07-27) — Navigation: Admin-Sichtbarkeit, Erwähnungen im Profil-Menü, Dialfire-Batch-Sync

**Sidebar-Anpassungen:**
- ✅ `Testdashboard` und `Einstellungen` sind nur noch für die Rolle `admin` in der Sidebar sichtbar (`NAV_ITEMS`-Einträge bekamen ein `adminOnly`-Flag, gefiltert via `isAdmin(currentUser?.role)` aus `src/lib/roles.ts`); die Seiten selbst sind unverändert erreichbar, falls direkt verlinkt — reine Sidebar-Sichtbarkeit, keine neue serverseitige Zugriffssperre
- ✅ `Erwähnungen` ist kein eigener Hauptnav-Eintrag mehr, sondern liegt im Profil-Menü unten links: ein Zähler-Badge erscheint direkt am Profilnamen (Kachel geschlossen) UND als Eintrag im aufgeklappten Menü — Route `/erwaehnungen` und ihr Inhalt bleiben unverändert
- ✅ `Reporting` in der Sidebar zu `Selektion` umbenannt (nur sichtbare Bezeichnung — Route `/reporting`, API `/api/reporting`, Datenmodell und interne Bezeichner unverändert); Seiten-H1, `HELP_AREA_LABELS.reporting` und die Hilfe-Artikeltitel wurden mitgezogen, damit Sidebar/Seite/Hilfe konsistent bleiben

**Dialfire-Batch-Sync unter „Synchronisation":**
- ✅ Neue Route `GET /api/sync/dialfire-pull`: läuft über alle Kontakte mit gesetzter `dialfire_id` + `dialfire_campaign_id`, ruft pro Kontakt dieselbe Edge Function (`dialfire-pull-sync`) auf wie der bestehende manuelle Einzel-Sync (`DialfireSyncPanel` → `/api/dialfire/pull-sync`) und schreibt einen gesammelten Eintrag in `sync_log` — exakt derselbe Mechanismus (Quellen-Kachel, „Jetzt synchronisieren", Sync-Protokoll) wie bei Facebook/Calendly/E-Mail/CSV
- ✅ Kontakte werden mit Bündelung (`CONCURRENCY = 8`) statt streng nacheinander verarbeitet, jeder Edge-Function-Aufruf mit 15s-Timeout (`AbortController`) — ein rein sequenzieller Lauf über die aktuell 189 verbundenen Kontakte hätte die Laufzeitgrenze von Serverless-Functions gerissen (beim ersten Testlauf während der Verifikation tatsächlich beobachtet: > 30s ohne Antwort)
- ⚠️ Bei der Browser-Verifikation wurde die neue „Jetzt synchronisieren"-Kachel für Dialfire dreimal gegen die echte, produktive Supabase-Instanz ausgelöst (kein separates Test-System für diesen Anwendungsfall) — unbedenklich, da rein lesend gegenüber Dialfire und exakt dieselbe idempotente Pull-Logik, die der bestehende manuelle Sync-Button ohnehin pro Kontakt ausführt, aber dadurch entstanden reale `activities`-/`dialfire_sync_log`-Einträge auf allen 189 verbundenen Kontakten (dreifach) als Nebeneffekt der Verifikation — kein Datenverlust, aber erwähnenswertes Verifikations-Rauschen im Audit-Trail

### v0.11.0 (2026-07-27) — Beitragsübersicht (Sparten-Vergleich)

**Beitragsübersicht am Kontakt:**
- ✅ Ausgangspunkt: die reale Excel-Vorlage „Beitragsuebersicht_Vorlage_Allianz_Guen" — deren eigenes „Hinweis für die CRM-Anbindung"-Sheet wurde als verbindliche Spezifikation behandelt, nicht nur als Inspiration
- ✅ Migration 0051: `contacts.beitragsuebersicht JSONB` — eine laufende Übersicht pro Kontakt, kein Versionsverlauf; jeder Speichervorgang überschreibt den bisherigen Stand
- ✅ `src/lib/beitragsuebersicht-calc.ts`: gemeinsames Berechnungsmodul für Differenz, Summenzeile und die sich gegenseitig ausschließenden Ersparnis-/Mehrbeitrag-Boxen — von der Editor-UI UND dem PDF-Generator identisch genutzt, damit beide nie auseinanderlaufen können; alle drei Werte werden nie in die DB geschrieben, immer live berechnet
- ✅ `src/data/beitragsuebersicht-sparten.ts`: feste Sparten-Vorbelegung für Privat- bzw. Gewerbekunden, nur beim erstmaligen Öffnen angewendet, danach frei erweiter-/löschbar
- ✅ `BeitragsuebersichtPanel.tsx` im bestehenden Drawer-Launcher-Muster: Sparten-Tabelle (Versicherer, Alt-/Neu-Beitrag, Beginn, Ablauf, Bemerkung), bei Gewerbekunden zusätzlich optionales Flottenblatt (ab 4 Fahrzeugen) — dessen Summe automatisch in die Zeile „Kfz-Flotte / Firmenfahrzeuge" einfließt und dort die manuelle Eingabe sperrt; bei 1–3 Fahrzeugen wie im Original direkt in der Zeile eintragen
- ✅ `GET /api/kontakte/[id]/beitragsuebersicht/pdf`: PDF-Export im Layout der Excel-Vorlage (`@react-pdf/renderer`, gleiches Muster wie `kontakte-export-pdf.tsx`)
- ✅ Neue Kachel „Beitragsübersicht" auf der Kontaktdetailseite (Summary + „Bearbeiten →"-Drawer) + Hilfe-Artikel `kontakt-detail.beitragsuebersicht`
- 🧪 Neuer Playwright-Testfall `E2E-018` (`tests/e2e/beitragsuebersicht.spec.ts`): Alt-/Neu-Beitrag eintragen, Live-Differenz prüfen, speichern, Kachel-Zusammenfassung + Persistenz nach Reload prüfen, PDF-Endpunkt aufrufen
- ⚠️ Vorgehen bewusst dreistufig: erst schriftlicher Analyse-/Integrationsvorschlag, dann ein klickbarer HTML-Prototyp (inkl. einer Nachbesserung um die Excel-Felder Beginn/Ablauf/Bemerkung) zur Freigabe, erst danach die echte Implementierung — auf ausdrücklichen Wunsch, bevor am echten Code gearbeitet wird

### v0.10.0 (2026-07-26) — Eingebaute Hilfe & Kundendokumentation

**„?"-Hilfe (Kundendokumentation + kontextsensitive Hilfe):**
- ✅ Rein statisches Hilfe-System, analog zum `RELEASE_NOTES`-Muster, aber ohne API-Route (Provider und `/hilfe`-Seite importieren `src/data/help/` direkt) — kein DB-Table, keine Business-seitige Bearbeitung vorgesehen (Inhalte werden im Code gepflegt)
- ✅ `src/types/help.ts` (`HelpArticle`, `HelpArea`) + `src/data/help/*.ts` (ein File pro Bereich, ~62 Artikel), aggregiert in `src/data/help/index.ts` (`HELP_ARTICLES_BY_ID`, `HELP_ARTICLES_BY_AREA`, `resolvePageDefaultArticle()` mit Exact-vor-Prefix-Auflösung für die einzige echte dynamische Route `/kontakte/[id]`)
- ✅ `HelpProvider` (`src/components/help/`, erster React-Context der App, in `layout.tsx` um Sidebar+Main gelegt): globaler `<Drawer>`-Instanz (bestehende Komponente wiederverwendet) + Taste `?` als Shortcut — mit Guard gegen Eingabefelder (`activeElement`-Prüfung) und bewusster Unterdrückung, wenn bereits ein anderer Drawer/Modal offen ist (`document.body.style.overflow === 'hidden'`), statt zwei Overlays zu stapeln
- ✅ `<HelpButton articleId="...">`: Kachel-genaues ❓-Symbol, an ~39 Stellen über alle Hauptseiten eingefügt (öffnet den spezifischen Artikel statt der Seiten-Standardhilfe)
- ✅ `/hilfe`: vollständiges durchsuchbares Handbuch, nach Bereich gruppiert (Sidebar-Reihenfolge), Client-seitige Volltextsuche, Deep-Linking via `#<articleId>` (Scroll + 2s Highlight)
- ✅ Sidebar: neuer Nav-Eintrag „Hilfe" + persistentes Hilfe-Icon im Footer (ruft dieselbe Seiten-Standardhilfe wie `?` auf)
- 🐛 Nebenbei entdeckt beim Testen des Kontaktdetail-Seiten-Kontexts: eine über Rohdaten (nicht über das UI-Formular) angelegte Aufgabe ohne `priorität` ließ `AufgabenPanel.tsx` abstürzen — bereits in v0.9.0 behoben, hier nur zur Kenntnisnahme falls im Zusammenhang mit dieser Session gesucht wird
- ⚠️ Bewusste Scope-Entscheidung: `?` löst die **Seiten**-Standardhilfe auf, nicht kachel-genau (das leistet ausschließlich `<HelpButton>`) — echte Tile-Erkennung unter dem Cursor bräuchte ein Hover-/Fokus-Tracking-System, das nicht angefragt war
- 🧪 Neuer Playwright-Testfall `E2E-017` (`tests/e2e/hilfe.spec.ts`) — rein lesend, keine Testdaten-Bereinigung nötig

### v0.9.0 (2026-07-26) — Kommentare & @-Erwähnungen an Kontakten und Aufgaben

**Kommentare (Roadmap Phase B, „Eigene minimale Kommunikationslösung"):**
- ✅ Migration 0050: neue Tabellen `comments` (polymorph über `entity_type`/`entity_id`), `comment_mentions`, `comment_attachments`
- ✅ `POST /api/comments`: legt Kommentar an, löst Einzel-Erwähnungen auf, expandiert `@Alle` zu Einzel-Erwähnungen pro aktivem User (außer Autor), lädt Anhänge nach Google Drive hoch (Muster wie E-Mail-Anhänge, `created_by=comment`) und verschickt eine Benachrichtigungs-Mail pro Erwähnung
- ✅ Datei-Anhänge nur möglich, wenn sich für die Entität ein Kontakt auflösen lässt (Kontakt direkt, oder Aufgabe mit `contact_id`) — sonst HTTP 400 mit klarer Fehlermeldung
- ✅ `GET/PATCH /api/mentions[/[id]]`: eigene Erwähnungen laden (inkl. `unreadCount`) und einzeln als gelesen markieren
- ✅ `CommentThread`-Komponente (wiederverwendbar): Textarea mit cursorbasierter `@`-Autovervollständigung (Team-Mitglieder + „Alle"), Mention-Chips als Quelle der Wahrheit für den Submit, Datei-Anhang-Picker, vollständige Kommentarhistorie mit Erwähnungen und Anhang-Links
- ✅ Integration in Kontaktdetail (neue „Kommentare"-Kachel) und `AufgabenEditModal` (nur im Bearbeiten-Modus, da ein bestehendes Aufgaben-ID benötigt wird)
- ✅ Neue Seite `/erwaehnungen` (Alle/Ungelesen-Filter, Klick markiert gelesen + springt zur Entität) + Sidebar-Badge mit Ungelesen-Zähler (60s-Polling)
- 🐛 Nebenbei gefunden und behoben: `POST /api/aufgaben` setzte bei fehlendem `status`/`priorität` im Request-Body fälschlich `undefined` statt des vorgesehenen Defaults (`offen`/`mittel`) in die DB — die Ternary prüfte zwar den Default-Fall, gab im Erfolgsfall aber den ursprünglichen (undefined) Wert zurück. Das ließ `AufgabenPanel.tsx` beim Rendern mit `null`-Priorität abstürzen (`Cannot read properties of null (reading 'charAt')`). Beides gefixt: korrekter Fallback in der API-Route + defensive Anzeige in `AufgabenPanel.tsx`
- ⚠️ Bewusst nicht automatisiert getestet: `@Alle` fächert eine E-Mail an ALLE aktiven User auf (inkl. echter Mitarbeiter, nicht nur Test-Accounts) — da Playwright laut `docs/TESTUMGEBUNG_KONZEPT.md` regelmäßig gegen Produktion läuft, würde ein automatisierter Test bei jedem Deploy echte Kolleg:innen anschreiben. Einmalig manuell verifiziert (korrekte Erwähnungs-Anzahl = aktive User − Autor)
- 🧪 Neuer Playwright-Testfall `E2E-016` (`tests/e2e/kommentare.spec.ts`): Kommentar mit Einzel-Erwähnung + Anhang an Kontakt, Anhang-Ablehnung ohne Kontaktbezug, Kommentarverlauf im Aufgaben-Bearbeiten-Modal

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

**E-Mail-Vorlagen (Roadmap Phase B):**
- ✅ Migration 0049: neue Tabelle `mail_templates` (name, subject, body) inkl. drei Start-Vorlagen (Datenanfrage, Kündigung, Termin)
- ✅ `/einstellungen/mail-vorlagen`: Vorlagen anlegen/bearbeiten/löschen, jederzeit erweiterbar
- ✅ `src/lib/mail-template-placeholders.ts`: Platzhalter `{{vorname}}`, `{{nachname}}`, `{{name}}`, `{{firma}}`, `{{email}}`, `{{telefon}}`, `{{versicherungsgesellschaft}}`, `{{sparte}}`
- ✅ Vorlage-Dropdown in `ContactEmailModal` befüllt Betreff/Nachricht mit ersetzten Platzhaltern, bleibt vor dem Senden frei editierbar (keine Automatik/Blindversand)

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

### Kritisch — sofort handeln

- [ ] **Google Drive Verbindung unterbrochen:** Token-Refresh schlägt seit 2026-07-22 fehl (`refresh_token` abgelaufen/widerrufen); blockiert aktuell alle Drive-Uploads (Dokumente, E-Mail-Anhänge, Kommentar-Anhänge) mit stillem Fallback-Fehler pro Upload. Admin-Alarm-Mail wurde ausgelöst. **Fix:** unter `Einstellungen → Dokumente` neu verbinden.

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
| `supabase/migrations/0050_comments_mentions.sql` | `comments`, `comment_mentions`, `comment_attachments` (v0.9.0) |
| `src/app/api/comments/route.ts` | Kommentar-CRUD, @Alle-Expansion, Drive-Anhang-Ablage, Erwähnungs-Mails |
| `src/lib/mention-notify.ts` | E-Mail-Benachrichtigung pro Erwähnung (kein Cooldown, anders als `drive-token-alert.ts`) |
| `src/components/kontakt/CommentThread.tsx` | Wiederverwendbare Kommentar-Komponente (Kontaktdetail + Aufgaben-Modal) |
| `src/types/help.ts` | `HelpArticle`/`HelpArea`-Typen + Bereichs-Reihenfolge/Labels (v0.10.0) |
| `src/data/help/index.ts` | Aggregiert alle Bereichs-Artikel, `resolvePageDefaultArticle()` (Exact-vor-Prefix) |
| `src/components/help/HelpProvider.tsx` | Globaler Hilfe-Kontext, `?`-Shortcut, gemeinsamer Drawer |
| `src/components/help/HelpButton.tsx` | Kachel-genaues ❓-Symbol, öffnet spezifischen Artikel |
| `src/app/hilfe/page.tsx` | Durchsuchbares Handbuch, Bereichs-Gruppierung, Deep-Linking |
| `supabase/migrations/0051_beitragsuebersicht.sql` | `contacts.beitragsuebersicht JSONB` (v0.11.0) |
| `src/types/beitragsuebersicht.ts` | `Beitragsuebersicht`/`BeitragsPosition`/`FlottenFahrzeug`-Typen + `emptyPosition`/`emptyFahrzeug` |
| `src/data/beitragsuebersicht-sparten.ts` | Feste Sparten-Vorbelegung Privat/Gewerbe, `KFZ_FLOTTE_SPARTE` |
| `src/lib/beitragsuebersicht-calc.ts` | Gemeinsames Berechnungsmodul (Differenz, Summen, Flotten-Summe) — von UI und PDF identisch genutzt |
| `src/components/kontakt/BeitragsuebersichtPanel.tsx` | Drawer-Inhalt: Sparten-Tabelle + optionales Flottenblatt |
| `src/lib/beitragsuebersicht-pdf.tsx` | PDF-Layout (`@react-pdf/renderer`), an Excel-Vorlage angelehnt |
| `src/app/api/kontakte/[id]/beitragsuebersicht/pdf/route.ts` | PDF-Download-Endpoint |
| `supabase/migrations/0052_placetel_persoenliche_sip_zuordnung.sql` | `users.placetel_sipuid` + `system_config.placetel_dial` (v0.12.0) |
| `src/lib/telefonie/dial-config.ts` | Wähl-Methode + URL-Vorlage, Beschränkung auf localhost-Ziele |
| `src/lib/telefonie/dial-client.ts` | Führt das Wähl-Kommando am Arbeitsplatz aus (tel: bzw. lokales HTTP) |
| `src/app/api/calls/initiate/route.ts` | Prüft und protokolliert serverseitig, liefert das Wähl-Kommando |
| `src/app/telefonie/eingehend/page.tsx` | Screen-Pop bei eingehenden Anrufen |
| `src/app/api/calls/[id]/result/route.ts` | Gesprächsergebnis + Wiedervorlage bei „nicht erreicht" |
| `src/app/api/placetel/sip-users/route.ts` | Nebenstellen-Auswahl für die Team-Zuordnung |
| `docs/PLACETEL_TELEFONIE_KONZEPT.md` | Technischer Hintergrund, Notify-API, Sicherheitsanforderungen |
| `src/components/Sidebar.tsx` | `NAV_ITEMS[].adminOnly` + Filter, Erwähnungen-Badge im Profil-Menü (v0.11.1) |
| `src/app/api/sync/dialfire-pull/route.ts` | Dialfire-Batch-Pull-Sync über alle verbundenen Kontakte, bündelt Aufrufe (`CONCURRENCY=8`) + Timeout, loggt nach `sync_log` (v0.11.1) |

---

*Last Updated: 2026-07-29 — v0.13.2 KlickTipp läuft über Zapier: Lauf-Historie zeigt nur noch „Tag gesetzt" statt eines nicht belegbaren Sync-Status*
