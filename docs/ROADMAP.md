# Sentinel Logic — Feature-Roadmap

> Ausgelagert aus `CLAUDE.md` (v0.25.0), damit die Roadmap eigenständig einsehbar/teilbar ist.
> Diese Datei ist die Single Source of Truth für die Roadmap — `CLAUDE.md` verweist nur noch
> hierher. Bereits implementierte Grundlagen bleiben zusätzlich im Abschnitt „Feature-Status"
> von `CLAUDE.md` dokumentiert.
>
> **Prioritäten:** `Hoch` = als Nächstes bzw. phasenbestimmend, `Mittel` = nach den
> Kernabhängigkeiten, `Niedrig` = bewusst zurückgestellt.
>
> Stand: 2026-08-15

---

## Phase A — Stabiler CRM-Kern, einheitliche Automatisierung und Telefonie

**Ziel:** Den bestehenden CRM-Kern produktiv stabilisieren, Placetel vollständig abnehmen und
Automation/Synchronisation zu einem einheitlich steuerbaren System zusammenführen.

| Feature | Priorität | Stand | Nächster Schritt / Zielbild |
|---------|-----------|-------|-----------------------------|
| **Vollständiger Regressionstest** | Hoch | 🟡 Testsystem und E2E-Katalog vorhanden | Gesamtlauf ausführen, fachliche Restfehler dokumentieren und kritische Fehler schließen |
| **Placetel Click-to-Call** | Hoch | 🧪 MVP implementiert | Echten Pilotanruf mit Gesprächsdauer, Auflegegrund und Abschlussstatus erfolgreich abnehmen |
| **Placetel Notify-/Ergebnisverarbeitung** | Hoch | 🧪 HMAC, offizielle Statuswerte, Dauer und Gesprächsergebnis vorbereitet | Reale Provider-Callbacks prüfen, Fehlerfälle absichern und Automationsfolgen testen |
| **Automation + Synchronisation vereinheitlichen** | Hoch | ✅ Done | Einheitliches `sync_runs`-Ausführungsmodell (Migration `0066`) für alle 9 Integrationen (KlickTipp-Push, Dialfire-Push/-Pull, Facebook, SuperChat, STRATO-Kalender, STRATO-Mail, KlickTipp-Rücksync-Webhook, CSV-Import) mit Batch/Item-Verschachtelung; auf `main` gemerged (6 Phasen, Branch `feature/sync-runs-fundament`). Stabil halten; `sync_log`/`dialfire_sync_log` bestehen bewusst als Zusatz-Log parallel weiter (siehe „Automation-Architektur" in `CLAUDE.md`) |
| **Einheitliche Cron-/Scheduler-Logik** | Hoch | ✅ Done | Eine `sync_config`-Tabelle ersetzt die beiden fast identischen `facebook_sync_config`/`dialfire_sync_config`; gemeinsamer Due-Check-Helper (`src/lib/sync-runs/sync-config.ts`). Bestehendes GitHub-Actions+`CRON_SECRET`-Muster generalisiert statt Plattformwechsel. Bei Bedarf STRATO-Mail/-Kalender künftig ebenfalls zeitgesteuert statt rein ereignisgetriggert |
| **Einheitliches Log-Handling** | Hoch | ✅ Done | `sync_runs` als gemeinsames Lauf-/Eventmodell mit Korrelation zu Kontakt (`contact_id`), Regel (`rule_id`) und Integration; „Automatisierungs-Läufe"-Tabelle zeigt nur Top-Level-Läufe, Batch-Detail lädt Kontakt-Zeilen lazy nach. Optional künftig: `sync_log`/`dialfire_sync_log` in einem eigenen, kleineren Anlauf auflösen (aktuell bewusst zurückgestellt) |
| **Einheitliches Fehler- und Retry-Handling** | Hoch | ✅ Done | `classifyError()` (transient/rate_limit/validation/auth/unknown) + `runWithTracking()`-Wrapper + `retry-handlers.ts`-Registry für 7 von 9 Integrationen; automatischer Retry per Cron-Piggyback (alle 15 Min) und manuell sofort per „Jetzt synchronisieren" (`retry-all`). Bewusst kein Auto-Retry für STRATO-Mail (E-Mail-Versand nicht idempotent) |
| **Automation-/Sync-Control-Center UI** | Hoch | ✅ Done | `/sync` + `/regeln` unter gemeinsamer „Automatisierungen"-Tab-Leiste (ein Sidebar-Eintrag), einheitliches `SyncStatusBadge`-Vokabular auf allen Kacheln, „Automatisierungs-Läufe"-Tabelle mit Retry/Pause pro Zeile + aufklappbarem Pro-Kontakt-Batch-Detail. Optional künftig: Deep-Links von einer Regel direkt zu ihren gefilterten Läufen |
| **Mitarbeiterdashboard** | Hoch | 🟢 `/dashboard` personalisiert: Heute im Fokus, Meine Kontakte, Letzte Aktivitäten, Meine Pipeline, Team-Umschalter für Admins | Stabil halten; ggf. „Abschlussquote" um echten 30-Tage-Zeitverlauf ergänzen sobald historische Snapshots existieren |
| **UI-/Branding-Überarbeitung** | Hoch | 🟡 Stufe 1+2 done (`docs/STYLE_GUIDE.md`, Stand 2026-08-16) | Fundament (Design-Tokens, Bausteinkasten `src/components/ui/`, einklappbare Sidebar) plus die drei Pilotseiten Dashboard/Kontakte/Angebote auf `<PageHeader />`/`<Button />` und `brand`-Farbtoken umgestellt, live verifiziert (Branch `feature/ui-ux-fundament`, enthält gemergt `feature/angebote-tracking`). Nächster Schritt: Stufe 3 — restliche Hauptseiten schrittweise migrieren |
| **Facebook Lead-Import produktiv abnehmen** | Mittel | 🟢 Webhook und manueller Sync implementiert, seit v0.25.0 zusätzlich mit Retry + Batch/Item-Sichtbarkeit im Control Center | Echten Lead-End-to-End-Lauf inklusive Dubletten, Automation und Downstream-Sync durchführen |
| **KlickTipp-Direktsynchronisation** | Hoch | 🟢 API-User freigeschaltet, deployed und Pilot erfolgreich | Produktiv beobachten; API-Zugang und Mapping per Regression absichern. Der direkte Management-API-Weg bleibt der verbindliche Outbound-Pfad, Make.com ist entfernt. |
| **KlickTipp-Rücksynchronisation** | Hoch | 🧪 Migration, Secret, Statusabgleich und erster Tag-Webhook live; seit v0.25.0 zusätzlich an `sync_runs`/Retry angebunden | Reale Öffnung, Klick und Abmeldung End-to-End prüfen; danach den Statusabgleich zeitgesteuert aktivieren und Rückkanal-Monitoring im Control Center ergänzen. **Stand 2026-08-11: `klicktipp_webhook_events` enthält 0 Zeilen — es ist bislang noch nie ein echtes Webhook-Event bei uns angekommen.** Zu prüfen: ob auf KlickTipp-Seite die Webhook-URL/Secret/Event-Auswahl korrekt hinterlegt sind (reine Konto-Konfiguration bei KlickTipp, nicht im Code sichtbar). |
| **KlickTipp-Tag-Bestand bereinigen** | Mittel | 🟡 Erste Bestandsaufnahme: 719 manuelle Tags, sechs ausgehende Webhooks | Vollständigen Tag-Export klassifizieren, Kampagnen-/Webhook-Abhängigkeiten prüfen und erst danach Dubletten bzw. Alt-Tags kontrolliert archivieren. Den älteren Webhook `Sentinel Logic Sync` (ID `169322`) bis zum Vergleich mit dem abgesicherten Webhook nicht löschen. |
| **Gewerbedaten-Recherche** | Mittel | 🟢 In der Gesprächsvorbereitung integriert (v0.26.0): KI recherchiert Gewerbekontakte über Claudes serverseitiges `web_search`-Tool (öffentliches Web statt kostenpflichtiger Handelsregister-API — löst die „zulässige Datenquellen"-Frage pragmatisch), Ergebnis wird pro Kontakt gecacht (`contacts.gewerbe_recherche`) und fließt nur als Kontext in Kurzprofil/Gesprächsvorschläge ein — keine automatische Übernahme in die Kontaktfelder | Stabil halten; bei Bedarf später Auto-Fill der Kontaktfelder (mit Review-Schritt) als eigenen, kleinen Anlauf nachziehen |
| **KI-Gesprächsvorbereitung** | Mittel | 🟢 v1 live (v0.19.0): Button „Anruf vorbereiten", Claude Sonnet, strukturierte Ausgabe, manuelle Prüfung im Panel | Phase 2+: automatischer Trigger bei eingehendem Anruf/Kalendertermin, automatisches Gesprächsprotokoll |
| **Dialfire-Synchronisation** | Niedrig | 🟢 Create-/Pull-Pfade vorhanden, seit v0.25.0 mit Retry + Batch/Item-Sichtbarkeit | Nur stabil halten; kein größerer Ausbau, wenn Placetel den operativen Bedarf ersetzt |
| **Dialfire-Kampagnenflexibilität** | Niedrig | 🟡 Teilweise konfigurierbar | Nur noch notwendige Hardcodierungen entfernen; keine neue Fachlogik priorisieren |
| **Granulare Rechte pro Benutzer** | Niedrig | 🟡 Rollenarchitektur vorbereitet | Erst nach Stabilisierung der Kernprozesse eine Berechtigungsmatrix definieren |
| **TikTok Lead-Import** | Niedrig | 🔴 Nur als Kontaktquelle vorhanden | Erst nach Facebook-Abnahme und konkretem Kampagnenbedarf anbinden |
| **Google-/YouTube-Lead-Import** | Niedrig | 🔴 Nicht implementiert | Konkrete Google-Leadquelle und Zugriff vor einer Umsetzung klären |

---

## Phase B — AmisNow, Angebote und minimale Kundenkommunikation

**Ziel:** Den operativen Verkaufsprozess mit AmisNow verbinden, das Angebotshandling fachlich
entscheiden und eine kleine eigene Kommunikationslösung für die wichtigsten Abläufe bereitstellen.

| Feature | Priorität | Stand | Nächster Schritt / Zielbild |
|---------|-----------|-------|-----------------------------|
| **AmisNow-Personenanlage** | Hoch | 🧪 Browser-MVP vorhanden | Stabilen End-to-End-Pilot mit freigegebenen Testdaten, Jobstatus und Fehlerbehandlung abschließen |
| **AmisNow-Angebotsberechnung** | Hoch | 🧪 Agent-Job vorbereitet | Reale Berechnung abnehmen und Angebotsnummer, Beitrag und Fehlerstatus verlässlich zurückschreiben |
| **AmisNow-Jobsteuerung** | Hoch | 🟡 Job-/Result-Grundlagen vorhanden | Warteschlange, Wiederholung, Timeout, manuelle Freigabe und Monitoring produktionsfest machen |
| **Entscheidung Angebotshandling** | Hoch | ✅ Done | Entschieden (v0.32.0): eigenständiges Datenmodell (`angebote`-Tabelle), unabhängig von der alten `opportunities`-Tabelle (jetzt vollständig entfernt) und von `contracts` (bleibt der bereits bestehende Vertrags-Layer). Dokument-Verknüpfung über `dokument_id` |
| **Angebotsverwaltung/-Tracking** | Mittel | ✅ Done | `/angebote` (Karten-Pipeline + Liste) und Kontakt-Kachel „Angebote" (v0.32.0): Name, Kontakt, Status-Lifecycle (In Erstellung/Versendet/In Verhandlung/Gewonnen/Verloren), Betrag+Zyklus, Sparte, Leistungsumfang; Statuswechsel synchronisiert automatisch den Kontakt-Status |
| **Angebotsupload und Versionen** | Mittel | 🟡 Dokumentreferenz + KI-Upload-Übernahme vorhanden (v0.32.0) | Kein echtes Versionskonzept (mehrere Angebote zum selben Kontakt/derselben Sparte sind unabhängige Datensätze, keine Versionshistorie) — bei Bedarf nachziehen |
| **Angebotsversand** | Mittel | 🔴 Kein durchgängiger Angebotsworkflow | Versand zunächst per E-Mail mit Vorlage, Protokoll und manueller Freigabe umsetzen |
| **Automatische Angebots-Follow-ups** | Mittel | 🟡 Manuelle Aufgabe „Angebot nachverfolgen" bei KI-erkanntem Angebot vorhanden (v0.30.0) | Auf Basis der Scheduler-Grundlage (`sync_config`) automatisch Aufgabe/Erinnerung aus Angebotsstatus (`angebote.status`) und Frist erzeugen, statt nur beim Upload anzubieten |
| **Angebotsannahme → Vertrag** | Mittel | 🔴 Kein durchgängiger Übergang | Angenommenes Angebot (Status „Gewonnen") kontrolliert in einen Vertrag/eine Beitragsübersicht-Zeile überführen. Bewusst NICHT automatisiert in v0.32.0 (nur Hinweisbanner) — **die Beitragsübersicht-Logik (`beitragsuebersicht-uebernahme.ts`) muss dafür angepasst werden**, sobald das automatisiert wird |
| **Vertragsverwaltung** | Mittel | 🟡 KI-erzeugte Verträge und Anzeige vorhanden | Manuelles CRUD, Status, Dokumentbezug und Vertragslebenszyklus ergänzen |
| **E-Mail-Vorlagen** | Hoch | 🟢 `/einstellungen/mail-vorlagen` (CRUD) + Vorlage-Dropdown in `ContactEmailModal` mit Platzhalter-Ersetzung, manuelle Freigabe (Vorlage befüllt nur, sendet nicht automatisch) | Stabil halten; ggf. weitere Platzhalter ergänzen wenn Bedarf entsteht |
| **Vorlagen: Datenanfrage, Kündigung, Termin, Beitragsübersicht** | Hoch | 🟢 Alle vier als Start-Vorlagen angelegt, frei erweiter-/bearbeitbar | Texte bei Bedarf fachlich verfeinern |
| **Eigene minimale Kommunikationslösung** | Hoch | 🟢 Kommentare mit @-Erwähnung (Einzel + „Alle") an Kontakten und Aufgaben, Datei-Anhang, E-Mail-Benachrichtigung, `/erwaehnungen`-Übersicht + Sidebar-Badge | Stabil halten; bei Bedarf Kontakt-Kommentare auf weitere Entitäten ausweiten |
| **Terminbuchungs-Webhook → Aktivität/GF-Mail** | Mittel | 🔴 Echte Calendly-Integration fehlt | Nach Zugang Buchung empfangen, Kontakt zuordnen, protokollieren und GF benachrichtigen |
| **Externe Kalenderintegration (STRATO/CalDAV)** | Mittel | 🟢 Beidseitige Sync live verifiziert; seit v0.25.0 zusätzlich mit `sync_runs`-Sichtbarkeit (Push-Fehler, auch für Termine ohne Kontakt) | Stabil halten; bei Bedarf Pull von manuellem Button auf Cron/Edge Function umstellen, damit STRATO-seitige Änderungen automatisch ohne Klick ankommen |
| **SuperChat-Integration/Ablösung** | Niedrig | 🔴 Nicht umgesetzt (Sync-Funktion selbst seit v0.25.0 konsolidiert + retrybar) | Hinter die eigene Minimallösung stellen; später Integration, Migration oder vollständige Ablösung neu bewerten |
| **SuperChat-Datenmigration** | Niedrig | 🔴 Nicht umgesetzt | Erst nach strategischer SuperChat-Entscheidung betrachten |
| **Vollständiges E-Mail-Postfach / Unified Inbox** | Niedrig | 🟢 `/postfach` + `/api/postfach`: Posteingang über das STRATO-Postfach lesen/versenden (IMAP/SMTP), E-Mail-Eingänge werden in der Kontakt-Timeline protokolliert; Versand seit v0.25.0 zusätzlich in `sync_runs` sichtbar (immer `dead_letter` statt `retrying` — kein Auto-Retry beim Mailversand) | Kurze manuelle Abnahme (Anhänge, Threading, Fehlerfälle) nachholen, dann als erledigt markieren |
| **Kundenportal** | Niedrig | 🔴 Nicht umgesetzt | Nach der minimalen Kommunikation als eigenständiges MVP neu definieren |

---

## Phase C — Dokumente, Gemini-Umbau, zeitgesteuerte Prozesse und Reporting

**Ziel:** Die Dokumenten- und KI-Verarbeitung auf Gemini umstellen, wiederkehrende Prozesse auf der
gemeinsamen Scheduler-Architektur aufbauen und echte Kennzahlen bereitstellen.

| Feature | Priorität | Stand | Nächster Schritt / Zielbild |
|---------|-----------|-------|-----------------------------|
| **KI-Upload: Claude → Gemini API** | Hoch | 🟢 Bestehender Flow nutzt Claude | Providerabstraktion einführen, Gemini-Analyse mit gleichwertigem strukturiertem Schema implementieren und per Regression vergleichen |
| **Gemini-Migration sicher abnehmen** | Hoch | 🔴 Noch nicht begonnen | PDF, Foto, Scan, Vermittler-Falle, Dublette, Vertragsdaten und Fehlerfälle gegen bestehenden Testkatalog prüfen |
| **Claude-Laufzeit nach Migration entfernen** | Mittel | 🟡 Aktuell produktiver Provider | Erst nach erfolgreicher Gemini-Abnahme Runtime-Aufrufe und nicht mehr benötigte Konfiguration entfernen |
| **KI-Upload → Folgeaufgabe** | Hoch | 🟢 Dokumenttyp (Vertrag/Angebot/Nachtrag/Rechnung/Sonstiges) wird bei jedem Upload erkannt und dauerhaft gespeichert (`dokumente_metadata.dokumenttyp`, v0.30.0); bei Typ Angebot bietet sowohl der direkte Kontakt-Upload als auch die KI-Upload-Seite eine Folgeaufgabe „Angebot nachverfolgen" (fällig in 3 Tagen) an | Aktuell nur für Angebot fest verdrahtet, nicht „konfigurierbar" im Sinne der ursprünglichen Zielformulierung — bei Bedarf je Dokumenttyp/Sparte konfigurierbare Folgeaufgaben-Regeln nachziehen |
| **Dokumentenablage** | — | 🟢 Google Drive, Kategorien und Kompression umgesetzt | Stabil halten und in neue Workflows einbinden |
| **HiDrive vs. Google Drive** | Mittel | ⚪ Google Drive umgesetzt, Zielentscheidung offen | Google Drive als dauerhafte Lösung bestätigen oder Migration separat planen |
| **KI-Dokumentensuche** | Mittel | 🔴 Embeddings/pgvector-Pipeline fehlt | Extraktion, Chunking, Berechtigungen, Embeddings und Suche implementieren |
| **Zeitbasierte Workflows** | Hoch | 🟢 Scheduler-Grundlage (`sync_config` + Due-Check-Helper) seit v0.25.0 fertig | Darauf aufbauend wiederkehrende fachliche Jobs definieren (Geburtstag, Jubiläum, Versicherungscheck, s.u.) |
| **Geburtstagsautomation** | Mittel | 🔴 Nicht implementiert | Empfänger, Vorlage, Freigabe, Opt-out und Doppelversandschutz definieren |
| **Jubiläumsautomation** | Mittel | 🔴 Nicht implementiert | Fachliches Jubiläumsdatum und Versandregeln klären |
| **Jährlicher Versicherungscheck** | Hoch | 🔴 Nicht implementiert | Vertragsbezogenen Prüftermin, Aufgabe und Kommunikationsvorlage umsetzen |
| **Vertragsablauf-/Nachfass-Erinnerungen** | Hoch | 🟡 Vertragsdaten und Aufgaben vorhanden | Vorlaufzeiten, Eskalation, Laufhistorie und Wiederholungsregeln ergänzen |
| **After-Sales-Prozess** | Mittel | 🟡 Pipeline-Schritt `Nachbereitung` vorhanden | Echten vertragsbezogenen statt rein linearen Kontaktprozess modellieren |
| **Echte Dashboard-KPIs** | Hoch | 🟡 Mehrere Werte teilweise statisch | Leads, Aufgaben, Angebote, Abschlüsse und Conversion aus echten Daten berechnen |
| **Reporting & Analytics** | Mittel | 🟡 NL→SQL und Grundansichten vorhanden | Berechtigungen, Angebots-/Vertrags-KPIs, Zeiträume und Exporte erweitern |
| **Erweiterte Filter auf allen Listen** | Mittel | 🟢 Kontakte/Aufgaben weit fortgeschritten | Verbleibende Listen funktional angleichen |

---

## Phase D — Erweiterter KI-Kern, Produktreife und langfristiger Ausbau

**Ziel:** Erst nach stabilen Kernprozessen erweiterte KI-Funktionen und optionale
Produkt-/SaaS-Fähigkeiten umsetzen.

| Feature | Priorität | Stand | Nächster Schritt / Zielbild |
|---------|-----------|-------|-----------------------------|
| **Police ↔ AmisNow-Datenabgleich** | Hoch | 🔴 Nicht implementiert | Nach stabiler AmisNow-Anbindung Felder, Toleranzen und Prüfbericht definieren |
| **Abweichungs-/Deckungslückenerkennung** | Mittel | 🔴 Nicht implementiert | Fachregeln und nachvollziehbare Begründungen mit manueller Prüfung entwickeln |
| **Automatische Verkaufsargumente** | Mittel | 🔴 Nicht implementiert | Als Assistenzvorschlag mit Quellenbezug und Freigabe umsetzen |
| **Kündigungsschreiben vorbereiten** | Mittel | 🔴 Nicht implementiert | Beitragserhöhung/Ablauf erkennen und nur einen manuell freizugebenden Entwurf erzeugen |
| **Weitere KI-Agenten** | Niedrig | 🟡 AmisNow-Agent als erster MVP | Einsatzfelder einzeln priorisieren und jeweils mit eigener Abnahme planen |
| **Datenqualitäts-Agent** | Niedrig | ⚪ Nur Konzept (Stand 2026-08-15) | Prüft periodisch auf Inkonsistenzen: Status „Qualifiziert" ohne angelegtes Angebot, Status „Kunde" ohne Vertrag/Police, Status „Kontaktiert" bzw. offene Aufgabe seit X Tagen ohne Fortschritt. Ergebnis als Hinweisliste (Dashboard/eigene Seite), keine automatischen Änderungen. Noch nicht ausgereift — erst nach konkreterem Konzept umsetzen |
| **SaaS-/Mandantenfähigkeit** | Niedrig | 🟡 Auth/Rollen vorhanden, Mandantenmodell fehlt | Organisationen, Datenisolation und mandantenbezogene Konfiguration als separates Ausbauprojekt planen |
| **Kundenportal-Ausbau** | Niedrig | 🔴 Nicht implementiert | Nur nach eigener Minimallösung und konkretem Portal-MVP priorisieren |
| **DSGVO-Auskunfts- und Löschprozess** | Niedrig / zuletzt | 🟡 Archivierung vorhanden, vollständiger Prozess fehlt | Ganz am Ende von Phase D Aufbewahrung, Export, Freigabe und endgültige Löschung definieren |
| **Strategische KlickTipp-Ablösung** | Mittel | ⚪ Zielrichtung bestätigt, endgültige Entscheidung noch offen | Zuerst Tag-/Kampagnenabhängigkeiten, Einwilligungshistorie, Zustellung, Automationen und Reporting vollständig inventarisieren. Funktionen schrittweise in Sentimental Logic aufbauen und erst nach Parallelbetrieb sowie Datenmigration über die Abschaltung entscheiden. |

---

## Phasenübergreifend — iterativ einplanen

Diese Arbeiten sind keine einmaligen Abschlussblöcke. Sie werden in jeder Phase gemeinsam mit den
jeweiligen Features geplant und abgeschlossen.

| Thema | Verbindliche Arbeitsweise |
|-------|--------------------------|
| **Systemdokumentation** | Architektur, Konfiguration, Datenmodell, Integrationen und Betriebsabläufe nach jeder wesentlichen Änderung aktualisieren |
| **Tests & QA** | Für jedes Feature Abnahmekriterien und passende API-/E2E-Regressionstests ergänzen; vollständigen Katalog regelmäßig ausführen |
| **Benutzerschulung** | Neue oder geänderte Arbeitsabläufe phasenweise demonstrieren, kurz dokumentieren und mit den betroffenen Benutzern testen |
| **Release Notes** | Jede produktive Funktionsänderung in den In-App Release Notes festhalten |
| **Monitoring und Datenschutz** | Logging, Datenminimierung, Berechtigungen und externe Datenweitergabe bei jedem Integrationsfeature mitprüfen |
