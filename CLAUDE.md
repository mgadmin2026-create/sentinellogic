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
| **Auth** | TBD | Session-based (planned) |
| **Hosting** | Vercel | Auto-deploy on `git push main` |
| **Email** | Resend API | Transaktional (Domain: onlinefirst.eu) |
| **Document Storage** | Google Drive OAuth | Zentrale System-Ablage + Kompression |
| **CRM Sync** | Dialfire API + KlickTipp API | Lead-Routing, Task-Erstellung, Tagging |
| **Automation** | Supabase Edge Functions | Trigger-basierte Workflows |
| **KI-Extraktion** | Claude API (claude-opus-4-8) | KI Upload: Dokument-Analyse (PDF/Vision, Structured Outputs) |
| **Version** | 0.5.0 — KI Upload & Dokumentenablage | Aktiv in Entwicklung |

---

## Supabase Schema (aktuell)

### Core Tables

| Table | Purpose | Key Columns |
|-------|---------|------------|
| `contacts` | Kontakt-Stammdaten | id, first_name, last_name, email, source, status, pipeline_stage, dialfire_campaign_id, dialfire_task_name_field, dialfire_id, klicktipp_id, automation_disabled |
| `activities` | Aktivitäts-Audit-Trail | id, contact_id, type, description, data, created_at |
| `tasks` | Aufgaben pro Kontakt | id, contact_id, title, status, priority, due_date |
| `rules` | Automation Rules | id, name, active, condition_source, actions (JSON), runs |
| `users` | Teambenutzer | id, email, name, active |
| `dokumente_metadata` | Google Drive Dokumente-Index | id, contact_id, file_name, file_size, compressed_size, compression_ratio, google_drive_file_id, uploaded_at |
| `google_drive_system_token` | OAuth System-Token (Single-Row) | id, access_token, refresh_token, expires_at, connected_email, root_folder_id |
| `drive_ordner_map` | Drive-IDs der Kategorie-Unterordner pro Kontakt (für Rename-Propagation) | kontakt_id, pfad, drive_folder_id |

### Supporting Tables

| Table | Purpose |
|-------|---------|
| `opportunities` | Removed from UI (v0.3.0) |
| `pipeline_stages` | Konfigurierbare 12-Schritt-Pipeline |
| `sync_log` | Sync-History für Lead-Import |

---

## Feature-Status (v0.5.0)

### ✅ Implemented (v0.5.0)

| Feature | Status | Notes |
|---------|--------|-------|
| **Kontakt-Verwaltung** | ✅ Done | CRUD, Duplikat-Prüfung, Automation-Integration |
| **12-Schritt-Pipeline** | ✅ Done | Stepper, Auto-Status, Fälligkeitsdaten |
| **Activity Logging** | ✅ Done | Alle Kontakt-Änderungen protokolliert + Automation-Events |
| **Aufgaben-Management** | ✅ Done | Tasks mit Status, Priorität, Fälligkeitsdatum |
| **Aktivitäten-Tab** | ✅ Done | Chronologische Timeline mit Automation-Events |
| **Release Notes** | ✅ Done | In-App Release-History mit Banners |
| **Automation Rules** | ✅ Done | Trigger auf source (Facebook, Calendly, CSV, Email, Manuell); Auto-Feld-Befüllung (Dialfire Campaign/Task, KlickTipp Tags); Manuelle Batch-Ausführung |
| **Automation Engine** | ✅ Done | Läuft automatisch bei Kontakt-Erstellung; matched Regel → setzt Felder → triggt Sync |
| **KlickTipp Sync** | ✅ Done | Auto-Sync bei Kontakt-Erstellung mit Tag "Sentinel"; Activity Logging |
| **Dialfire Sync** | ✅ Done | Create-Pfad + Batch-Pfad; Edge Function mit per-Rule Task-Name; Payload: Alle Felder (Adresse, Industrie, Mitarbeiterzahl, etc.) |
| **Google Drive Dokumentenablage** | ✅ Done | Zentrale System-Ablage (nicht per-User); OAuth mit Auto-Refresh; Kompression (sharp für Bilder/75%, gzip Docs); Statistik-Tracking; Globales `/dokumente` + Kontakt-Tabs |
| **E-Mail-Benachrichtigungen** | ✅ Done | Resend API; Auto-Pfad (pro Kontakt) + Manuell-Pfad (Summary pro Lauf); Versendet wenn send_notification=true in Regel |
| **Regeln-Management** | ✅ Done | `/regeln` Page: Anlegen, Bearbeiten, Löschen, Manuelle Ausführung, Counter (runs), Benachrichtigungen |
| **Dokumenten-Ordnerstruktur** | ✅ Done | Konfigurierbar je Kontakt-Typ (privat/gewerbe) in `/einstellungen/dokumente`; max. 2 Ebenen; Rename propagiert auf bestehende Drive-Ordner (drive_ordner_map); Kategorie-Dropdown + Filter beim Upload |
| **KI Upload** | ✅ Done | `/ki-upload`: Versicherungsdokument (PDF/Foto, auch gescannt) → Claude-Analyse (claude-opus-4-8, Vision + Structured Outputs) → Prüfmaske → Kontakt (Quelle ki_upload, E-Mail optional) + Drive-Ablage in passender Kategorie; Duplikat → anhängen; Vermittler wird nicht als Kontakt extrahiert |

### ⏳ Planned (v0.5+)

| Feature | Target | Notes |
|---------|--------|-------|
| **User Authentication** | v0.5 | Session-based Login |
| **Teams & Permissions** | v0.5 | Role-based Access Control |
| **Auto/Manuell Toggles** | v0.5 | Pro Feld deaktivierbar; UI mit Dropdown/Label |
| **Automation Settings UI** | v0.5 | `/einstellungen` Sektion: Dialfire Kampagnen, Tasks, KlickTipp Tags (texarea → system_config) |
| **Advanced Filtering** | v0.5 | Search, Filter, Sort auf allen Listen |
| **Dialfire Campaign Flexibilität** | v0.5 | Nicht hartcodiert; konfigurierbar via system_config (aktuell nur 2 IDs in Edge-Function) |
| **Reporting & Analytics** | v0.5+ | Dashboards, KPI-Tracking, Regeln-Statistik |

### ❌ Removed (v0.3.0)

- Opportunities (aus UI entfernt)

---

## API Routes

### Contacts

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/kontakte` | GET | Liste aller Kontakte |
| `/api/kontakte` | POST | Neuen Kontakt erstellen + Activity Log |
| `/api/kontakte/[id]` | GET | Kontakt mit Activities, Tasks laden |
| `/api/kontakte/[id]` | PATCH | Kontakt aktualisieren, Pipeline-Fortschritt + Activity Log |
| `/api/kontakte/[id]` | DELETE | Kontakt löschen |

### Activities (Auto-Logged)

| Event | Logged | Details |
|-------|--------|---------|
| Kontakt erstellt | ✅ Yes | first_name, last_name |
| Pipeline-Schritt geändert | ✅ Yes | old/new stage, label |
| Status geändert | ✅ Yes | old/new status |
| Kontakt bearbeitet | ⏳ Ready | Fields changed |
| Kontakt gelöscht | ⏳ Ready | Contact name |
| Task erstellt | ⏳ Ready | Task title |
| Datei hochgeladen | ⏳ Ready | File name, category |

---

## UI Structure

### Main Pages

| Page | Path | Purpose |
|------|------|---------|
| Dashboard | `/` | KPI-Übersicht, neueste Kontakte |
| Kontakte | `/kontakte` | Kontakt-Liste mit Prozess-Fortschritt |
| Kontakt-Detail | `/kontakte/[id]` | 5-Tab Interface |
| Release Notes | `/release-notes` | In-App Feature-History |

### Tabs im Kontakt-Detail (v0.3.0)

1. **Übersicht** — Kontaktdaten, Status, Quelle, Qualität
2. **Prozess** — 12-Schritt-Stepper mit Checkboxes & Fälligkeitsdaten
3. **Aktivitäten** — Audit-Trail aller Änderungen (✅ NEW)
4. **Aufgaben** — Task-Liste mit Status & Priorität (✅ NEW)
5. **Notizen** — Freitextfeld mit Auto-Save

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

- [ ] DELETE-Logging (kontakt löschen loggen)
- [ ] Task-API Routes (vollständiges CRUD)
- [ ] User Authentication & Sessions
- [ ] Team Permissions & Rollen
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

---

*Last Updated: 2026-07-07 — v0.5.0 KI Upload (Claude-Dokumentanalyse), konfigurierbare Ordnerstruktur je Kontakt-Typ, Security-Cleanup*
