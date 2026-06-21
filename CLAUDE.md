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
| **Version** | 0.3.0 — MVP | Aktiv in Entwicklung |

---

## Supabase Schema (aktuell)

### Core Tables

| Table | Purpose | Key Columns |
|-------|---------|------------|
| `contacts` | Kontakt-Stammdaten | id, first_name, last_name, email, source, status, pipeline_stage |
| `activities` | Aktivitäts-Audit-Trail | id, lead_id, type, description, data, created_at |
| `tasks` | Aufgaben pro Kontakt | id, titel, status, priorität, fällig |
| `users` | Teambenutzer | id, email, name, active |

### Supporting Tables

| Table | Purpose |
|-------|---------|
| `opportunities` | Exists but removed from UI (v0.3.0) |
| `pipeline_stages` | Konfigurierbare 12-Schritt-Pipeline |
| `sync_log` | Sync-History für Lead-Import |
| `rules` | Automation Rules (geplant) |

---

## Feature-Status (v0.3.0)

### ✅ Implemented

| Feature | Status | Notes |
|---------|--------|-------|
| **Kontakt-Verwaltung** | ✅ Done | CRUD, Duplikat-Prüfung |
| **12-Schritt-Pipeline** | ✅ Done | Stepper, Auto-Status, Fälligkeitsdaten |
| **Activity Logging** | ✅ Done | Alle Kontakt-Änderungen protokolliert |
| **Aufgaben-Management** | ✅ Done | Tasks mit Status, Priorität, Fälligkeitsdatum |
| **Aktivitäten-Tab** | ✅ Done | Chronologische Timeline |
| **Release Notes** | ✅ Done | In-App Release-History mit Banners |

### ⏳ Planned

| Feature | Target | Notes |
|---------|--------|-------|
| **User Authentication** | v0.4 | Session-based Login |
| **Teams & Permissions** | v0.4 | Role-based Access Control |
| **Advanced Filtering** | v0.4 | Search, Filter, Sort auf allen Listen |
| **Automation Rules** | v0.5 | Trigger-based Actions |
| **Reporting & Analytics** | v0.5 | Dashboards, KPI-Tracking |
| **File Storage** | v0.5 | Upload & Link Files to Contacts |

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
- ✅ Teste lokal mit `npm run dev`
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

### v0.3.0 (2026-06-22) — Activity Logging Release

- ✅ Activity Logging System mit `src/lib/activities-logger.ts`
- ✅ `activities` & `tasks` Tabellen in Supabase
- ✅ Aktivitäten-Tab im Kontakt-Detail
- ✅ Aufgaben-Tab im Kontakt-Detail
- ✅ Opportunities aus UI entfernt
- ✅ Auto-Logging für Kontakt-Erstellung
- ✅ Auto-Logging für Pipeline-Fortschritt
- ✅ Release Notes v0.3.0 dokumentiert

### v0.2.0 (2026-06-20) — Pipeline Release

- ✅ 12-Schritt-Pipeline
- ✅ Process Stepper UI
- ✅ Release Notes System

---

## Known Issues

### High Priority

- [ ] DELETE-Logging (kontakt löschen loggen)
- [ ] Task-API Routes (CRUD)

### Medium Priority

- [ ] User Authentication
- [ ] Team Permissions
- [ ] Advanced Search

---

## Commands

```bash
npm run dev          # Entwicklung
npm run build        # Production Build
git push origin main # Deploy zu Vercel
```

---

*Last Updated: 2026-06-22 — v0.3.0 Activity Logging & Audit Trail Implementation*
