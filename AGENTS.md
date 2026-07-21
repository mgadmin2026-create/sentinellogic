# Sentimental Logic — KI-Kontext für alle Agenten

> Diese Datei wird von allen KI-Tools automatisch gelesen (Codex, Claude Code etc.)
> Immer aktuell halten — nach jedem abgeschlossenen Feature.

-----

## Projekt

**Name:** Sentimental Logic
**Kunde:** Melih Gül — Versicherungsvertrieb
**Auftraggeber:** Jose Luis Rodriguez Arboleda (Online First)
**Ziel:** Vollautomatische Prozessplattform für den Versicherungsvertrieb
**Laufzeit:** Juni – Dezember 2026
**Investition:** 9.000 €

-----

## Tech Stack

|Layer            |Technologie                         |
|-----------------|------------------------------------|
|Frontend         |Next.js 14 (App Router) + TypeScript|
|Datenbank        |Supabase (PostgreSQL + pgvector)    |
|Deployment       |Vercel                              |
|Automatisierung  |Make.com / GitHub Actions           |
|KI               |Claude API (Anthropic)              |
|Authentifizierung|Supabase Auth                       |

-----

## Integrationen

|System         |Zweck                              |Status               |
|---------------|-----------------------------------|---------------------|
|Klicktipp      |E-Mail-Marketing, Tag-Sync         |✅ Zugang vorhanden   |
|Dialfire       |Callcenter, Lead-Anlage            |✅ Zugang vorhanden   |
|SuperChat      |WhatsApp (wird abgelöst in Phase 2)|✅ Zugang vorhanden   |
|AmisNow        |Allianz-Maklersoftware             |⏳ API-Doku ausstehend|
|HiDrive        |Dokumentenablage                   |⏳ Zugang ab Aug/Sep  |
|Calendly       |Terminbuchung                      |⏳ Zugang ausstehend  |
|Facebook/TikTok|Lead Ads Webhook                   |⏳ In Einrichtung     |
|Placetel       |Click-to-Call, Anrufereignisse     |🧪 MVP + offizielle Notify-API vorbereitet|

-----

## Projektstruktur

```
sentinellogic/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # API Routes
│   │   │   ├── leads/          # Lead-Synchronisation
│   │   │   ├── research/       # Gewerbedaten-Bot
│   │   │   ├── ai/             # KI-Endpunkte (Gesprächsvorbereitung)
│   │   │   └── webhooks/       # Eingehende Webhooks (Facebook, Klicktipp)
│   │   ├── dashboard/          # Dashboard UI
│   │   └── leads/              # Lead-Verwaltung UI
│   ├── lib/
│   │   ├── supabase/           # Supabase Client + Queries
│   │   ├── integrations/       # Klicktipp, Dialfire, AmisNow, HiDrive
│   │   ├── ai/                 # Claude API Wrapper
│   │   └── research/           # Gewerbedaten-Recherche Bot
│   ├── types/                  # TypeScript Typen
│   └── components/             # UI Komponenten
├── .github/
│   └── workflows/
│       ├── feature-done.yml    # Pipeline nach Merge → Doku + Testprotokoll
│       └── weekly-report.yml   # Mittwoch 08:00 → Statusbericht
├── docs/                       # Automatisch generierte Dokumentation
├── AGENTS.md                   # Diese Datei — Kontext für alle KIs
├── CLAUDE.md                   # Erweiterter Kontext für Claude Code
├── .env.example                # Alle benötigten Umgebungsvariablen
└── README.md                   # Projektübersicht
```

-----

## Code-Standards

- **Sprache:** TypeScript überall — kein JavaScript
- **Fehlerbehandlung:** Immer `try/catch` mit aussagekräftigem Logging
- **Kommentare:** Auf Deutsch — für den Auftraggeber verständlich
- **API Keys:** Niemals hardcoden — immer aus `process.env`
- **Funktionen:** Klein und fokussiert — eine Funktion, eine Aufgabe
- **Naming:** camelCase für Variablen, PascalCase für Komponenten/Typen

-----

## Git-Workflow

```
main        ← stabil, produktiv (nur via PR)
dev         ← aktive Entwicklung
feature/*   ← einzelne Features (z.B. feature/lead-sync)
```

**Ablauf:**

1. Neues Feature → Branch von `dev`: `git checkout -b feature/feature-name`
1. Entwickeln + committen
1. Merge in `dev` → testen
1. Merge in `main` → Pipeline läuft automatisch

-----

## Aktueller Stand

**Aktive Phase:** Phase 1 — Grundgerüst (Juni 2026)

**Gerade in Arbeit:**

- [ ] Lead-Synchronisation (Klicktipp + Dialfire + Sentimental Logic)
- [ ] Infrastruktur Setup (Supabase, Vercel)
- [ ] Regressionstest-Katalog nach jedem neuen Feature erweitern
- [ ] Placetel-MVP: Echten Callback-Pilot mit Gesprächsdauer und Abschlussstatus durchführen

**Abgeschlossen:**

- [x] Projektsetup + Repository
- [x] AGENTS.md + CLAUDE.md erstellt
- [x] Testdashboard-Grundansicht unter `/testdashboard` integriert
- [x] Live-sichere Testdatenmarkierung und selektive Bereinigung implementiert
- [x] Playwright-Grundkonfiguration, Ergebnisartefakte und erster Dashboard-Test angelegt
- [x] Fest codierte Supabase-/Klicktipp-Secrets aus Wartungsskripten entfernt
- [x] Testdatenmigration auf Live-Supabase angewendet und Guard aktiviert
- [x] Live-Sicherheitsprobe bestanden: ausschließlich markierter Testkontakt wurde bereinigt
- [x] Playwright-Chromium installiert
- [x] Erster Playwright-Live-Lauf erfolgreich durchgeführt
- [x] GitHub Actions und Vercel über geschütztes Cleanup-Token verbunden
- [x] Dauerhafte Testlauf-Historie, KPIs und Aktivitäten im Testdashboard implementiert
- [x] Testfallbeschreibungen, aufklappbare Testschritte und testfallbezogene Durchführungshistorie im Testdashboard ergänzt
- [x] Einzeltestergebnisse je Testlauf mit Grün-/Rot-Status im Testdashboard sichtbar gemacht
- [x] Geschützte Aktivierung/Deaktivierung automatisierter Testfälle mit echter Überspringen-Steuerung in GitHub Actions implementiert
- [x] Migration `0042_test_case_control.sql` auf Live-Supabase angewendet
- [x] E2E-002 und E2E-003 für Kontaktanlage sowie Stammdaten-/Statusänderung automatisiert und aktiviert
- [x] Kontaktverwaltung und Kontaktdetailseite mit E2E-011 (Detailnavigation) und E2E-012 (Aufgabenanlage) erweitert
- [x] Playwright-Selektoren für Kontaktanlage, Detailnavigation, Bearbeitung, Archivstatus und Tag-Chips stabilisiert
- [x] Placetel-Swagger geprüft und technisches Integrationskonzept vervollständigt
- [x] Placetel Call-Control-/Notify-Dokumentation geprüft und Webhook auf HMAC, Dauer sowie offizielle Auflegegründe umgestellt
- [x] Migration `0047_placetel_notify_statuses.sql` angewendet und Placetel Notify API konfiguriert

**Nächste Aufgabe:**
→ Vollständigen Regressionstest erneut ausführen und verbleibende fachliche Fehler beschreiben

-----

## Supabase Schema (Zielzustand Phase 1)

```sql
-- Leads
create table leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  source text,                    -- 'facebook' | 'tiktok' | 'manual'
  first_name text,
  last_name text,
  email text,
  phone text,
  company_name text,
  status text default 'new',      -- 'new' | 'contacted' | 'qualified' | 'customer'
  klicktipp_id text,
  dialfire_id text,
  research_data jsonb,            -- Gewerbedaten vom Bot
  notes text
);

-- Customers (konvertierte Leads)
create table customers (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id),
  created_at timestamptz default now(),
  hidrive_folder_url text,
  amisnow_id text
);

-- Activities (Protokoll aller Aktionen)
create table activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id),
  created_at timestamptz default now(),
  type text,                      -- 'sync' | 'research' | 'ai_prep' | 'status_change'
  description text,
  data jsonb
);
```

-----

## Wichtige Hinweise für alle KI-Tools

1. **Niemals** Kundendaten (Melih Güls Daten) in Logs schreiben
1. **Immer** DSGVO-konform — keine Weitergabe an externe APIs außer den definierten
1. **Vor jedem Feature** diese Datei lesen — Kontext ist entscheidend
1. **Nach jedem Feature** den “Aktueller Stand” Abschnitt aktualisieren
1. Der Projektname im System ist “Sentimental Logic” — nicht “Sentinel”
