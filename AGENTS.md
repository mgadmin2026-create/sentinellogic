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
|Automatisierung  |GitHub Actions / Vercel Cron        |
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

- [ ] Lead-Synchronisation (Dialfire + Sentimental Logic) weiter stabilisieren; KlickTipp-Outbound ist live
- [ ] Infrastruktur Setup (Supabase, Vercel)
- [ ] Regressionstest-Katalog nach jedem neuen Feature erweitern
- [ ] Placetel-MVP: Echten Callback-Pilot mit Gesprächsdauer und Abschlussstatus durchführen
- [ ] KlickTipp-Rücksync mit echten Öffnungs-, Klick- und Abmeldeereignissen abnehmen; danach regelmäßigen Statusabgleich aktivieren
- [ ] Vollständigen Export der 719 KlickTipp-Tags klassifizieren und Kampagnen-/Webhook-Abhängigkeiten vor einer Bereinigung prüfen

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
- [x] Key-User-Präsentation zum aktuellen Anwendungsstand erstellt
- [x] Regressionstest-Status geprüft: letzter vollständiger Lauf 11/11 grün; aktuelle Pipeline durch HTTP 401 vor Teststart blockiert
- [x] Regressionstest-Katalog auf 30 automatisierte Szenarien erweitert: Auth-Schutz, persönliches Dashboard, Mail-Vorlagen, Kalender, Sync-Kontrollzentrum, Datenschutz und Kontakt-E-Mail mit Cc/Bcc/Anhang
- [x] Geschützten Zugriff der Regressionstest-Pipeline auf `/api/test-cases` über das Cleanup-Token ergänzt und den bisherigen HTTP-401-Blocker behoben
- [x] Aufgaben-Kommentar-Test auf den sichtbaren Historien-Drawer stabilisiert und das Testdashboard öffnet automatisch den jüngsten Lauf mit vorhandenen Einzeltestergebnissen
- [x] Fehlerlauf mit 23/30 grünen Tests analysiert, SuperChat-Test E2E-019 deaktiviert und Testfehler bei Kommentaren, Kontaktdetail sowie Profil-Sitzung korrigiert
- [x] Kontaktarchiv-Ansicht gegen überholende API-Antworten bei schnellen Filterwechseln abgesichert
- [x] Testdaten-Bereinigung um polymorphe Kommentare und Dokument-Anhänge erweitert, damit ausschließlich markierte Testkontakte wieder vollständig vorbereitet werden können
- [x] Idempotente Einzelkontakt-Synchronisation zu SuperChat mit Status, Aktivitätsprotokoll und E2E-019 implementiert
- [x] Migration `0054_superchat_contact_sync.sql` auf Live-Supabase verifiziert
- [x] SuperChat-Live-Pilot mit technisch markiertem `TESTKONTAKT` erfolgreich durchgeführt
- [x] SuperChat-Feldmapping um Firma, Adresse und Geburtsdatum sowie direkten Kontaktlink erweitert
- [x] Geschützte Admin-Sammelaktion für aktive, unverknüpfte Facebook-Kontakte nach SuperChat ergänzt
- [x] Kontaktübersicht um Verantwortlichen-Kürzel und kompakten Integrationsstatus mit IDs, Kampagne und Tags erweitert
- [x] STRATO-E-Mail-Postfach als IMAP-/SMTP-MVP mit Posteingang, Lesen, Antworten, Versand und Kontaktzuordnung integriert
- [x] Eingehende STRATO-E-Mails bekannter Kontakte idempotent in der Aktivitäten-Timeline ergänzt und Migration `0061_strato_incoming_email_activities.sql` live angewendet
- [x] Regel-Sammelausführung zeigt KlickTipp-Erfolge, Fehler und übersprungene Übertragungen; archivierte Kontakte werden ausgeschlossen
- [x] Abgesicherten, idempotenten KlickTipp-Rückkanal für Ereignisse sowie additiven E-Mail-Statusabgleich technisch implementiert
- [x] KlickTipp-Direktsynchronisation um Anmeldung mit dediziertem API User und Partner-Schlüssel-Fallback erweitert
- [x] KlickTipp-Feldmapping um Geburtstag (Unix-Zeitstempel), Straße, PLZ und optionales Geschlechtsfeld erweitert
- [x] KlickTipp-Integration auf direkten Management-API-Client mit Partner-HMAC, Kontakt-/Tag-Sync und Bestandsabgleich vereinheitlicht; alten Make-/Edge-Webhook-Weg entfernt
- [x] KlickTipp-API-Zugriff für den dedizierten API-User `bosydadaq-api2` vom Hauptkonto freigegeben, in Vercel konfiguriert und erfolgreich deployed
- [x] Direkten Kontakt-/Tag-Sync mit markiertem Pilotkontakt live bestätigt; jeder reguläre aktive Kontakt mit E-Mail wird übertragen
- [x] KlickTipp-Rücksync-Migration `0064_klicktipp_reverse_sync.sql`, Webhook-Secret und manuellen Statusabgleich ausgerollt; Opt-in-Statuswechsel live erkannt
- [x] Aktiven, abgesicherten KlickTipp-JSON-Webhook `Sentimental Logic – Sentinel-Tag` (ID `176539`) für das Tag `Sentinel` eingerichtet
- [x] KlickTipp-Tag-Bestand geprüft: 719 manuelle Tags und sechs ausgehende Webhooks; Alt-Webhook `Sentinel Logic Sync` (ID `169322`) bis zum kontrollierten Vergleich geschützt
- [x] Vierseitige KlickTipp-Tag-Bestandsaufnahme unter `output/pdf/klicktipp-tag-bestandsaufnahme-2026-08-05.pdf` erstellt
- [x] Kontaktübersicht auf vier sichtbare Ansichtsbuttons, eine einzeilige Suche-/Sparte-Filterleiste und eine gemeinsame Kopf-Aktionsleiste umgestellt; Standardspalten entsprechen der Key-User-Vorgabe und sind nach neuestem Kontakt sortiert
- [x] Rücksprung aus dem Kontaktdetail stellt neben Ansicht, Suche und Sortierung auch die vorherige Seiten- und Tabellen-Scrollposition der Kontaktübersicht wieder her; dies gilt auch für den Sidebar-Menüpunkt „Kontakte“ und weitere Detail-Rückwege
- [x] SuperChat-Bestandsverknüpfung ergänzt: bereits vorhandene Kontakte können über eine Sonderaktion nur bei eindeutigem exaktem E-Mail-/Telefon-Treffer mit Sentinel verbunden und anschließend direkt in SuperChat geöffnet werden
- [x] Geschützten SuperChat-Sammelabgleich ergänzt, der den Providerbestand einmalig einliest und offene aktive Sentinel-Kontakte ausschließlich bei beidseitig eindeutiger E-Mail-/Telefon-Zuordnung verbindet
- [x] Kontaktübersicht um persistente Filter-/Sortierrückkehr, vier Fachansichten und Statusfarben auf der gesamten Zeile erweitert
- [x] Kontaktdetail aufgeräumt: Prozess und Kommentare ins Drei-Punkte-Menü verschoben; Erstgespräch-PDF mit optionalen Leerfeldern ergänzt
- [x] SuperChat-Direktlink präzisiert und Statusregel `Kunde` → Gesprächslabel `Kunde AZ` implementiert
- [x] Sichtbarkeit markierter Testkontakte und -aufgaben je Teammitglied steuerbar gemacht; bestehende markierte Testdaten live bereinigt
- [x] KlickTipp-Tagkorrektur für 218 Kontakte produktiv abgeschlossen: Gewerbe (`AZ Kunden`, `AZ Firmen Kunden`), Privat (`AZ Kunden`, `Kinderprofis`), 0 Fehler und 0 offene Kandidaten
- [x] Regressionstest-Katalog um E2E-028 und E2E-029 für Kontaktansichten, Rücksprung, Detailmenü und Erstgespräch-PDF erweitert
- [x] Aktionsmenü und verschachtelte Drawer stabilisiert; Regressionstests an die neue Kontaktoberfläche angepasst

**Nächste Aufgabe:**
→ SuperChat-Gesprächslabel `Kunde AZ` mit einem echten Pilotkontakt abnehmen; anschließend KlickTipp-Öffnungs-, Klick- und Abmeldeereignisse im Rückkanal prüfen

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
