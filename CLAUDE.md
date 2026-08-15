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
| **Version** | 0.32.0 — Angebote (Deal-/Angebotsnachverfolgung): neue Pipeline-Seite, Kontakt-Kachel, KI-Upload-Anbindung, Status-Automatik | Aktiv in Entwicklung |

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
| `angebote` | Angebots-/Deal-Nachverfolgung, eigenständiges Datenmodell (v0.32.0) | id, contact_id, name, status (in_erstellung/versendet/in_verhandlung/gewonnen/verloren), betrag, zyklus, sparte, leistungsumfang, dokument_id, created_by, archived_at |

### Supporting Tables

| Table | Purpose |
|-------|---------|
| `opportunities` | Removed from UI (v0.3.0) |
| `pipeline_stages` | Konfigurierbare 12-Schritt-Pipeline |
| `sync_log` | Ältere Sync-History für Lead-Import; besteht seit v0.25.0 additiv neben `sync_runs` weiter (nicht abgelöst) |
| `sync_runs` | Einheitliches Ausführungs-/Health-Log für alle Sync-Integrationen (`run_kind` batch/item, `parent_run_id`-Verschachtelung, Fehlerklassifikation, Retry-Felder) — Fundament des Automatisierungs-Läufe-Control-Centers (v0.25.0, Migration `0066_sync_runs.sql`) |
| `sync_config` | Zeitplan-Konfiguration für zeitgesteuerte Integrationen (Facebook, Dialfire-Pull); ersetzt die früheren `facebook_sync_config`/`dialfire_sync_config` (v0.25.0, Migration `0067_sync_config.sql`) |
| `klicktipp_webhook_events` | Rohprotokoll eingehender KlickTipp-Rücksync-Webhook-Events, dedupliziert über `event_fingerprint` (v0.9x-Ära, seit v0.25.0 zusätzlich an `sync_runs` + Retry angebunden) |

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
| **KlickTipp Outbound-Sync** | ✅ Live | Direkter Management-API-Client mit dediziertem API-User und Partner-HMAC-Fallback; Kontaktanlage, Änderungen, Regeln und Bestandsabgleich übertragen alle aktiven Kontakte mit E-Mail. Archivierte sowie technisch markierte Testkontakte werden automatisch ausgeschlossen. Regel-Läufe zeigen Erfolge, Fehler und übersprungene Übertragungen. Feldmapping inklusive Vor-/Nachname, Firma, Anschrift, Geburtstag (Unix-Zeitstempel) und optionalem Geschlechtsfeld (`field157376`). Der frühere Make-/Edge-Webhook-Weg wurde entfernt; ein markierter Kontakt-Pilot war erfolgreich. Seit v0.24.0: `klicktipp_id` ist jetzt in der Kontakt-UI sichtbar (Integrations-Sektion, Automation-Drawer, Aktivitäten-Timeline) statt nur in der DB gespeichert; das NL→SQL-Reporting-Schema kannte die KlickTipp-Spalten bis dahin nicht und lehnte entsprechende Abfragen fälschlich ab (behoben). |
| **KlickTipp Rücksync** | 🧪 Pilot aktiv | Abgesicherter, idempotenter Rückkanal für Einwilligungs-/Zustellstatus und E-Mail-, Kampagnen- sowie Tag-Ereignisse; Migration `0064_klicktipp_reverse_sync.sql`, geschützter Statusabgleich und manueller GitHub-Pilot sind ausgerollt. Ein Statuswechsel nach bestätigtem Opt-in wurde live erkannt. Der aktive Webhook `Sentimental Logic – Sentinel-Tag` (ID `176539`) protokolliert das Tag-Ereignis additiv und überschreibt keine ausgehenden Sentinel-Tags. Reale Öffnungs-, Klick- und Abmeldeereignisse müssen noch als End-to-End-Pilot geprüft werden. |
| **Dialfire Sync** | ✅ Done | Create-Pfad + Batch-Pfad; Edge Function mit per-Rule Task-Name; Payload: Alle Felder (Adresse, Industrie, Mitarbeiterzahl, etc.) |
| **Google Drive Dokumentenablage** | ✅ Done | Zentrale System-Ablage (nicht per-User); OAuth mit Auto-Refresh; Kompression (sharp für Bilder/75%, gzip Docs); Statistik-Tracking; Globales `/dokumente` + Kontakt-Tabs; bei Refresh-Token-Fehlern automatischer Admin-Alarm per Mail (Cooldown 6h, `src/lib/drive-token-alert.ts`) statt stillem Fehlschlag beim nächsten Mitarbeiter-Upload |
| **E-Mail-Benachrichtigungen** | ✅ Done | Resend API; Auto-Pfad (pro Kontakt) + Manuell-Pfad (Summary pro Lauf); Versendet wenn send_notification=true in Regel |
| **Kontakt-E-Mail (manuell)** | ✅ Done | `ContactEmailModal` + `POST /api/kontakte/[id]/email`: freier Compose mit optionalem Cc/Bcc (mehrere Adressen, Komma-getrennt), Datei-Anhängen (Resend-Limit 35MB) und Vorlagen-Dropdown (Platzhalter-Ersetzung, bleibt frei editierbar); Anhänge werden zusätzlich automatisch als Dokument (Kategorie „Sonstiges", `created_by=email`) beim Kontakt abgelegt — Ablage-Fehler blockieren den Versand nicht |
| **Regeln-Management** | ✅ Done | `/regeln` Page: Anlegen, Bearbeiten, Löschen, Manuelle Ausführung, Counter (runs), Benachrichtigungen. Seit v0.24.0: manuelle Ausführung bei großen Regeln (100+ passende Kontakte) brach mangels `maxDuration` am Vercel-Funktions-Timeout ab, ohne Fehler anzuzeigen, und begann bei jedem erneuten Klick wieder von vorne — behoben durch `maxDuration=300` + Skip-Logik für bereits synchronisierte Kontakte, sodass jeder Lauf tatsächlich Fortschritt macht. Zusätzlich zeigte die Lauf-Historie „KlickTipp nicht erfolgt" für längst erfolgreich synchronisierte Kontakte (implizites 1000-Zeilen-Limit einer unsortierten Abfrage, von Dialfire-Sync-Rauschen verdrängt) — ebenfalls behoben |
| **Dokumenten-Ordnerstruktur** | ✅ Done | Konfigurierbar je Kontakt-Typ (privat/gewerbe) in `/einstellungen/dokumente`; max. 2 Ebenen; Rename propagiert auf bestehende Drive-Ordner (drive_ordner_map); Kategorie-Dropdown + Filter beim Upload |
| **KI Upload** | ✅ Done | `/ki-upload`: Versicherungsdokument (PDF/Foto, auch gescannt) → Claude-Analyse (claude-opus-4-8, Vision + Structured Outputs) → Prüfmaske → Kontakt (Quelle ki_upload, E-Mail optional) + Drive-Ablage in passender Kategorie; Duplikat → anhängen; Vermittler wird nicht als Kontakt extrahiert. Seit v0.24.0: zwei Regressionen behoben — Kontaktanlage schlug nach Einführung des Login-Systems mit „Nicht angemeldet" fehl (interne Server-zu-Server-Fetches leiteten die Session-Cookie nicht weiter), und ein erkannter Vertrag wurde doppelt in `contracts`/Beitragsübersicht angelegt (zwei unabhängige Analyse-Läufe für dasselbe Dokument) |
| **Kommentare & @-Erwähnungen** | ✅ Done | Wiederverwendbare `CommentThread`-Komponente in Kontaktdetail-Kachel und Aufgaben-Bearbeiten-Modal; Einzel- und Gruppen-Erwähnung (`@Alle` → Einzel-Erwähnung pro aktivem User bei Erstellung), Datei-Anhang (nur wenn Kontakt auflösbar, sonst HTTP 400), E-Mail-Benachrichtigung pro Erwähnung, `/erwaehnungen`-Seite + Sidebar-Badge mit Ungelesen-Zähler |
| **Eingebaute Hilfe & Kundendokumentation** | ✅ Done | Rein statisches, im Code gepflegtes Hilfe-System (kein DB-Table, keine API-Route) — `~62` Artikel über `src/data/help/*.ts`. Kachel-genaue Hilfe per ❓-Symbol (`<HelpButton articleId="...">`, ~39 Einfügestellen) öffnet den passenden Artikel im globalen Drawer (`HelpProvider`); Taste `?` öffnet die Seiten-Standardhilfe (Prefix-Match für `/kontakte/[id]`, sonst Exact-Match), unterdrückt in Eingabefeldern und bei bereits offenem anderen Drawer/Modal; vollständiges durchsuchbares Handbuch unter `/hilfe` mit Bereichs-Gruppierung, Volltextsuche und Deep-Linking (`#<articleId>`, Scroll + Highlight) |
| **Beitragsübersicht (Sparten-Vergleich)** | ✅ Done | Digitale Version der Excel-Vorlage „Beitragsuebersicht_Vorlage_Allianz_Guen": eine laufende, unversionierte Übersicht pro Kontakt (`contacts.beitragsuebersicht` JSONB) mit Sparten-Tabelle (Alt-/Neu-Beitrag, Beginn, Ablauf, Bemerkung), automatisch berechneter Differenz/Summenzeile/Ersparnis-Box (nie persistiert, gemeinsames `beitragsuebersicht-calc.ts` für UI + PDF); beim ersten Öffnen mit den festen Privat-/Gewerbe-Sparten vorbelegt (`beitragsuebersicht-sparten.ts`), danach frei erweiterbar inkl. der Kfz-Flotten-Sammelzeile (editierbar/löschbar wie jede andere Zeile); Gewerbekunden mit 4+ Fahrzeugen können ein Flottenblatt aktivieren, dessen Summe automatisch in die Sparten-Zeile „Kfz-Flotte / Firmenfahrzeuge" einfließt (1–3 Fahrzeuge direkt in der Zeile); PDF-Export (`@react-pdf/renderer`) im Layout der Excel-Vorlage. Seit v0.23.0: Beiträge aus per KI erkannten Vertrags-Uploads werden nach expliziter Nutzerbestätigung als Zeile übernommen (📄-Badge kennzeichnet automatisch übernommene Zeilen); „Per E-Mail senden"-Button neben PDF-Export erzeugt ein frisches, zeitgestempeltes PDF und verschickt es über den bestehenden Kontakt-Mail-Versand inkl. automatischer Dokumenten-Ablage und Aktivitäten-Log, mit eigener Vorlage „Beitragsübersicht". Seit v0.27.0: Zyklus-Umschalter (monatlich/vierteljährlich/halbjährlich/jährlich) für die gesamte Übersicht mit explizitem Wechsel-Dialog (Beträge beibehalten vs. umrechnen); Vertragsupload-Übernahme fragt Spalte (Alt/Neu) und Zyklus des gelesenen Betrags aktiv ab (`BeitragsuebersichtUebernahmeForm.tsx`), statt automatisch zu schreiben — Rückfrage nur bei Dokumenttyp Vertrag/Police oder Angebot |
| **Sparten-Verwaltung & Erstgespräch-Leitfäden** | ✅ Done | Sparten sind eine feste, admin-gepflegte Liste (`/einstellungen/sparten`) statt Freitext; Kontakte können mehreren Sparten zugeordnet werden (n:m über `contact_sparte_map`, primäre Sparte hält die alte `contacts.sparte`-Spalte automatisch synchron, damit Dialfire/KlickTipp/Regeln unverändert weiterlaufen). Jede Sparte trägt ihren eigenen Erstgespräch-Leitfaden (Fragen + Felder), von Melih selbst pflegbar; die Erstgespräch-Kachel im Kontakt rendert bei mehreren zugeordneten Sparten jeden hinterlegten Leitfaden in einem eigenen Abschnitt |
| **Dokumenttyp-Erkennung & Folgeaufgabe** | ✅ Done | Die KI-Analyse beim Dokument-Upload (KI-Upload-Seite und direkter Upload im Kontakt) klassifiziert jedes Dokument als Vertrag/Police, Angebot, Nachtrag, Rechnung oder Sonstiges (`dokumente_metadata.dokumenttyp`) — kein zusätzlicher KI-Call, nur erstmals dauerhaft gespeichert. Bestätigungskarte nach Upload zeigt den erkannten Typ (korrigierbar); bei Typ Angebot Button „+ Aufgabe: Angebot nachverfolgen" (fällig in 3 Tagen). Dokumenttyp direkt in beiden Dokumentenlisten (Kontakt-Tab + globale `/dokumente`-Übersicht) editierbar und filterbar (Alle/Verträge/Angebote/Rechnungen/Sonstiges); Listen zugleich kompakter (Kompressions-Spalten entfernt, einzeilige Zeilen). Bugfix nachgezogen: der bestätigte Dokumenttyp ging beim KI-Upload-Commit-Pfad zunächst verloren (`skipVertragsanalyse` verhinderte die Persistierung) — behoben |
| **Angebote (Deal-/Angebotsnachverfolgung)** | ✅ Done | Eigenständiges Datenmodell (`angebote`-Tabelle, v0.32.0) statt der alten, seit v0.3.0 aus der UI entfernten `opportunities`-Tabelle (Code jetzt vollständig entfernt, siehe „❌ Removed"). Neue Hauptseite `/angebote` mit Karten-Pipeline (5 Status-Spalten: In Erstellung/Versendet/In Verhandlung/Gewonnen/Verloren, je mit Anzahl + Summe des monatlichen Beitrags) und Tabellen-Ansicht; Anlegen/Bearbeiten/Archivieren. Neue Kontakt-Kachel „Angebote" mit gleicher Funktionalität. Statuswechsel synchronisiert automatisch den Kontakt-Status (Angebot angelegt → mind. „Qualifiziert", „Gewonnen" → „Kunde", „Verloren" → „Nicht interessiert", nie herabstufen) inkl. Aktivitäten-Log (`angebot_created`/`angebot_status_changed`, standardmäßig fachlich sichtbar). KI-Upload-Prüfmaske und Kontakt-Dokumente-Tab bieten bei erkanntem Dokumenttyp „Angebot" die Übernahme in die Angebotsübersicht inkl. Status-Auswahl an (Betrag/Zyklus/Leistungsumfang werden aus der KI-Extraktion vorbefüllt). Bewusst nicht automatisiert: „Gewonnen" legt keinen Vertrag/keine Beitragsübersicht-Zeile automatisch an — nur ein Hinweisbanner mit Link zum Kontakt |

## Feature-Roadmap

> Ausgelagert in eine eigene Datei: **[`docs/ROADMAP.md`](docs/ROADMAP.md)** — dort stehen alle vier
> Phasen (A–D) mit Priorität, Stand und nächstem Schritt je Feature, plus die phasenübergreifenden
> Arbeitsweisen (Doku, Tests, Release Notes, Monitoring). Bereits implementierte Grundlagen bleiben
> zusätzlich im Abschnitt `Feature-Status` oben dokumentiert.
>
> **Aktueller Fokus (Stand 2026-08-15):** Phase A ist bei „Automation + Synchronisation
> vereinheitlichen" inkl. aller vier Unterpunkte (Cron/Scheduler, Log-Handling, Fehler-/Retry-Handling,
> Control-Center-UI) weiterhin vollständig ✅ Done (v0.25.0). Offene Hoch-Priorität-Punkte in Phase A:
> Vollständiger Regressionstest, Placetel Click-to-Call/Notify-Verarbeitung, KlickTipp-Rücksynchronisation
> (noch kein einziges reales Webhook-Event angekommen, siehe `docs/ROADMAP.md`), sowie neu vermerkt die
> **UI-/Branding-Überarbeitung** (einklappbare Sidebar, einheitliches Typo-/Style-System — noch nicht
> begonnen). Zusätzlich abseits der Phasenreihenfolge umgesetzt: „KI-Upload → Folgeaufgabe" (Phase C,
> Dokumenttyp-Erkennung + Folgeaufgabe bei Angebot, v0.30.0–v0.30.3) und die komplette
> „Entscheidung Angebotshandling" + „Angebotsverwaltung/-Tracking" (Phase B, v0.32.0, siehe
> „Recent Changes" unten) — beide jetzt ✅ Done statt 🔴/⚪. Neu nur konzeptionell vermerkt (Phase D):
> ein Datenqualitäts-Agent für Status-/Datenkonsistenz-Prüfungen.

### ❌ Removed

- Opportunities (aus UI entfernt v0.3.0, Code — Seite + API-Routen — vollständig entfernt v0.32.0
  zugunsten der neuen `angebote`-Tabelle; die alte `opportunities`-Tabelle selbst bleibt unangetastet
  in der DB, kein `DROP TABLE` ohne expliziten Wunsch)
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
| Angebote | `/angebote` | Angebots-/Deal-Pipeline (v0.32.0): Karten-Ansicht (Kanban, 5 Status-Spalten mit Anzahl + Summe mtl. Beitrag) und Liste (Tabelle); Anlegen/Bearbeiten/Archivieren; Statuswechsel synchronisiert automatisch den Kontakt-Status |
| Kontakt-Detail | `/kontakte/[id]` | Tab-Interface (Übersicht, Prozess, Aktivitäten, Aufgaben, Dialfire, Dokumente, Verträge, Angebote, Automation) + Tags-Leiste |
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

### v0.32.0 (2026-08-15) — Angebote (Deal-/Angebotsnachverfolgung)

Branch `feature/angebote-tracking`. Löst den seit langem offenen Roadmap-Punkt „Entscheidung
Angebotshandling" (Phase B): Angebote werden ein eigenständiges Datenmodell, an Brevos Deal-Pipeline
orientiert (Karten-Kanban + Liste, kompakte Karten mit Name/Kontakt/Wert/Status).

- ✨ Neue Tabelle `angebote` (Migration `0072_angebote.sql`): Name, Status
  (in_erstellung/versendet/in_verhandlung/gewonnen/verloren), Betrag + Zyklus (roh gespeichert, mtl.
  Beitrag wird live berechnet über `konvertiereBetrag()` aus `beitragsuebersicht-zyklus.ts` — nie
  persistiert, gleiches Muster wie die Beitragsübersicht), Sparte, Leistungsumfang (Freitext),
  `dokument_id`-Verknüpfung, Soft-Delete via `archived_at`.
- ✨ Neue Hauptseite `/angebote` (neuer Sidebar-Eintrag zwischen Kontakte und Aufgaben): Umschaltbare
  Karten- (5 Status-Spalten, je mit Anzahl + Summe des monatlichen Beitrags) und Listen-Ansicht,
  Such-/Statusfilter, Anlegen/Bearbeiten/Archivieren-Modal (`ContactSearchSelect` wiederverwendet).
- ✨ Neue Kontakt-Kachel „Angebote" (`KontaktAngeboteTab.tsx`, eigener `DrawerId`): kompakte
  Übersichts-Kachel (Anzahl + Gesamtwert/Monat) + Drawer mit derselben CRUD-Funktionalität wie die
  Hauptseite, kontaktgebunden.
- ✨ **Status-Automatik**: Ein neues Angebot hebt den Kontakt-Status mindestens auf „Qualifiziert" (nie
  herabstufen — ein bestehender Kunde bleibt Kunde); Status „Gewonnen" → Kontakt „Kunde", „Verloren" →
  Kontakt „Nicht interessiert". Beide Wege inkl. `logStatusChanged()` und neuen Aktivitätstypen
  `angebot_created`/`angebot_status_changed` (bewusst nicht in `istTechnisch()` aufgenommen, damit sie
  standardmäßig in der fachlichen Kontakthistorie sichtbar sind).
- ✨ **KI-Upload-Prüfmaske**: bei erkanntem Dokumenttyp „Angebot" erscheint ein Block „Als Angebot in die
  Angebotsübersicht aufnehmen" mit editierbarem Namen (vorbefüllt aus Versicherungstyp/-gesellschaft)
  und Status-Auswahl (Default „Versendet" — das hochgeladene Dokument ist das bereits versendete
  Angebot). Bei Bestätigung legt `commit/route.ts` das Angebot nach dem Drive-Upload an (Betrag/Zyklus
  aus der KI-Extraktion geparst, Leistungsumfang aus `benefits[]` zusammengefasst, `dokument_id` gesetzt).
- ✨ **Kontakt-Dokumente-Tab**: die bestehende Dokumenttyp-Bestätigungskarte (v0.30.0) bekommt bei Typ
  „Angebot" zusätzlich zum vorhandenen „+ Aufgabe: Angebot nachverfolgen"-Button einen
  Status-Dropdown + „Als Angebot übernehmen"-Button (Name wird aus dem Dateinamen abgeleitet).
- 🧹 **Aufgeräumt**: die alte, seit v0.3.0 aus der UI entfernte `opportunities`-Funktionalität (Seite
  `/opportunities`, API-Routen `/api/opportunities(/[id])`, toter Query in
  `GET /api/kontakte/[id]`) vollständig aus dem Code entfernt — passte konzeptionell nicht zum
  gewünschten Angebots-Lifecycle. Die DB-Tabelle selbst bleibt unangetastet (kein `DROP TABLE` ohne
  expliziten Wunsch).
- ⚠️ **Bewusst nicht automatisiert** (Nutzer-Entscheidung): „Gewonnen" legt keinen Vertrag/keine
  Beitragsübersicht-Zeile automatisch an. Stattdessen zeigt sowohl `/angebote` als auch die
  Kontakt-Kachel ein Hinweisbanner „✓ Angebot gewonnen — Beitragsübersicht ggf. aktualisieren" mit Link
  zum Kontakt. Sollte das später automatisiert werden (Roadmap-Punkt „Angebotsannahme → Vertrag",
  Phase B), muss die Beitragsübersicht-Logik entsprechend erweitert werden.
- ⚠️ Migration muss vom Nutzer manuell in Supabase ausgeführt werden (Projekt-Konvention)

### v0.31.0 (2026-08-15) — Sparte wird beim Dokument-Upload erkannt und zur Zuordnung angeboten

Branch `feature/sparte-erkennung-upload`. Ausgangspunkt: die KI extrahiert beim Dokument-Upload
bereits eine Sparte, aber `POST /api/ki-upload/commit` schrieb sie direkt in `contacts.sparte` — seit der
Umstellung auf die n:m-Tabelle `contact_sparte_map` (v0.20.0) nur noch ein automatisch mitgeführter
Spiegel der primären Sparte, nicht mehr die tatsächliche Quelle für UI/Erstgespräch-Leitfaden. Die Sparte
landete dadurch unsichtbar, wirkte für den Nutzer wie „nicht erkannt".

- ✨ **KI-Upload-Prüfmaske**: erkennt die KI eine Sparte, die dem (neuen oder per Duplikat-Erkennung
  bestehenden) Kontakt noch nicht zugeordnet ist, erscheint eine Checkbox „Sparte „X" zuordnen" mit Wahl
  Hauptsparte/zusätzliche Sparte. Ist die Sparte in den Einstellungen noch nicht angelegt, wird das
  angezeigt und sie beim Bestätigen automatisch neu angelegt (kein Abgleich/Fuzzy-Matching — exakter
  Namensvergleich reicht für den Anwendungsfall). Ist sie dem Zielkontakt bereits zugeordnet, erscheint
  gar keine Abfrage. Die alte, fehlerhafte direkte `contacts.sparte`-Schreibung wurde entfernt.
- ✨ **Kontakt-Dokumente-Tab**: gleiche Logik als Bestätigungskarte nach dem Upload (analog zur
  Dokumenttyp-Karte aus v0.30.0), da es hier keinen Prüfmaske-Schritt vor dem Speichern gibt.
  `POST /api/kontakte/[id]/dokumente` liefert dafür einen `sparteVorschlag` in der Antwort (nur wenn
  noch nicht zugeordnet).
- 🐛 **Beim Testen entdeckt und behoben**: `GET /api/kontakte/[id]/sparten` hatte kein
  `dynamic='force-dynamic'`/`fetchCache='force-no-store'` gesetzt und lief dadurch über den Next.js Data
  Cache — ein direkt nach einem `PUT` (Sparte setzen) folgender `GET` konnte noch den alten, in einem Fall
  sogar leeren Stand liefern. Das hätte die neue „zusätzliche Sparte hinzufügen"-Funktion (liest zuerst
  den aktuellen Satz, ergänzt dann) im schlimmsten Fall bestehende Sparten-Zuordnungen überschrieben —
  live reproduziert und nach dem Fix verifiziert (u.a. betrifft derselbe Cache-Bug auch die bestehende
  `SparteMultiSelect`-Komponente in der Kontaktübersicht, unabhängig von dieser Änderung). Gleiches
  Bug-Muster wie v0.11.2 bei `/api/dokumente`.
- ✅ Live gegen einen echten (danach wieder archivierten) Testkontakt verifiziert: neue Sparte wurde
  korrekt angelegt und als Hauptsparte zugeordnet, `contacts.sparte`-Spiegel korrekt synchron; eine zweite
  Sparte als „zusätzliche Sparte" ergänzt, ohne die erste zu verlieren (nach dem Cache-Fix).

### v0.30.3 (2026-08-13) — Bugfix: Dokumenttyp ging bei KI-Upload-Dokumenten verloren

**Gemeldetes Symptom:** Bei einem über KI-Upload hochgeladenen Angebot wird — anders als beim direkten
Upload im Kontakt-Dokumente-Tab — keine Aufgabe „Angebot nachverfolgen" angeboten.

- 🔍 Die Angebots-Erkennung auf der `/ki-upload`-Seite selbst (Prüfmaske + „Fertig"-Bildschirm) war korrekt
  verdrahtet und funktioniert im selben Durchlauf. Der eigentliche Fehler lag eine Ebene tiefer: `POST
  /api/ki-upload/commit` ruft zur Drive-Ablage intern `POST /api/kontakte/[id]/dokumente` mit
  `skipVertragsanalyse=true` auf (verhindert eine teure Doppel-Analyse, siehe v0.24.0) — ohne diese Analyse
  blieb dort aber `extraktion` (und damit der bereits von der KI erkannte und vom Nutzer in der Prüfmaske
  bestätigte Dokumenttyp) `null`. Das frisch angelegte Dokument landete dadurch immer als „— nicht
  klassifiziert —" in der Kontakt-Dokumentenliste — ohne Badge, ohne Möglichkeit, von dort aus die
  Folgeaufgabe anzustoßen, obwohl der Typ längst bekannt war.
- ✅ Fix: `commit/route.ts` gibt den in der Prüfmaske bestätigten `dokumenttyp` jetzt explizit als
  Formularfeld an die Dokumente-Route weiter; diese übernimmt einen gültigen Override-Wert direkt, auch
  wenn wegen `skipVertragsanalyse` keine eigene Analyse läuft.
- ⚠️ Nicht rückwirkend behoben: vor diesem Fix über KI-Upload angelegte Dokumente bleiben
  „nicht klassifiziert" (lassen sich aber wie jedes andere Dokument über das Dropdown in der Liste manuell
  nachkorrigieren — danach ist auch die Folgeaufgabe-Aktion dort wieder relevant, s. v0.30.2).
- ℹ️ Konnte lokal nicht Ende-zu-Ende nachgestellt werden (Google Drive in dieser Dev-Umgebung nicht
  verbunden, bekannte Einschränkung) — Fix basiert auf Code-Analyse + Auswertung echter Produktionsdaten
  (Dokument- und Aufgaben-Zeitstempel eines realen Testkontakts), die exakt zum gemeldeten Symptom passten.

### v0.30.2 (2026-08-13) — Kontakt-Dokumente-Tab: gleiche Vereinfachung wie globale Übersicht

Auf Nutzerwunsch dieselbe Bereinigung wie v0.30.1 auch im Kontakt-Dokumente-Tab (`KontaktDokumenteTab.tsx`)
umgesetzt, dabei zusätzlich kompakter als vorher:

- 🎨 Jede Dokumentzeile war bisher zweizeilig (Datei/Badges in Zeile 1, „Original: X → Komprimiert: Y" in
  Zeile 2, plus ein separater grüner „↓ N%"-Ersparnis-Chip rechts). Komplett entfernt — jede Zeile ist
  jetzt einzeilig: Datei + ✏️ + Kategorie-Badge, danach ein editierbares Dokumenttyp-Dropdown (identisch
  zur globalen Übersicht, direkt in der Liste statt nur über die Bestätigungskarte nach dem Upload),
  Datum, Löschen.
  Der redundante zweite „Öffnen ↗"-Link entfernt (Dateiname selbst verlinkt bereits zu Drive).
- 🎨 Der „✓ Speicher gespart: … durch Komprimierung"-Hinweis unterhalb der Liste entfernt (gleiche
  Kategorie irrelevanter Information wie die entfernten Spalten in v0.30.1).
- ℹ️ Die Bestätigungskarte nach dem Upload (Dokumenttyp-Vorschlag + „+ Aufgabe: Angebot nachverfolgen")
  bleibt bestehen — sie ist weiterhin der proaktive Hinweis direkt nach dem Hochladen, das neue Dropdown
  in der Liste ist für spätere Korrekturen.

### v0.30.1 (2026-08-13) — Dokumente-Übersicht überarbeitet, Kontakt-Änderungen erstmals protokolliert

- 🎨 Globale `/dokumente`-Tabelle: Spalten „Original → Komprimiert" und „Ersparnis" entfernt (auf
  Nutzerwunsch, im Alltag irrelevant), stattdessen editierbare Spalte „Dokumententyp" (Dropdown, PATCH
  wie im Kontakt-Dokumente-Tab). Dateiname jetzt auch hier per ✏️ umbenennbar (bisher nur im Kontakt-Tab).
- 🐛 **Gefunden bei der Fehlersuche zu einem konkreten Kundenfall** (Kontakt zunächst als „Alexander Herr"
  angelegt, zwei Dokumente hochgeladen, danach auf „Werner Hippler" umbenannt): Namensänderungen an
  Kontakten waren **nirgends nachvollziehbar**. `logContactUpdated()` (`src/lib/activities-logger.ts`)
  existierte bereits vollständig, wurde aber nie aus `PATCH /api/kontakte/[id]` aufgerufen — nur
  Pipeline-Stufe und Status wurden geloggt. Jetzt behoben: vor dem Update werden die alten Werte einer
  kuratierten Feldliste (`LOGGABLE_FIELDS` — Name, Kontaktdaten, Adresse, Notizen, Firma, Sparte etc.,
  bewusst ohne Sync-/interne Felder) geladen, nach dem Update wird ein lesbarer Diff
  („Kontakt aktualisiert: … Änderungen: firstname: X → Y") in die Aktivitäten-Timeline geschrieben. Live
  gegen einen Testkontakt verifiziert (Firmenname + Notiz geändert → korrekter Aktivitäts-Eintrag mit
  Alt-/Neu-Werten).
- ⚠️ **Bewusst noch NICHT behoben, nur dokumentiert** (Nutzer-Entscheidung, für später vorgemerkt): Der
  Google-Drive-Ordner eines Kontakts wird bei jedem Upload über `findOrCreateContactFolder()`
  (`src/lib/google-drive-oauth.ts`) per Namens-String gesucht (`"Vorname Nachname (kontaktId)"`) — die
  bereits gespeicherte `contacts.google_drive_ordner_id` wird dabei nie gelesen, nur nach dem Upload
  geschrieben. Nach einer Kontakt-Umbenennung findet die Namenssuche den alten Ordner nicht mehr und legt
  beim nächsten Upload einen **zweiten, neuen Ordner** an (Dokumente bleiben im CRM korrekt verknüpft,
  aber in Drive entstehen doppelte Kundenordner). Am konkreten Fall (Werner Hippler, vormals Alexander
  Herr) noch nicht ausgelöst, da seit der Umbenennung kein weiterer Upload stattfand — tritt beim
  nächsten Dokument-Upload für diesen Kontakt auf, wenn nicht vorher behoben.

### v0.30.0 (2026-08-13) — Dokumenttyp-Erkennung (Vertrag/Angebot/Rechnung/Sonstiges), Folgeaufgabe bei Angebot, kompaktere Dokumente-Ansicht

Branch `feature/dokumenttyp-erkennung`. Die KI-Analyse, die beim Dokument-Upload ohnehin schon läuft
(bisher nur für Vertragserkennung/Beitragsübersicht genutzt, `src/lib/ki-upload.ts`), liefert bereits
einen Dokumenttyp (`police`/`angebot`/`nachtrag`/`rechnung`/`sonstiges`) — der wurde bisher nirgends
dauerhaft gespeichert. Kein zusätzlicher KI-Call nötig.

- ✨ Migration `0071_dokumenttyp.sql`: neue Spalte `dokumente_metadata.dokumenttyp` (nullable, CHECK auf
  die 5 bekannten Werte). `NULL` = nicht klassifiziert (Analyse fehlgeschlagen/nicht unterstützter
  Dateityp), wird in der UI wie „Sonstiges" behandelt.
- ✨ Neues gemeinsames Modul `src/lib/dokumenttyp.ts`: Labels, Optionen und Filter-Bucket-Mapping
  (`nachtrag` zählt bewusst zum Filter „Verträge" — inhaltlich eine Vertragsänderung — der genaue Typ
  bleibt aber pro Dokument gespeichert, nur die UI gruppiert ihn ein).
- ✨ `POST /api/kontakte/[id]/dokumente` speichert `dokumenttyp` direkt beim Insert; `PATCH` erlaubt jetzt
  zusätzlich zum Umbenennen auch die Korrektur des Dokumenttyps.
- ✨ **Bestätigung im Kontakt-Dokumente-Tab**: nach jedem Upload erscheint eine nicht-blockierende Karte
  „📄 Dokument erkannt als: [Typ] [korrigierbar ▾]". Bei Typ **Angebot** zusätzlich ein Button
  „+ Aufgabe: Angebot nachverfolgen" — öffnet den bestehenden Aufgaben-Dialog vorbefüllt (Titel, fällig in
  3 Tagen; gleiches Muster wie „+ Aufgabe: Folgetermin anlegen" im Erstgespräch), der Nutzer bestätigt vor
  dem Speichern. Dafür `openNewTaskWithTitle()` in `kontakte/[id]/page.tsx` um einen optionalen
  Fälligkeits-Offset erweitert.
- ✨ **KI-Upload-Seite**: die Prüfmaske hatte das Dokumenttyp-Dropdown bereits (jetzt aus dem gemeinsamen
  Modul); neu ist ein „+ Aufgabe: Angebot nachverfolgen anlegen"-Button in der „Fertig"-Phase bei Typ
  Angebot — legt die Aufgabe direkt per `POST /api/aufgaben` an (kein eingebetteter Dialog auf dieser
  Seite), zugewiesen an den aktuell angemeldeten User (`GET /api/me`).
- ✨ **Filter „Alle · Verträge · Angebote · Rechnungen · Sonstiges"** zusätzlich zum bestehenden
  Kategorie-Filter — sowohl im Kontakt-Dokumente-Tab als auch in der globalen `/dokumente`-Übersicht;
  Dokumenttyp-Badge (indigo) neben dem bestehenden Kategorie-Badge in beiden Listen.
- 🎨 **Kompaktere obere Bereiche** (Nutzerwunsch): Kontakt-Dokumente-Tab fasst Kategorie-Auswahl und
  Upload-Dropzone zu einer einzigen schlanken Zeile zusammen (vorher: separate Zeile + hohe Dropzone mit
  großem Icon) — deutlich weniger Leerraum vor der eigentlichen Dokumentenliste. Globale
  `/dokumente`-Seite: Titel/Stats/Google-Drive-Link in einer Zeile statt gestapelter Karten, Suche und
  Typ-Filter in einer Zeile.
- ⚠️ Bestandsdokumente (vor dieser Änderung hochgeladen) haben `dokumenttyp = NULL` und erscheinen unter
  „Sonstiges" — kein rückwirkendes Reklassifizieren (würde eine erneute KI-Analyse aller gespeicherten
  Dateien erfordern, out of scope).
- ⚠️ Migration muss vom Nutzer manuell in Supabase ausgeführt werden (Projekt-Konvention)

### v0.29.0 (2026-08-13) — Erstgespräch Unternehmerschutz: Mitarbeiterzahl aufgeschlüsselt (Vollzeit/Teilzeit/Minijob)

Die Frage „Wie viele Mitarbeiter haben Sie?" im Unternehmerschutz-Leitfaden fragte bisher nur die
Gesamtzahl ab (`mitarbeitanzahl`). Auf Wunsch um drei Unterfelder ergänzt.

- ✨ Migration `0070_mitarbeiter_aufschluesselung.sql`: neue Spalten `contacts.mitarbeiter_vollzeit`,
  `mitarbeiter_teilzeit`, `mitarbeiter_minijob` (integer, nullable); dieselbe Migration erweitert per
  `UPDATE` das `felder`-Array der Frage `mitarbeiter` im admin-gepflegten Leitfaden der Sparte
  „Unternehmerschutz" (`sparten.leitfaden_fragen`, siehe v0.20.0) — reines Datenupdate, kein Code nötig,
  da `ErstgespraechPanel.tsx` und der PDF-Export (`erstgespraech-pdf.tsx`/`.../erstgespraech/pdf/route.ts`)
  Fragen/Felder bereits generisch aus der DB rendern
- ✨ Neue Felder auch in `ContactOverview.tsx` (Sektion „Unternehmen & Branche" → Grunddaten, neben
  „Mitarbeiterzahl"), in `report-schema.ts` (NL→SQL-Reporting) und in der `ALLOWED_UPDATE_FIELDS`-Liste
  von `PATCH /api/kontakte/[id]` ergänzt
- ℹ️ Bewusst nicht angefasst: CSV-Export (`GET /api/kontakte/export?format=csv`) liest alle
  `contacts`-Spalten per `select('*')` und zeigt die neuen Felder dadurch automatisch ohne Code-Änderung;
  Excel-/PDF-Export nutzen ein kuratiertes Übersichts-Spaltenset, das selbst die bestehende
  `mitarbeitanzahl` nicht enthält — die neuen Felder folgen hier bewusst demselben Muster
- ⚠️ Migration muss vom Nutzer manuell in Supabase ausgeführt werden (Projekt-Konvention)

### v0.28.0 (2026-08-11) — Dokument-Upload: Ablage-Kategorie automatisch aus der Kontakt-Sparte vorbelegen

Beim Dokument-Upload am Kontakt (`KontaktDokumenteTab.tsx`) musste die Ablage-Kategorie („Ablegen unter")
bislang bei jedem Upload manuell gewählt werden (Default immer „Sonstiges"). Wird jetzt anhand der primären
Sparte des Kontakts automatisch vorbelegt — der Nutzer kann die Vorbelegung weiterhin jederzeit über das
unverändert vollständige Dropdown überschreiben.

- ✨ **Neuer Helper `src/lib/sparte-kategorie-match.ts`**: `findeKategorieFuerSparte(sparte, kategorien)` —
  normalisierter Teilstring-Abgleich (Kleinschreibung, „versicherung"-Suffix entfernt, Sonderzeichen
  raus) zwischen Sparten-Namen (`sparten`-Stammdaten, z.B. „KFZ", „Haftpflicht", „PKV") und den
  konfigurierbaren Ablage-Kategorien (`system_config` „dokument_ordnerstruktur"). Bewusst kein festes
  1:1-Mapping, da beide Listen unabhängig voneinander gepflegt werden — liefert `null` bei
  Uneindeutigkeit, dann bleibt „Sonstiges" der Default und der Nutzer wählt manuell.
- ✨ **Abkürzungs-Auflösung** für gängige Initialismen, die als Teilstring nie gegen ausgeschriebene
  Kategorienamen treffen würden (PKV, PHV, BU, BAV, BKV) — z.B. Sparte „PKV" → Kategorie
  „Private Krankenversicherung", live verifiziert.
- ✨ `KontaktDokumenteTab.tsx` bekommt eine neue Prop `primarySparte`, von `src/app/kontakte/[id]/page.tsx`
  aus der primären Sparte (`contact_sparte_map`) bzw. ersatzweise `contacts.sparte` befüllt; die
  Vorbelegung passiert einmalig beim Laden der Kategorie-Liste in `loadDokumente()`, danach frei
  editierbar wie bisher.

### v0.27.1 (2026-08-11) — Beitragsübersicht: Nachbesserungen aus Live-Test

Drei kleine Korrekturen nach dem ersten Live-Test von v0.27.0:

- 🐛 **Statische Kontaktdetail-Kachel war nicht zyklusbewusst**: die kompakte Übersichts-Kachel auf der
  Kontaktdetailseite (`src/app/kontakte/[id]/page.tsx`, außerhalb des Editors) zeigte immer „… / Jahr",
  unabhängig vom gewählten Zyklus. Zeigt jetzt `ZYKLUS_LABEL[kontakt.beitragsuebersicht.zyklus]` wie der
  Editor selbst.
- ✨ **Editor-Drawer verbreitert** (`widthClass` von `max-w-4xl` auf `max-w-[1400px]`): die Sparten-Tabelle
  (9 Spalten) passt jetzt auf gängigen Desktop-Auflösungen (getestet 1440px/1600px) komplett ins Blickfeld
  ohne horizontales Scrollen, statt fix auf 896px begrenzt zu sein.
- ✨ **Bemerkung-Feld vergrößert**: von einem einzeiligen `<input>` (140px) zu einem mehrzeiligen,
  vertikal ziehbaren `<textarea>` (min. 220px, `resize-y`) in Sparten- und Flotten-Tabelle — längere Texte
  werden nicht mehr abgeschnitten.

### v0.27.0 (2026-08-11) — Beitragsübersicht: Zyklus, editierbare Flotten-Zeile, gesteuerte Vertragsupload-Übernahme

Löst drei zusammenhängende Lücken der Beitragsübersicht: bislang fest auf Jahresbeiträge verdrahtet, die
Kfz-Flotten-Sammelzeile war schreibgeschützt ohne Löschen-Option, und Vertrags-/Angebotsuploads schrieben
den erkannten Beitrag automatisch (ohne Rückfrage, ohne Zyklus-Kenntnis) in die Übersicht.

- ✨ **Zyklus-Umschalter** (monatlich/vierteljährlich/halbjährlich/jährlich) oben in der Beitragsübersicht,
  gilt für die gesamte Übersicht (`Beitragsuebersicht.zyklus`, neues Feld im bestehenden
  `beitragsuebersicht`-JSONB — keine neue Migration nötig). Neuer Helper
  `src/lib/beitragsuebersicht-zyklus.ts` (`ZAHLUNGEN_PRO_JAHR`, `erkenneZyklus()`,
  `konvertiereBetrag()`). `berechneSummen()` normalisiert Ersparnis/Mehrbeitrag jetzt zyklusbewusst,
  kollabiert bei `zyklus='jaehrlich'` exakt auf die bisherige Formel (rückwärtskompatibel für
  Alt-Kontakte ohne `zyklus`-Feld). Spaltenköpfe, Summenzeile und PDF-Footer beschriften sich dynamisch.
- ✨ **Zyklus-Wechsel-Dialog**: beim Umschalten auf einer bereits befüllten Übersicht fragt ein
  Inline-Dialog explizit „Beträge beibehalten" vs. „Beträge umrechnen" (mit Beispielrechnung), bevor
  etwas geändert wird — nie eine stille Umrechnung.
- ✨ **Flotten-Sammelzeile ist jetzt normal editierbar und löschbar** wie jede andere Sparten-Zeile
  (`BeitragsuebersichtPanel.tsx`): der bisherige Schreibschutz (`<strong>`-Anzeige statt `<input>`, kein
  ✕-Button) entfällt; die automatische Summenbildung aus den Fahrzeugzeilen bleibt als Komfort erhalten
  (synct bei jeder Fahrzeug-Änderung), kann danach aber manuell überschrieben werden.
- ✨ **Gesteuerte Vertragsupload-Übernahme statt automatischem Schreiben**: `uebernehmeVertragInBeitragsuebersicht()`
  (`src/lib/beitragsuebersicht-uebernahme.ts`) läuft nur noch nach expliziter Bestätigung, mit
  Zyklus-Umrechnung falls der Dokument-Zyklus vom Übersichts-Zyklus abweicht. Neue geteilte Komponente
  `BeitragsuebersichtUebernahmeForm.tsx` (Übernehmen-Checkbox, Spalten-Auswahl Alt/Neu, Zyklus-Auswahl —
  Pflichtfeld wenn `erkenneZyklus()` uneindeutig ist) wird von beiden Upload-Pfaden genutzt: `/ki-upload`
  zeigt sie inline in der Prüfmaske (inkl. neu editierbarem `dokumenttyp`-Feld zur KI-Korrektur), der
  Direkt-Upload am Kontakt (`KontaktDokumenteTab.tsx`) zeigt sie in einem neuen Bestätigungs-Modal nach
  erfolgreichem Upload (neue Route `POST /api/kontakte/[id]/beitragsuebersicht/uebernahme`). Die Rückfrage
  erscheint nur bei Dokumenttyp Vertrag/Police oder Angebot, nicht bei Nachtrag/Rechnung/Sonstiges.
- 🐛 **KI-Prompt-Fix**: „Derya Gün" fehlte in der Eigenvertrag-Erkennungsregel (`src/lib/ki-upload.ts`),
  nur „Melih Gün" wurde erkannt — ergänzt.

### v0.26.0 (2026-08-11) — Gewerbedaten-Recherche in die Gesprächsvorbereitung integriert

Löst den seit Projektbeginn offenen Roadmap-Punkt „Gewerbedaten-Recherche" auf Wunsch des Nutzers nicht als
eigenständiges Feature, sondern als Erweiterung der bereits produktiven KI-Gesprächsvorbereitung
(`src/lib/call-prep.ts`).

- ✨ **Neuer Helper `src/lib/company-research.ts`**: `generateCompanyResearch()` nutzt Claudes serverseitiges
  `web_search`-Tool (`web_search_20260209`) kombiniert mit Structured Outputs (`output_config.format`) in
  einem einzigen `messages.create()`-Aufruf — löst die offene „zulässige Datenquellen"-Frage der Roadmap
  pragmatisch über das öffentliche Web statt einer kostenpflichtigen Handelsregister-API. Gleiche
  „Erfinde NICHTS"-Prompt-Disziplin wie `call-prep.ts`: Felder bleiben `null` ohne echten Beleg, jedes
  gefüllte Feld braucht eine Quelle, komplett leeres Ergebnis bei fehlender Web-Präsenz ist explizit
  korrektes Verhalten.
- ✨ **Cache statt Live-Recherche pro Öffnen**: Ergebnis wird in der neuen Spalte `contacts.gewerbe_recherche`
  (JSONB, Migration `0068_gewerbe_recherche.sql`) mit Zeitstempel persistiert. `ensureGewerbeRecherche()`
  recherchiert nur beim allerersten Öffnen eines Gewerbekontakts ohne Cache; ein neuer „🔎 Firma erneut
  recherchieren"-Button in `CallPrepPanel.tsx` erzwingt bei Bedarf eine frische Recherche
  (`refreshGewerbeRecherche()`).
- ✨ **`/api/agents/call-prep`** ruft die Recherche vor der Kontextaggregation auf (No-Op für Privatkunden/
  ohne Firmenname, Fehler blockieren die eigentliche Gesprächsvorbereitung nicht), `maxDuration` von 60 auf
  120 erhöht. `call-prep.ts`s `buildPrompt()` hängt bei vorhandenem Ergebnis eine neue Sektion an, mit der
  expliziten Anweisung, die Recherche nur als Kontext für `talking_points` zu nutzen, nie als von Melih
  bereits geprüften Fakt darzustellen.
- ✨ **Bewusst keine automatische Übernahme in die Kontaktfelder** (Branche/Rechtsform/Mitarbeiterzahl) —
  Nutzer-Entscheidung: Recherche-Ergebnis erscheint nur als Anzeige-Sektion in der Gesprächsvorbereitung
  (Kurzprofil, Badges, anklickbare Quellen), `ContactOverview.tsx` bleibt unangetastet.

### v0.25.0 (2026-08-11) — Automation/Sync-Architektur vereinheitlicht: sync_runs, Retry, Control-Center

Mehrwöchiges Vorhaben (Branch `feature/sync-runs-fundament`, 6 Phasen, nach ausführlichem Live-Testen
konfliktfrei in `main` gemerged) zur Vereinheitlichung der bis dahin 6+ unabhängigen Sync-/
Automation-Pfade, jeder mit eigenem Fehler-Handling und uneinheitlicher Sichtbarkeit. Ziel war
ausdrücklich kein Neubau, sondern additives Zusammenführen unter einem gemeinsamen Datenmodell.

- ✨ **Neues gemeinsames Ausführungsmodell `sync_runs`** (Migration `0066_sync_runs.sql`): `run_kind`
  (`batch`/`item`) mit `parent_run_id`-Verschachtelung (ein Batch-Lauf pro Cron-Tick/Klick, N
  Item-Zeilen pro Kontakt darunter), `trigger_type` (`auto`/`manual`/`cron`/`webhook`),
  Fehlerklassifikation (`error_class`/`error_detail`) und Retry-Felder
  (`attempt_count`/`max_attempts`/`next_retry_at`). Rein additiv — `activities`, `sync_log` und
  `dialfire_sync_log` bestehen unverändert parallel weiter.
- ✨ **9 Integrationen migriert**: KlickTipp-Push, Dialfire-Push, Dialfire-Pull, Facebook, SuperChat,
  STRATO-Kalender, STRATO-Mail, KlickTipp-Rücksync-Webhook und CSV-Import schreiben jetzt einheitlich
  über `runWithTracking()`/`recordRunStart()`/`recordRunOutcome()`
  (`src/lib/sync-runs/retry-runner.ts`) in `sync_runs`.
- ✨ **Automatisches + manuelles Retry** (`src/lib/sync-runs/retry-handlers.ts`, `classifyError()`
  in `src/lib/sync-runs/error-classification.ts`) für 7 der 9 Integrationen — läuft alle 15 Minuten
  als Piggyback im Facebook-Cron mit, zusätzlich sofort auslösbar per „Jetzt synchronisieren" auf den
  ereignisgetriggerten Kacheln (`POST /api/sync-runs/retry-all`). Bewusst **kein** Auto-Retry für
  STRATO-Mail — E-Mail-Versand ist nicht idempotent, ein Retry könnte eine bereits zugestellte Mail
  ein zweites Mal an einen echten Menschen schicken; Fehlschläge landen dort immer direkt als
  `dead_letter`.
- ✨ **Einheitliche Zeitplan-Tabelle `sync_config`** (Migration `0067_sync_config.sql`) ersetzt die
  beiden fast identischen `facebook_sync_config`/`dialfire_sync_config`; gemeinsamer
  Due-Check-Helper (`src/lib/sync-runs/sync-config.ts`).
- ✨ **Control-Center**: `/sync` zeigt jetzt echte Gesundheitsdaten pro Integration (einheitliches
  `SyncStatusBadge`-Vokabular, 6 Zustände, statt der vorherigen hartcodierten Fake-Status), eine
  „Automatisierungs-Läufe"-Tabelle mit Retry/Pause pro Zeile und aufklappbarem Batch-Detail (Status
  pro einzelnem Kontakt/Lead statt nur einer Sammel-Fehlerzahl). `/sync` und `/regeln` sind über eine
  gemeinsame „Automatisierungen"-Tab-Leiste verbunden (ein Sidebar-Eintrag statt zwei), ohne die
  Datenmodelle zu verschmelzen — Regeln bleiben die Business-Logik-Schicht, `sync_runs` die
  Ausführungs-/Health-Schicht darunter.
- 🐛 **Facebook-Lead-Details zeigten „Unbekannt"** im Batch-Detail. Rohe Facebook-Lead-Objekte
  (`data.lead` in `sync_runs`) haben keine Top-Level-`email`/`name`-Felder — die entstehen erst nach
  dem Mapping. Neuer `extractLeadLabel()`-Helper (`src/lib/facebook-sync.ts`) parst `field_data`
  direkt, bevorzugt aber die E-Mail aus dem tatsächlichen Sync-Ergebnis wenn vorhanden.
- 🐛 **Health-Kacheln zeigten „50 von 50 Läufen erfolgreich"** für Facebook/Dialfire-Pull unabhängig
  von der echten Laufzahl — gezählt wurden einzelne Kontakt-Items statt der Batch-Zeile pro Lauf,
  was am impliziten 50-Zeilen-Fenster immer denselben Wert lieferte. Behoben durch konsequentes
  „ein Batch = ein Lauf"-Prinzip (`.is('parent_run_id', null)`-Filter in `/api/sync-runs` und
  `/api/sync-runs/summary`).
- 🔧 Neue Tabellen `sync_runs`, `sync_config`; `klicktipp_webhook_events` (bereits vorhanden) ist
  seit dieser Version zusätzlich an `sync_runs`/Retry angebunden. Details siehe `docs/ROADMAP.md`
  (Phase A) und die neuen Einträge unter „Kritische Dateien" unten.

### v0.24.0 (2026-08-06) — KI-Upload-Regressionen, robuste Regel-Ausführung, KlickTipp-ID sichtbar

- 🐛 **KI-Upload: Kontaktanlage schlug mit „Nicht angemeldet" fehl.** `POST /api/ki-upload/commit`
  ruft intern `/api/kontakte`, `/api/kontakte/[id]` und `/api/kontakte/[id]/dokumente` per
  Server-zu-Server-`fetch()` auf — ohne die Session-Cookie der eingehenden Anfrage weiterzuleiten.
  Die Auth-Middleware (nach dem Login-System später eingeführt als das KI-Upload-Feature) blockte
  diese internen Calls deshalb konsequent mit 401. Fix: Cookie-Header wird jetzt an alle drei
  internen Fetches durchgereicht. Live verifiziert: `POST /api/kontakte` liefert jetzt 201 statt 401.
- 🐛 **KI-Upload: erkannter Vertrag wurde doppelt angelegt.** `/api/kontakte/[id]/dokumente` führt
  bei jedem Upload eine eigene KI-Analyse durch und legt bei erkanntem Vertrag selbstständig einen
  `contracts`-Eintrag + Beitragsübersicht-Zeile an. Da der KI-Upload-Commit-Flow diese Route für die
  Drive-Ablage aufruft und danach selbst nochmal (mit den vom Nutzer geprüften Daten) einen Vertrag
  einträgt, entstand pro Upload ein doppelter Datensatz. Neues Flag `skipVertragsanalyse` unterdrückt
  die redundante Zweitanalyse, wenn der Commit-Flow die Dokumente-Route aufruft; der eigenständige
  Upload-Weg über die Dokumente-Kachel bleibt unverändert. An zwei produktiv betroffenen Kontakten
  bereinigt.
- 🐛 **Regel-Ausführung brach bei großen Kontaktmengen ab.** `apply-batch` verarbeitet Kontakte streng
  sequentiell (2-3 externe API-Calls pro Kontakt) und hatte kein `maxDuration`-Flag gesetzt — bei
  Regeln mit vielen passenden Kontakten (z.B. Facebook + Unternehmerschutz: 203 Kontakte) griff
  Vercels Standard-Timeout mitten im Lauf, ohne Fehlermeldung, und jeder erneute Klick begann wieder
  von vorne. Fix: `maxDuration=300` + bereits korrekt zu KlickTipp/Dialfire synchronisierte Kontakte
  werden beim erneuten Ausführen übersprungen, sodass jeder Lauf tatsächlich Fortschritt macht statt
  sich zu wiederholen. Separat beobachtet, kein Code-Bug: vereinzelte Kontakte werden von KlickTipp
  selbst mit HTTP 406 abgelehnt (Opt-in/Feldformat, u.a. ein klarer Spam-Lead).
- 🐛 **Regel-Verlauf zeigte „KlickTipp nicht erfolgt" trotz erfolgreicher Sync.** Die Lauf-Historie
  lud Dialfire- und KlickTipp-Aktivitäten in einer gemeinsamen, unsortierten Abfrage — ein separater
  Hintergrundprozess erzeugt pro Kontakt mehrfach täglich `dialfire_synced`-Einträge, die bei 50
  angezeigten Kontakten das implizite 1000-Zeilen-Limit von PostgREST vollständig füllten und die
  viel selteneren `klicktipp_synced`-Einträge verdrängten. Fix: getrennte, absteigend sortierte
  Abfragen pro Sync-Typ. Verifiziert: zuvor 1/50, danach 47/50 Kontakte korrekt als „ok" erkannt.
- ✨ **KlickTipp-Kontakt-ID in der UI sichtbar gemacht.** `klicktipp_id` wurde zwar seit jeher
  zuverlässig gespeichert (0 Fälle von erfolgreicher Sync ohne gespeicherte ID, gegen 337
  Sync-Aktivitäten geprüft), aber nirgends angezeigt. Ergänzt in der Integrations-Sektion
  (`ContactOverview.tsx`), im Automation-Drawer (`AutomationControls.tsx`, neuer Status-Block mit
  ID + letztem Sync-Zeitpunkt) und in der Kontakthistorie (`AktivitaetenPanel.tsx`, ID direkt in der
  `klicktipp_synced`-Beschreibung).
- 🐛 **Reporting/Selektion kannte die KlickTipp-Spalten nicht.** `report-schema.ts` ist eine manuell
  gepflegte Schema-Beschreibung für die NL→SQL-Generierung (Claude) und war seit der
  KlickTipp-Integration nie um deren Spalten ergänzt worden — die KI lehnte Anfragen wie „Kontakte
  ohne KlickTipp-Kontakt-ID" fälschlich mit „Schema enthält keine solche Spalte" ab. Ergänzt:
  `klicktipp_id`, `klicktipp_tags`, `klicktipp_tag_ids` (`bigint[]`), `klicktipp_last_sync`,
  `klicktipp_email_status`; veralteten `sparte`-Kommentar korrigiert (nannte nur 2 von 4 aktiven
  Sparten).
- 🔧 **Vercel-GitHub-Integration war getrennt.** Die automatische Deploy-Verbindung stand während
  eines Teils dieser Session, wodurch mehrere der obigen Fixes erst verzögert live gingen — nach
  dem Wiederverbinden per leerem Trigger-Commit nachgeholt. Bei zukünftigen Verifikations-Problemen
  ("Fix ist committed, aber Fehler bleibt live bestehen") die Vercel-Deployment-Liste gegen den
  neuesten Commit-Hash prüfen.

### Sitzung 2026-08-05 — KlickTipp live angebunden, Rückkanal pilotiert und Tag-Bestand geprüft

- ✅ Make.com als zwischenzeitliche Idee verworfen und den alten Make-/Edge-Webhook-Pfad entfernt.
  Kontaktanlage, Kontaktänderung, Regel-Ausführung und Bestandsabgleich verwenden jetzt einheitlich
  den direkten KlickTipp-Management-API-Client.
- ✅ KlickTipp-Zugang über den dedizierten API-User `bosydadaq-api2` mit Benutzername/Passwort
  produktiv konfiguriert; Partner-Schlüssel-Authentifizierung bleibt als technischer Fallback
  erhalten. Die erforderliche Freigabe wurde vom Hauptkonto erteilt, die Vercel-Variablen wurden
  gesetzt und erfolgreich neu deployed. Keine Schlüssel oder Passwörter sind in der Dokumentation
  oder im Repository abgelegt.
- ✅ Der markierte Kontakt-Pilot für den direkten Kontakt-/Tag-Sync war erfolgreich. Jeder reguläre,
  nicht archivierte Kontakt mit E-Mail wird übertragen. Aktive Regeln laufen bei der Kontaktanlage
  automatisch; eine manuelle Regel-Ausführung synchronisiert nur die passenden Kontakte. Die
  Ausführungsanzeige weist KlickTipp-Erfolge, Fehler und übersprungene Kontakte separat aus.
- ✅ Feldmapping erweitert: Geburtstag als Unix-Zeitstempel, Straße, PLZ und optional das in
  KlickTipp vorhandene Geschlechtsfeld über den API-Parameter `field157376`.
- ✅ Der bestehende Outbound-Sync blieb beim Ausbau des Rückkanals unverändert. Der Rückkanal nimmt
  E-Mail-/Kampagnen-/Tag-Ereignisse sowie `subscribed`, `opt_in_pending`, `unsubscribed`,
  `soft_bounce` und `hard_bounce` datensparsam und idempotent entgegen. Er legt keine Kontakte an
  und überschreibt keine von Sentimental Logic gesetzten Tags.
- ✅ Migration `0064_klicktipp_reverse_sync.sql`, `KLICKTIPP_WEBHOOK_SECRET`, geschützter
  Statusabgleich und manueller GitHub-Workflow wurden ausgerollt. Nach Bestätigung der
  Newsletter-Eintragung erkannte der Live-Pilot einen Statuswechsel (`checked: 1`, `changed: 1`,
  `failed: 0`).
- ✅ In KlickTipp ist der aktive JSON-Webhook `Sentimental Logic – Sentinel-Tag` (ID `176539`) für
  das manuelle Tag `Sentinel` mit festem `event_type=tag_added` und Secret-Token eingerichtet.
  Der KlickTipp-Testdialog bot den vorgesehenen Pilotkontakt nicht zur Auswahl an; deshalb wurde
  kein beliebiger echter Kontakt verwendet. Ein realer End-to-End-Pilot für Öffnung, Klick und
  Abmeldung bleibt offen.
- 🔎 Tag-Bestandsaufnahme: 719 manuelle Tags und sechs ausgehende Webhooks wurden festgestellt.
  In der per Lazy Loading erreichbaren Stichprobe waren 373 Tags sichtbar, davon 210 ohne Kontakte,
  163 in Verwendung, 94 mit „Action", 31 mit „STOP", 75 Import-/Upload-/Datums-Tags und 20
  Test-/Demo-/Probe-/Zapier-Tags. Schutzwürdig sind insbesondere alle aktuell von Webhooks
  referenzierten Tags. Der ältere Form-Data-Webhook `Sentinel Logic Sync` (ID `169322`) zeigt auf
  denselben Endpoint, besitzt aber keinen Secret-Token und ist daher wahrscheinlich überholt; er
  darf erst nach einem kontrollierten Vergleich entfernt werden. Ein Make.com-Webhook wurde nicht
  gefunden.
- 📄 Die vollständige, nicht verändernde Bestandsaufnahme liegt lokal als
  `output/pdf/klicktipp-tag-bestandsaufnahme-2026-08-05.pdf`. Für eine belastbare Klassifikation
  aller 719 Tags wird noch ein vollständiger CSV-Export aus KlickTipp benötigt.
- 🧭 Langfristig soll eine mögliche Ablösung von KlickTipp vorbereitet werden; die endgültige
  Produktentscheidung ist noch offen. Der sichere Weg bleibt ein schrittweiser Parallelbetrieb:
  Abhängigkeiten inventarisieren, Einwilligungen und Ereignisse in Sentimental Logic konsolidieren,
  fehlende E-Mail-/Automation-Funktionen ergänzen und erst danach Migration und Abschaltung bewerten.

### v0.23.0 (2026-08-05) — Beitragsübersicht: Vertrags-Übernahme, Mailversand, neue Vorlage

- ✅ Beiträge aus per KI erkannten Vertrags-Uploads werden jetzt automatisch als neue Zeile in die
  Beitragsübersicht des Kontakts übernommen (`src/lib/beitragsuebersicht-uebernahme.ts`,
  `uebernehmeVertragInBeitragsuebersicht()`) — eingehängt in beide bestehenden Commit-Pfade
  (`api/ki-upload/commit`, `api/kontakte/[id]/dokumente` POST). `contract_type: 'eigen'` (Allianz-
  Neuvertrag) landet in „Neu", `'fremd'`/`'unknown'` (Bestandsvertrag) in „Alt" + Versicherer.
  Mehrere Policen zur selben Sparte erzeugen bewusst mehrere Zeilen, keine Zusammenführung. Neues
  Flag `BeitragsPosition.automatisch_uebernommen` (kein Migrations-Bedarf, lebt in der bestehenden
  JSONB-Spalte) zeigt in `BeitragsuebersichtPanel.tsx` ein 📄-Badge mit Tooltip (Original-Beitragstext
  aus der Extraktion, da die KI nur einen Freitext liefert, keine Zahl mit Periode)
- ✅ Neuer Button „📧 Per E-Mail senden" neben „PDF herunterladen" — erzeugt das PDF frisch
  (Dateiname mit Zeitstempel), öffnet `ContactEmailModal` mit PDF vorab angehängt und der neuen
  Vorlage „Beitragsübersicht" automatisch ausgewählt. Nutzt dafür denselben bereits bestehenden
  Versand-Pfad wie normale Kontakt-Mails (`POST /api/kontakte/[id]/email`) — Dokumenten-Ablage
  (Google Drive) und Aktivitäten-Log (`email_sent`) passieren dadurch automatisch mit, ohne
  zusätzlichen Code. `ContactEmailModal` bekam dafür drei neue optionale Props
  (`initialAttachments`, `initialTemplateName`, `attachmentCategory`); die Email-Route akzeptiert
  jetzt ein `category`-Feld (Standard weiterhin `Sonstiges`) statt es hart zu verdrahten
- 🐛 Beim Verdrahten in `kontakte/[id]/page.tsx` zunächst ein Bug eingebaut und in derselben Sitzung
  gefunden: `onSent` hat `beitragsMailFile` sofort zurückgesetzt, wodurch das Modal auch bei einer
  bloßen Ablage-Warnung (`filingWarning`) sofort schloss, statt die Warnung anzuzeigen. Fix: das
  Zurücksetzen passiert nur noch in `onClose`
- ✅ Neue Mail-Vorlage „Beitragsübersicht" (Migration `0065_mail_template_beitragsuebersicht.sql`)
- ✅ Live verifiziert: Vertrags-Übernahme direkt gegen die Funktion getestet (eigen→Neu, fremd→Alt+
  Versicherer, gleiche Sparte zweimal→zwei Zeilen, unparsbarer Beitrag→keine Zeile — alle 4 Fälle
  korrekt); Mailversand-UI zeigt PDF-Anhang + Vorlage automatisch vorbelegt, Versand an eine
  `.invalid`-Testadresse (garantiert unzustellbar, kein Risiko eines echten Versands) bestätigt
  `email_sent`-Aktivität korrekt geloggt. Google-Drive-Ablage selbst konnte lokal nicht
  durchgetestet werden (System-Konto in dieser Dev-Umgebung nicht verbunden — bestehende
  Einschränkung, nicht durch diese Änderung verursacht), Code-Pfad ist aber strukturident mit dem
  bereits produktiv laufenden `kategorie`-Parameter aus dem KI-Upload/Dokumente-Upload
- 🆕 Dateien: `src/lib/beitragsuebersicht-uebernahme.ts`, `supabase/migrations/0065_mail_template_beitragsuebersicht.sql`

### v0.22.1 (2026-08-04) — KlickTipp-Direktsync vereinheitlicht

- ✅ Make.com-/alte Edge-Webhook-Strecke entfernt; Kontaktanlage, Kontaktänderung, Regeln und
  Bestandsabgleich verwenden jetzt denselben Management-API-Client
- ✅ Partner-Authentifizierung gemäß offiziellem KlickTipp-Connector umgesetzt: `X-Un` mit
  `bosydadaq-api2`, HMAC-basierter `X-Ci` aus Developer Key und Customer Key
- ✅ Stammdaten werden korrekt unter `fields` übertragen; Tags werden gebündelt über
  `POST /subscriber/tag` gesetzt; KlickTipp-ID und letzter erfolgreicher Sync bleiben am Kontakt
- ✅ Jeder reguläre Kontakt mit E-Mail wird übertragen, auch wenn Regeln deaktiviert sind;
  technisch markierte Testkontakte bleiben vom automatischen Live-Sync ausgeschlossen
- ✅ Geschützter Bestandsabgleich unter `POST /api/kontakte/klicktipp-sync` ergänzt
- ✅ Personenbezogene KlickTipp-Logs entfernt und Regel-Historie auf echten Sync-Status umgestellt
- ⚠️ Read-only-Live-Test von `/tag` und `/tag.json` erreicht KlickTipp, wird aber weiterhin mit
  HTTP 403 abgewiesen. Verbleibend: API-Zugriff für den Unteraccount neu freigeben, neuen
  Customer Key als Secret hinterlegen und danach markierten Kontakt-Pilot durchführen

### v0.22.0 (2026-08-04) — Termin-Änderungen werden per E-Mail an Teilnehmer gesendet

- ✅ Verschieben, Ort ändern, Titel/Beschreibung ändern und Stornieren eines Termins lösen jetzt
  automatisch eine E-Mail an die Teilnehmer aus (`src/lib/termin-email.ts`, `sendTerminBenachrichtigung()`)
  — echte Kalendereinladung mit ICS-Anhang (`METHOD:REQUEST`/`CANCEL`), damit Outlook/Gmail/Apple
  Kalender Annehmen/Ablehnen-Buttons zeigen, nicht nur eine normale Mail. Nutzt dieselbe
  STRATO-Postfach/Resend-Infrastruktur wie `contact-email.ts` (STRATO-Mailbox bevorzugt, Resend als
  Fallback mit ICS als normalem Anhang)
- ✅ Neue Spalte `termine.sequence` (Migration `0063_termine_sequence.sql`) — iTIP-SEQUENCE-Zähler,
  wird bei jeder für Teilnehmer relevanten Änderung erhöht (RFC 5546), sowohl in der Mail als auch im
  CalDAV-Push an STRATO (`pushStratoEvent` nimmt jetzt `sequence` entgegen)
- ✅ `PATCH /api/termine/[id]` vergleicht vor dem Speichern den bestehenden mit dem resultierenden
  Stand und verschickt gezielt: neu hinzugefügte Teilnehmer bekommen eine Einladung, entfernte eine
  Absage, weiterhin eingeladene bei inhaltlicher Änderung (Zeit/Ort/Titel/Beschreibung) ein Update
  mit lesbarer Änderungsliste. Rein interne Änderungen (z.B. `assigned_user_id`, `farbe`) lösen
  bewusst keine Mail und keinen SEQUENCE-Sprung aus
- ✅ `DELETE /api/termine/[id]` verschickt vor dem eigentlichen Löschen eine Absage an alle
  aktuellen Teilnehmer (best effort, wie der bestehende STRATO-Push)
- ✅ Live verifiziert (ohne echten Mailversand, da lokal kein Absender konfiguriert ist — der
  „Kein Absender konfiguriert"-Zweig wurde bewusst genutzt, um Testmails an Fake-Adressen zu
  vermeiden): Anlegen → 1 Einladung; Ort ändern → 1 Update, SEQUENCE 0→1; Verschieben +
  neuer Teilnehmer gleichzeitig → 1 Update + 1 Einladung, SEQUENCE 1→2; Teilnehmer entfernen
  (ohne weitere Änderung) → nur 1 Absage an den Entfernten, keine Mail an Verbleibende, SEQUENCE
  2→3; irrelevante Änderung (`farbe`) → keine Mail, SEQUENCE unverändert; Stornieren → 1 Absage vor
  dem Löschen. Alle Aufrufzahlen exakt wie erwartet
- 🆕 Dateien: `src/lib/termin-email.ts`, `supabase/migrations/0063_termine_sequence.sql`

### v0.21.1 (2026-08-04) — Melih wird bei jedem neuen Termin automatisch eingeladen

- ✅ Fachliche Vorgabe: `melih.guen@allianz.de` wird bei jedem NEU angelegten Termin automatisch
  als Teilnehmer ergänzt (`STANDARD_TEILNEHMER` + `mitStandardTeilnehmer()` in
  `src/lib/kalender-helpers.ts`), serverseitig in `POST /api/termine` durchgesetzt — unabhängig
  davon, was das Formular sendet, damit es auch bei künftigen anderen Erstellungswegen greift.
  `TerminEditModal.tsx` zeigt ihn im „Neuer Termin"-Formular direkt vorbelegt (Transparenz statt
  unsichtbarer Server-Magie). Case-insensitive Dedupe verhindert einen doppelten Eintrag, wenn er
  bereits manuell mit anderer Schreibweise hinzugefügt wurde. Gilt bewusst nur für `POST`
  (Neuanlage), nicht für `PATCH` (nachträgliches Entfernen bei bestehenden Terminen bleibt möglich)

### v0.21.0 (2026-08-04) — Kalender: mehrtägige Termine korrekt anzeigen + Teilnehmer einladen

- 🐛 Mehrtägige Termine (z.B. ganztägig 07.08.–08.08.) wurden in Monats-/Wochen-/Tagesansicht und im
  Mini-Kalender nur an ihrem Starttag angezeigt — `MonatsView`, `ZeitrasterView` und die
  `markierteTage`-Berechnung in `kalender/page.tsx` filterten Termine je Tag über
  `istGleicherTag(e.start, tag)`, was jeden Tag außer dem ersten ausschloss. Neuer Helper
  `beruehrtTag(start, end, tag)` (`src/lib/kalender-helpers.ts`) prüft stattdessen echte
  Intervall-Überlappung; das Zeitraster clippt zusätzlich Start/Ende auf den jeweiligen Tag, damit
  auch über Mitternacht gehende Termine mit korrekter Höhe auf beiden Tagen erscheinen
- ✅ Termine können jetzt Teilnehmer per E-Mail einladen — bisher gab es dafür keine Möglichkeit.
  Neue Spalte `termine.teilnehmer` (JSONB `[{email, name?}]`, analog zu anderen flexiblen Listen wie
  `payment_steps`). `TerminEditModal.tsx` bekommt ein „Teilnehmer einladen"-Feld (akzeptiert reine
  E-Mails sowie `Name <email>`, analog zum STRATO-Webmail-Dialog), Liste mit Entfernen-Button.
  Serverseitig validiert/dedupliziert `sanitizeTeilnehmer()` vor dem Speichern
- ✅ STRATO-Sync erweitert: `pushStratoEvent` schreibt ATTENDEE-Zeilen (+ ORGANIZER anhand der
  CalDAV-Zugangs-E-Mail, nur wenn Teilnehmer vorhanden), `fetchStratoEvents` parst ATTENDEE beim
  Pull zurück in dasselbe Format — beidseitig konsistent wie der Rest der Synchronisation
- ✅ Live verifiziert: mehrtägiger Testtermin erscheint jetzt an beiden Tagen (Monat, Woche, Mini-
  Kalender); Teilnehmer hinzufügen/entfernen inkl. „Name <email>"-Parsing persistiert korrekt

### v0.20.0 (2026-08-04) — Mehrfach-Sparten pro Kontakt + admin-pflegbare Erstgespräch-Leitfäden

- ✅ Neue Tabellen `sparten` (Name + Leitfaden als JSONB: `leitfaden_titel`, `leitfaden_fragen`,
  `leitfaden_abschluss`) und `contact_sparte_map` (n:m, `is_primary`, max. eine Primärsparte pro
  Kontakt via partiellem Unique-Index) ersetzen den bisherigen statischen Import
  `src/data/erstgespraech-leitfaden.ts` (gelöscht) und die 1:1-Beziehung über `contacts.sparte`
- ✅ `contacts.sparte` (Legacy-Spalte) bleibt bestehen und wird ausschließlich in
  `PUT /api/kontakte/[id]/sparten` automatisch auf den Namen der Primärsparte synchron gehalten —
  bewusste Entscheidung, damit Dialfire-Kampagnen-Zuordnung, KlickTipp-Tags, Facebook-Import und
  Regeln-Bedingungen (`automation-engine.ts`, `regeln/page.tsx`) unverändert weiterlaufen, ohne an
  ~25 Stellen im Code angefasst zu werden
- ✅ Neue Einstellungsseite `/einstellungen/sparten` (Muster: `mail-vorlagen/page.tsx`) — Melih
  verwaltet die feste Sparten-Liste inkl. verschachteltem Leitfaden-Editor (Fragen-Array, pro Frage
  ein Felder-Array mit `feld`/`label`/`typ`/`nurAnzeige`)
- ✅ `SparteMultiSelect.tsx` (Muster: `TagInput.tsx`, aber feste Liste statt Freitext) ersetzt das
  alte Freitextfeld „Sparte" in `ContactOverview.tsx`; speichert sofort bei jeder Änderung über
  `PUT /api/kontakte/[id]/sparten` (Body `{ sparteIds, primarySparteId }`, ersetzt den kompletten
  Satz je Kontakt in einem Rutsch, analog `contact_tag_map`)
- ✅ `ErstgespraechPanel.tsx` rendert jetzt 0/1/≥2 zugeordnete Sparten: bei ≥2 erscheint pro Sparte
  mit hinterlegtem Leitfaden ein eigener Abschnitt mit Sparten-Namen als Zwischenüberschrift, alle
  Antworten weiterhin gemeinsam über einen „Antworten speichern"-Button persistiert (Felder sind
  echte `contacts`-Spalten ohne Kollisionsgefahr zwischen Sparten)
- ✅ `regeln/page.tsx`: `SPARTE_OPTIONS` (hartcodiert) durch `GET /api/sparten` ersetzt — rein
  lesend, `automation-engine.ts` vergleicht weiterhin exakt gegen `contacts.sparte` wie bisher
- ✅ Live verifiziert: Migration inkl. Seed (Unternehmerschutz-Leitfaden 1:1 aus der alten Datei
  übernommen, PKV/Auslandsreiseversicherung/Auslandskrankenversicherung leer) und Best-Effort-
  Backfill bestehender `contacts.sparte`-Werte in `contact_sparte_map`; an einem Bestandskontakt
  eine zweite und dritte Sparte zugewiesen, `contacts.sparte` blieb korrekt auf der Primärsparte,
  Erstgespräch-Kachel zeigte alle zugeordneten Leitfäden, Regeln-Dropdown zog die Liste live aus
  der API
- 🆕 Dateien: `supabase/migrations/0060_sparten_leitfaden.sql`, `src/app/api/sparten/route.ts`,
  `src/app/api/sparten/[id]/route.ts`, `src/app/api/kontakte/[id]/sparten/route.ts`,
  `src/app/einstellungen/sparten/page.tsx`, `src/components/kontakt/SparteMultiSelect.tsx`

### v0.19.0 (2026-08-04) — KI-Agent Nr. 1: Call-Vorbereitung

- ✅ Neuer Button „🧠 Vorbereiten" in der Kontakt-Kopfzeile (`StickyContactHeader.tsx`, neben dem
  Placetel-Anruf-Button, immer sichtbar — nicht an eine hinterlegte Telefonnummer gekoppelt) öffnet
  ein Drawer-Panel (`CallPrepPanel.tsx`), das beim Öffnen automatisch eine kurze interne
  Zusammenfassung generiert: Kurzprofil, mindestens drei Gesprächsvorschläge, optionale Hinweise
  auf sensible Punkte (`flags`, z.B. offener Vorgang, überfällige Rückmeldung, Datenwiderspruch)
- ✅ `POST /api/agents/call-prep` aggregiert serverseitig Stammdaten, fachliche Aktivitäten (via
  `istTechnisch()`-Filter), offene Aufgaben, Notizverlauf und Dokumentenanzahl und ruft
  `generateCallPrep()` (`src/lib/call-prep.ts`, Claude Sonnet 5, `json_schema` Structured Outputs,
  gleiches Muster wie `ki-upload.ts`) auf. Keine Persistierung bei reiner Generierung
- ✅ „Als Notiz speichern" schreibt die Zusammenfassung über die bestehende
  `POST /api/kontakte/[id]/notes`-Route in `contact_notes_history` (`type: 'system'`,
  `category: 'call'`, `metadata.source: 'call_prep_agent'` als Herkunfts-Markierung, da `type`/
  `category` feste DB-Enums ohne einen dedizierten „call-prep"-Wert sind). Erkennt die Route
  `metadata.source === 'call_prep_agent'`, loggt sie zusätzlich eine fachliche Aktivität
  (neuer Typ `call_prep_saved` in `activities-logger.ts`) — andere Notiz-Quellen bleiben
  unverändert ohne Activity-Log, wie bisher
- 🐛 Beim Bauen entdeckt: `istTechnisch()` lag ursprünglich in `AktivitaetenPanel.tsx`
  (`'use client'`-Komponente) — ein Import davon aus einer server-seitigen API-Route schlägt in
  Next.js fehl (`... is not a function`, Client-Reference statt echter Funktion). Behoben durch
  Extraktion in ein eigenes, direktivenloses Modul `src/lib/activity-classification.ts`;
  `AktivitaetenPanel.tsx` re-exportiert die Funktion weiterhin für Bestandscode
- ⚠️ Bewusst kein `onSaved`-Reload nach dem Speichern: ein initial verdrahteter `loadKontakt()`-
  Callback löste über das Seiten-Loading-Gate (`if (loading) return ...`) einen kompletten Remount
  der Detailseite aus — das Panel verlor seinen Zustand und startete ungewollt eine weitere
  (kostenpflichtige) Claude-Generierung, statt die „✓ Gespeichert"-Bestätigung zu zeigen. Da
  `NotesHistory.tsx` seinen Inhalt ohnehin beim eigenen Öffnen selbst nachlädt, war der Reload
  nicht nötig — einfach entfernt
- ✅ Live gegen die produktive Supabase-Instanz verifiziert (kein separates Test-System, siehe
  bestehende Projekt-Konvention): sowohl ein Bestandskontakt mit reicher Historie (mehrere
  Anrufversuche, überfällige Aufgabe, Datenwiderspruch zwischen Sparten-Feld und Notiz — alles
  korrekt erkannt und in `flags` ausgewiesen) als auch ein frischer Facebook-Lead ohne jede
  Historie (Output fokussiert auf Bedarfsklärung/Erstkontakt statt Rückblick, wie gefordert)
  produzierten sinnvolle, grundierte Ausgaben ohne erfundene Fakten
- 🆕 Dateien: `src/lib/call-prep.ts`, `src/lib/activity-classification.ts`,
  `src/app/api/agents/call-prep/route.ts`, `src/components/kontakt/CallPrepPanel.tsx`

### v0.18.2 (2026-08-03) — Ganztägiger Termin verschob sich um einen Tag (UTC vs. lokal)

- 🐛 Nutzer meldete: ein für den 06.08. angelegter ganztägiger Termin wurde in der Kalender-UI am
  07.08. angezeigt. Ursache: `TerminEditModal.tsx` las das Datumsfeld bei ganztägigen Terminen
  UTC-basiert aus (`start_zeit.slice(0, 10)`), schrieb neue Werte aber lokal-zeitbasiert zurück
  (`new Date(\`${value}T00:00\`)`, ohne Zeitzonen-Suffix → lokale Zeit laut ECMAScript). In
  Europe/Berlin (UTC+2) verschob dieser Mismatch das gespeicherte Datum bei jeder Bearbeitung
  einen Tag nach vorn. Derselbe Bug steckte in `strato-caldav.ts`s `toIcsDate()` und hätte auch
  das falsche Datum zu STRATO gepusht
- ✅ Behoben in beiden Dateien durch Umstellung auf `toDateKey()` (lokale Kalendertag-Extraktion
  via `getFullYear()/getMonth()/getDate()`) — dieselbe Konvention, die im restlichen
  Kalender-Code (`istGleicherTag`, `MiniMonat`, `MonatsView`) bereits durchgängig verwendet wird
- ✅ Live verifiziert: betroffenen Real-Termin ("Schulung CRM") korrigiert, DB zeigt jetzt
  `06.08.2026` (Europe/Berlin), UI zeigt ihn korrekt unter "6 Do." an; per STRATO-Pull bestätigt,
  dass die Korrektur auch im echten STRATO-Kalender ankam

### v0.18.1 (2026-07-31) — STRATO-CalDAV-Synchronisation: Href-Bug behoben, live verifiziert

- 🐛 Beim ersten Live-Test entdeckt: STRATO liefert im CalDAV-REPORT relative Pfade zurück
  (`/caldav/…`), keine vollständigen URLs. Node.js' `fetch()` kennt anders als ein Browser keine
  implizite Basis-URL — ein späterer PUT/DELETE mit diesem `href` wäre fehlgeschlagen. Behoben:
  `fetchStratoEvents()` normalisiert relative Pfade auf die absolute Server-URL
- ✅ **Kompletter Zyklus live gegen den echten STRATO-Server verifiziert** (Produktion, nicht nur
  lokal): Termin anlegen → Push bestätigt (`external_uid`/`href`/`etag` gesetzt); Titel bearbeiten
  → lokalen Titel absichtlich überschrieben, per Pull den echten von STRATO zurückgeholt, Titel
  stimmte → Push hat STRATO wirklich verändert; Termin löschen → anschließender Pull fand „0 neu"
  → auch auf STRATO-Seite wirklich weg, kein Zombie-Wiederauftauchen
- ℹ️ STRATO liefert bei `PUT` keinen `ETag`-Response-Header (`external_etag` bleibt nach einem
  Push leer) — kein Bug, nur kosmetisch: der nächste Pull holt den echten ETag nach und zeigt den
  Termin dabei einmalig als „aktualisiert", obwohl inhaltlich nichts geändert wurde

### v0.18.0 (2026-07-31) — STRATO-CalDAV-Synchronisation (beidseitig), noch ungetestet

- ✅ **CRM → STRATO läuft automatisch**: `POST/PATCH/DELETE /api/termine(/[id])` pushen sofort per
  CalDAV (`lib/strato-caldav.ts`, `fetch` mit `REPORT`/`PUT`/`DELETE`, ICS von Hand gebaut).
  Best-effort — schlägt der Push fehl (STRATO nicht erreichbar o.ä.), bleibt der Termin trotzdem
  lokal gespeichert, nur eben nicht synchronisiert
- ✅ **STRATO → CRM läuft manuell** über "🔄 Jetzt von STRATO holen" in der Kalender-Sidebar
  (`POST /api/termine/sync-strato`) — dedupliziert über `external_uid`, erkennt Änderungen über
  den WebDAV-`ETag` (`external_etag`)
- ⚠️ **Bewusst keine Löschpropagierung STRATO → CRM**: verschwindet ein Termin auf STRATO-Seite,
  bleibt die CRM-Kopie unangetastet — verhindert, dass ein STRATO-seitiges Versehen automatisch
  echte CRM-Daten löscht. Termin im CRM löschen propagiert dagegen automatisch zu STRATO
- ✅ Neue Migration `0056_termine_strato_sync.sql` (`external_etag`, `external_href`,
  `last_synced_at`), neue Dependencies `node-ical` (ICS-Parsing) + `fast-xml-parser`
  (WebDAV-Multistatus-XML), Zugangsdaten in `.env.example` dokumentiert
  (`STRATO_CALDAV_URL/_USER/_PASSWORD`, ausschließlich serverseitig)
- ⚠️ Ursprünglich noch nicht gegen den echten STRATO-Server getestet — siehe v0.18.1 für die
  Live-Verifikation. Der Nutzer hat bislang nur die CalDAV-URL geliefert
  (`https://dav.webmail.strato.de/caldav/Y2FsOi8vMC8zMQ`,
  entspricht Ordner `cal://0/31` = Kalender „Gün, Melih"), Benutzername/Passwort fehlen noch. Vor
  echtem Produktivsatz: Zugangsdaten eintragen, dann Push (Termin anlegen) und Pull (Button) live
  gegen den echten Kalender verifizieren — Open-Xchanges genaues REPORT-Antwortformat und ob PUT
  auf eine frische `.ics`-URL ohne vorheriges `MKCALENDAR` akzeptiert wird, sind ungeprüfte Annahmen

### v0.17.0 (2026-07-31) — Kalender komplett neu: STRATO-Optik + echtes Termine-Datenmodell

Der Kunde nutzt STRATO Webmail (Open-Xchange) und ist an dessen Kalenderoptik gewöhnt. Auf Wunsch
nachgebaut — als Basis für die später geplante STRATO-CalDAV-Synchronisation (noch nicht Teil
dieser Änderung, wartet auf CalDAV-Zugangsdaten vom Kunden).

- ✅ **Neue Tabelle `termine`** (Migration `0055_termine.sql`) — echte Kalendertermine mit
  Start-/Endzeit, getrennt von Aufgaben-Fälligkeiten (die kein Zeitkonzept haben). Felder für
  künftige Sync bereits vorgesehen (`external_uid`, `external_source`, `kalender_quelle`), aber
  noch ungenutzt — keine Sync-Logik in dieser Änderung
- ✅ **5 Ansichten** wie bei STRATO: Tag / Arbeitswoche / Woche (Stundenraster mit roter
  Live-Zeit-Linie) / Monat (6-Wochen-Raster) / Jahr (12 Mini-Monate, 3-spaltig, mit KW-Spalte)
- ✅ **Drei Quellen im selben Raster**, einzeln togglebar über "Meine Kalender" links: Termine
  (blau), Aufgaben-Fälligkeiten (orange, wie bisher), Geburtstage (pink, neu — aus
  `contacts.geburtstag` abgeleitet, erscheint automatisch jedes Jahr wieder)
- ✅ Überlappende Termine bekommen automatisch Nebeneinander-Spalten statt sich zu überdecken
  (`lib/kalender-layout.ts`, Greedy-Spaltenzuweisung)
- ✅ Klick auf leere Zeitzelle → neuer Termin vorbefüllt mit der Uhrzeit; Klick auf Termin →
  bearbeiten; Klick auf Aufgabe → öffnet die Aufgabe; Klick auf Geburtstag → öffnet den Kontakt;
  Klick auf Tag in Monatsansicht → Tagesansicht; Klick auf Tag in Jahresansicht → Monatsansicht
- 🆕 Dateien: `api/termine/route.ts` + `[id]/route.ts`, `components/TerminEditModal.tsx`,
  `components/kalender/{ZeitrasterView,MonatsView,JahresView,MiniMonat}.tsx`,
  `lib/kalender-helpers.ts`, `lib/kalender-layout.ts`, `types/kalender.ts`
- ⚠️ Migration musste vom Nutzer manuell in Supabase ausgeführt werden (Projekt-Konvention,
  siehe unten) — vor dem ersten Test war `/api/termine` mit 500 fehlgeschlagen (Tabelle fehlte),
  Seite blieb aber nutzbar (Aufgaben/Geburtstage liefen weiter)

### v0.16.1 (2026-07-30) — Kontaktliste: Sortierung bleibt beim Verlassen erhalten

- 🐛 Sortierspalte + Richtung (`sortBy`/`sortOrder`) waren reiner `useState` ohne Persistenz —
  jeder Seitenwechsel setzte auf den Default (Vorname, aufsteigend) zurück
- ✅ In `localStorage` gespeichert (`kontakte-sort-by`, `kontakte-sort-order`), analog zum
  bestehenden Muster für Spalten-Sichtbarkeit/-Reihenfolge/-Dichte in derselben Datei. Schreiben
  direkt in `toggleSort()` (einzige Mutationsstelle), kein zusätzlicher Sync-Effect nötig

### v0.16.0 (2026-07-30) — Neuer Kontakt-Status „Nicht interessiert" + einheitliches Farbschema

- ✅ Neuer Status `not_interested` ("Nicht interessiert") zu allen Status-Definitionen
  hinzugefügt: `types/index.ts` (`ContactStatus`), `data/mock.ts` (`LeadStatus`, historisch
  doppelt gepflegt), Kontaktliste, Kontaktdetail, Dashboard, Regeln ("Status setzen"-Aktion),
  Export (CSV/Excel/PDF), Reporting-Schema-Doku, serverseitige `VALID_STATUSES` in
  `api/kontakte/route.ts` + `api/kontakte/[id]/route.ts` + `api/kontakte/export/route.ts`
- ✅ Einheitliches Farbschema für alle fünf Status, überall gleich: **Neu = grau, Kontaktiert =
  blau, Qualifiziert = gelb, Kunde = grün, Nicht interessiert = rot**. Vorher inkonsistent
  (z.B. „Kunde" war lila, „Kontaktiert" gelb) und je nach Stelle unterschiedlich
- 🐛 Der Status-Dropdown in der Kontaktliste (Tabelle + Mobile-Karten) hatte bisher **gar keine
  Farbe** — `STATUS_COLORS` war definiert, aber nirgends verdrahtet. Jetzt eingefärbt
  (`bg-{farbe}-100 text-{farbe}-800`, abgerundete Pille statt normaler Select-Rahmen)
- 🐛 Der Status-Dropdown im Bearbeiten-Formular (`ContactOverview.tsx`) zeigte bisher die
  rohen englischen Werte ("new", "contacted", ...) statt deutscher Labels — `Field`-Komponente
  bekam nur ein `string[]`, kein `{value,label}[]`. Auf benannte Optionen umgestellt
- ℹ️ Pipeline-Stufen (`lib/pipeline.ts`, 12-Schritte-Prozess) mappen weiterhin nur auf
  new/contacted/qualified/customer — „Nicht interessiert" ist bewusst ein manueller
  Status außerhalb der Pipeline, kein Automatik-Ziel eines Schritts
- ⬜ Bewusst nicht angefasst: `/leads` + `/api/leads` (bestätigte Altlast, siehe Task-Chip)

### v0.15.3 (2026-07-30) — Erstgespräch-Drawer: Name/E-Mail/Telefon jetzt editierbar

- 🐛 Die Kontaktinfo am Anfang des Drawers (Name, E-Mail, Telefon) war nur Anzeige, keine
  Eingabe — nicht nutzbar, um diese Angaben beim ersten Anruf zu erfassen oder zu korrigieren
- ✅ Ersetzt durch dieselben `Field`-Komponenten wie der Rest des Leitfadens (Vorname, Nachname,
  E-Mail, Telefon-Mobil) — Teil derselben lokalen Sammlung und desselben „Antworten speichern"

### v0.15.2 (2026-07-30) — Erstgespräch-Kachel: standardmäßig zugeklappt, öffnet als Drawer

- ✅ Kachel in der Übersicht zeigt nur noch einen kompakten Hinweis (welche Sparte, ob ein
  Leitfaden existiert) + „Bearbeiten"-Button — analog zu Dokumente/Verträge
- ✅ „Bearbeiten" öffnet den vollständigen Leitfaden (Kontaktinfo, Notizen, alle Fragen) in einem
  Drawer von rechts, exakt demselben Muster wie bei „Aufgaben für diesen Kontakt"
  (`openDrawer === 'erstgespraech'`, neuer `DrawerId`-Wert)
- ℹ️ Kein Verhaltensunterschied für Speichern/Notizen/Schnellnavigation — der Drawer-Inhalt ist
  derselbe `ErstgespraechPanel`, nur die Platzierung hat sich geändert (Drawer statt Inline-Kachel)

### v0.15.1 (2026-07-30) — Erstgespräch-Kachel: Position, Kontaktinfo, Notizen, Schnellnavigation, Aufgaben-Vorbelegung

- ✅ Kachel verschoben: jetzt oben in der rechten Arbeits-Spalte, oberhalb von „Nächste Aufgabe"
  (vorher unten in der linken Daten-Spalte)
- ✅ Vor der ersten Frage stehen jetzt Name, E-Mail und Telefon des Kontakts als schneller Kontext
- ✅ Notizen-Feld (`contacts.notes`, dieselbe Spalte wie im Kopfbereich) direkt in der Kachel
  verfügbar — eigener kleiner Speichern-Button, unabhängig vom „Antworten speichern" der
  Leitfaden-Felder, da freier Notiztext einer anderen Eingabe-Rhythmik folgt als die Q&A-Felder
- ✅ „↓ Zum Ende" / „↑ Zum Anfang" springen innerhalb der Kachel, ohne dass man bei zehn Fragen
  manuell scrollen muss
- ✅ „+ Aufgabe: Folgetermin anlegen" belegt den Aufgaben-Titel jetzt mit „Beratungstermin" vor.
  Dafür neuer State-Pfad `newTaskDefaults` in `kontakte/[id]/page.tsx`, getrennt von
  `editingAufgabe` — die POST/PATCH-Unterscheidung beim Speichern hängt weiterhin ausschließlich
  an `editingAufgabe`, damit eine vorbelegte neue Aufgabe nicht versehentlich als Bearbeitung
  einer nicht existierenden Aufgabe interpretiert wird

### v0.15.0 (2026-07-30) — Neue Kachel „Erstgespräch": Sparten-Leitfaden fürs erste Telefonat

- ✅ Neue Kachel auf der Kontaktdetailseite: ein sparten-spezifischer Gesprächsleitfaden, an dem
  sich der Mitarbeiter beim ersten Anruf orientiert. Jede Frage zeigt den vorgeschlagenen
  Gesprächseinstieg, darunter die zugehörigen Felder direkt editierbar
- ✅ Fragen sind auf bestehende `contacts`-Spalten gemappt — **keine neue Migration nötig**, alle
  benötigten Felder existierten bereits (`company_name`, `rechtsform`, `street`, `hausnummer`,
  `postal_code`, `city`, `seit_wann_gewerbe`, `geburtstag_gf_inhaber`, `industry`,
  `mitarbeitanzahl`, `jahresumsatz`, `inhaltssumme`, `versicherungstyp`, `bestandskunde`,
  `versicherungsgesellschaft`)
- ✅ Leitfaden-Inhalt liegt in `src/data/erstgespraech-leitfaden.ts` (`ERSTGESPRAECH_LEITFAEDEN`,
  Sparte → Fragenliste). Neue Sparte hinzufügen = neuer Eintrag in diesem Record, kein Code an
  anderer Stelle nötig. Bisher nur **Unternehmerschutz** befüllt (Inhalt vom Nutzer geliefert);
  **PKV zeigt bewusst einen Platzhalter** („kein Leitfaden hinterlegt"), Inhalt folgt später
- ✅ Änderungen werden lokal gesammelt (wie `ContactOverview`) und erst über „Antworten
  speichern" in einem Rutsch übernommen — kein Request pro Tastendruck während des Telefonats
- ✅ Letzte Frage („Bestätigung der Firmendaten") ist reine Anzeige, keine erneute Eingabe.
  Abschluss-Hinweis führt zu „+ Aufgabe: Folgetermin anlegen" (öffnet dieselbe
  Aufgaben-Erfassung wie überall sonst auf der Seite)
- ⚠️ Sparten-Zuordnung ist ein exakter String-Vergleich auf `contacts.sparte` (aktuell nur
  `PKV`/`Unternehmerschutz` im Umlauf, siehe `SPARTE_OPTIONS` in `regeln/page.tsx`). Ohne
  gesetzte oder unbekannte Sparte zeigt die Kachel einen erklärenden Hinweis statt eines Fehlers
- 🆕 Datei: `src/components/kontakt/ErstgespraechPanel.tsx`

### v0.14.1 (2026-07-30) — Kontakthistorie: umbenannt, ins ⋯-Menü verschoben, fachlich/technisch getrennt

- ✅ Die "Aktivitäten"-Kachel ist aus der Kontaktdetail-Übersicht entfernt. Der volle Verlauf
  (jetzt „Kontakthistorie") ist über das ⋯-Menü im Kopfbereich erreichbar (`StickyContactHeader.tsx`)
  — das Menü zeigte bisher nur Anruf/WhatsApp und war deshalb an das Vorhandensein einer
  Telefonnummer gekoppelt; es wird jetzt immer angezeigt
- ✅ `AktivitaetenPanel.tsx` trennt Einträge in fachlich (Standard sichtbar: Kontakt angelegt,
  Status-/Pipeline-Änderungen, Aufgabe erstellt, Datei, Notiz, E-Mail) und technisch (Sync mit
  Dialfire/KlickTipp/Superchat/Facebook, Regelausführung, Feld-Updates — zuschaltbar über
  "+ N technische Einträge anzeigen"). Klassifizierung anhand der realen Verteilung in der
  Produktiv-DB geprüft (5.983 Einträge, dominiert von facebook_linked/dialfire_synced/
  automation_executed) — unbekannte künftige Typen landen bewusst im fachlichen Default,
  damit nichts unsichtbar verschwindet
- ℹ️ `facebook_imported` (Kontakt-Erstellung via Facebook) ist bewusst fachlich, `facebook_linked`
  (Webhook-Zustellung an bestehenden Kontakt, oft mehrfach) bewusst technisch

### v0.14.0 (2026-07-30) — Regeln: mehrere KlickTipp-Tags pro Regel

- ✅ Eine Regel kann jetzt mehrere KlickTipp-Tags gleichzeitig setzen (`actions.klicktipp_tags`,
  Array), statt nur eines (`actions.klicktipp_tag`). Mehrfachauswahl im Regel-Formular per
  `<select multiple>` — dieselbe Bedienung wie bei den Kontakt-Automatisierungseinstellungen
- ✅ Bestehende Regeln mit dem alten Einzel-Tag-Format bleiben ohne Migration lesbar
  (`src/lib/rule-klicktipp-tags.ts`, `ruleKlicktippTags()` liest neues Format, fällt sonst auf
  das alte zurück). Neue/bearbeitete Regeln schreiben immer das neue Array-Format
- ℹ️ Geändert: `automation-engine.ts`, `apply-batch/route.ts`, `rule-notifications.ts`,
  `regeln/page.tsx`. Die Lauf-Historie (`/api/rules/[id]/runs`) brauchte keine Änderung, da sie
  bereits generisch auf dem Array `data.klicktipp_tags` arbeitet

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

> Diese Liste stammt aus einer frühen Projektphase (v0.4–v0.6) und ist deutlich weniger aktuell
> gepflegt als die „Konsolidierte Feature-Roadmap" weiter oben — bei Widersprüchen gilt die
> Roadmap. Am 2026-08-05 gegen den aktuellen Code-Stand geprüft: der komplette „Kritisch"-Block
> (Google-Drive-Verbindung) sowie mehrere Medium-Priority-Punkte (Task-API, Auth, Team-Rollen,
> `assigned_user_name`) waren bereits gelöst und wurden entfernt. Am 2026-08-06 zusätzlich
> „Auto/Manuell Toggles" entfernt — in `AutomationControls.tsx` bereits vollständig vorhanden
> (Dialfire-Kampagne/-Task, KlickTipp-Tags je mit eigenem Auto-Toggle).

### High Priority (v0.4+)

- [ ] **Dialfire Kampagnen-Flexibilität:** Nur 2 IDs hartcodiert in Edge-Function (GENS85UE5SU4SSC7, SFU6DSEG4RU2Z6HX); sollte via system_config konfigurierbar sein
- [ ] **Automation Settings UI:** `/einstellungen` neue Sektion für Kampagnen/Tasks/Tags config (Textareas → system_config)
- [ ] **Dialfire Test-Kontakt:** YWAY4QBKJVWG69PQ noch manuell in Dialfire UI löschen

### Medium Priority (v0.5+)

- [ ] Advanced Search & Filtering
- [ ] Regression-Tests für Automation-Engine

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
| `src/lib/call-prep.ts` | Call-Vorbereitungs-Agent: Claude-Sonnet-Aufruf + JSON-Schema für Kurzprofil/Gesprächsvorschläge/Flags (v0.19.0) |
| `src/lib/activity-classification.ts` | `istTechnisch()` — geteiltes, direktivenloses Modul (fachlich/technisch-Klassifizierung für Aktivitäten), von UI und server-seitigem Code nutzbar (v0.19.0) |
| `src/app/api/agents/call-prep/route.ts` | Aggregiert Kontaktdaten + ruft `call-prep.ts` auf; keine Persistierung (v0.19.0) |
| `src/components/kontakt/CallPrepPanel.tsx` | Drawer-Inhalt: Auto-Generierung beim Öffnen, „Neu generieren", „Als Notiz speichern" (v0.19.0) |
| `supabase/migrations/0066_sync_runs.sql`, `0067_sync_config.sql` | Neues Ausführungsmodell + einheitliche Zeitplan-Tabelle (v0.25.0) |
| `src/lib/sync-runs/retry-runner.ts` | `runWithTracking()`/`recordRunStart()`/`recordRunOutcome()` — gemeinsamer Tracking-Wrapper aller Integrationen, persistiert bei Erfolg auch den Rückgabewert in `data.result` (v0.25.0) |
| `src/lib/sync-runs/error-classification.ts` | `classifyError()` — transient/rate_limit/validation/auth/unknown, extrahiert HTTP-Status aus Fehlertexten (v0.25.0) |
| `src/lib/sync-runs/retry-handlers.ts` | `RETRY_HANDLERS`-Registry + `processRetries()`/`hasRetryHandler()`, genutzt vom Cron-Piggyback und `retry-all` (v0.25.0) |
| `src/lib/sync-runs/batch-detail.ts` | Pro-Kontakt-Aufschlüsselung eines Batch-Laufs (Facebook/Dialfire-Pull/CSV) für die Detail-Ansicht (v0.25.0) |
| `src/lib/sync-runs/sync-config.ts` | Gemeinsamer Due-Check-Helper für zeitgesteuerte Integrationen gegen `sync_config` (v0.25.0) |
| `src/lib/sync-runs/status.ts`, `src/components/SyncStatusBadge.tsx` | Einheitliches Status-Vokabular (6 Zustände) + Badge-Komponente für Kacheln und Lauf-Tabelle (v0.25.0) |
| `src/lib/dialfire-sync.ts`, `src/lib/superchat-sync.ts`, `src/lib/strato-sync.ts`, `src/lib/strato-mail-sync.ts` | Konsolidierte, `sync_runs`-getrackte Sync-Funktionen je Integration, ersetzen zuvor duplizierten Inline-Code in den jeweiligen Routen (v0.25.0) |
| `src/lib/klicktipp-webhook.ts` | `processEvent()`/`activityFor()` (aus der Route verschoben, damit Route + Retry-Handler dieselbe Logik nutzen) (v0.25.0) |
| `src/components/automatisierungen/AutomatisierungenTabs.tsx` | Tab-Leiste, die `/regeln` und `/sync` navigatorisch unter „Automatisierungen" verbindet (v0.25.0) |
| `src/app/api/sync-runs/route.ts`, `.../summary/route.ts`, `.../[id]/detail/route.ts`, `.../[id]/retry/route.ts`, `.../[id]/pause/route.ts`, `.../retry-all/route.ts` | Control-Center-API: Lauf-Liste, Health-Aggregation, Batch-Detail, Einzel-Retry/Pause, Retry-Queue-Flush pro Integration (v0.25.0) |
| `supabase/migrations/0068_gewerbe_recherche.sql` | `contacts.gewerbe_recherche` JSONB — Cache für die Unternehmensrecherche (v0.26.0) |
| `src/lib/company-research.ts` | `generateCompanyResearch()` (Claude + `web_search`-Tool + Structured Outputs), `ensureGewerbeRecherche()`/`refreshGewerbeRecherche()` (Cache-Lese/Schreib-Logik) (v0.26.0) |
| `supabase/migrations/0071_dokumenttyp.sql` | `dokumente_metadata.dokumenttyp` (nullable, CHECK auf 5 bekannte Werte) + Index (v0.30.0) |
| `src/lib/dokumenttyp.ts` | Gemeinsames Modul: Dokumenttyp-Labels/-Optionen, Filter-Bucket-Mapping (`nachtrag`→„Verträge", `NULL`→„Sonstiges") — von KI-Upload-Prüfmaske, Kontakt-Dokumente-Tab und globaler `/dokumente`-Übersicht genutzt (v0.30.0) |
| `supabase/migrations/0072_angebote.sql` | `angebote`-Tabelle: Status-Lifecycle, Betrag/Zyklus (roh, mtl. Beitrag live berechnet), Leistungsumfang, `dokument_id`-Verknüpfung (v0.32.0) |
| `src/lib/angebot-status.ts` | Gemeinsames Modul: Angebot-Status-Optionen/-Labels/-Farben — von `/angebote`, `KontaktAngeboteTab`, KI-Upload-Prüfmaske und `KontaktDokumenteTab` genutzt (v0.32.0) |
| `src/app/api/angebote/route.ts`, `.../[id]/route.ts` | Angebote-CRUD + Status-Automatik (Kontakt-Status-Sync) + Aktivitäten-Log (v0.32.0) |
| `src/app/angebote/page.tsx` | Angebote-Pipeline-Seite: Karten (Kanban)/Liste-Toggle, Filter, Anlegen/Bearbeiten/Archivieren (v0.32.0) |
| `src/components/kontakt/KontaktAngeboteTab.tsx` | Kontakt-Kachel „Angebote" — gleiche CRUD-Funktionalität wie `/angebote`, kontaktgebunden (v0.32.0) |

---

*Last Updated: 2026-08-15 — v0.32.0 Angebote (Deal-/Angebotsnachverfolgung): Pipeline-Seite, Kontakt-Kachel, KI-Upload-Anbindung, Status-Automatik*
