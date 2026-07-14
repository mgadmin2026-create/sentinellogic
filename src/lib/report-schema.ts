// Kuratiertes DB-Schema als Kontext für die NL→SQL-Generierung (Reporting).
// WICHTIG: Bei Schema-Änderungen hier pflegen. Geheim-/Token-Tabellen bewusst NICHT aufführen.
//
// Hinweis für SQL: Spalten mit Umlauten (z. B. "prüfung_grund", "priorität",
// "fällig", "nächster_schritt", "qualität", "notizen") müssen doppelt gequotet werden.

export const REPORT_SCHEMA = `
Datenbank: PostgreSQL. Schema "public". Nur diese Tabellen dürfen abgefragt werden:

TABELLE contacts  — Kontakte/Leads (Haupttabelle, jeder Kunde/Interessent)
  id uuid
  first_name text, last_name text, email text
  phone_mobile text, phone_office text
  company_name text, industry text, position text
  street text, "hausnummer" text, postal_code text, city text, country text
  source text            -- Herkunft: 'facebook','tiktok','calendly','csv','email','manuell','ki_upload'
  status text            -- 'new','contacted','qualified','customer' (NULL = neu)
  pipeline_stage text    -- Prozessschritt: lead_in, contacted, data_gathering, wait_policies,
                         --   calc_offers, download_offers, contract_overview, send_offers,
                         --   offer_meeting, sales_talk, contracts_store, aftercare
  kontakt_typ text       -- 'privat' | 'gewerbe'
  insurance_product text -- Versicherungsprodukt: 'PKV' oder 'Unternehmerschutz' (NULL möglich)
  "prüfung_grund" text   -- Prüfgrund: bei PKV z.B. Freitext; bei Unternehmerschutz:
                         --   'betriebshaftpflicht','strafrechtsschutz','unternehmerschutz_paket','d&o'
  "krankenversicherung_status" text, situation text  -- PKV-Felder
  bestandskunde boolean, "qualität" text, notes text
  mitarbeitanzahl int, jahresumsatz numeric, jahreseinkommen numeric
  dialfire_id text, dialfire_campaign_id text
  dialfire_last_call_at timestamptz, dialfire_last_call_status text, dialfire_disposition text
  created_at timestamptz, updated_at timestamptz

TABELLE activities  — Aktivitäts-/Audit-Log pro Kontakt
  id uuid
  lead_id uuid          -- ACHTUNG: verweist auf contacts.id (Join: activities.lead_id = contacts.id)
  type text             -- z.B. 'contact_created','status_changed','dialfire_synced','email_sent', ...
  description text
  data jsonb
  created_at timestamptz

TABELLE tasks  — Aufgaben
  id uuid, contact_id uuid, opportunity_id uuid
  titel text, beschreibung text
  status text            -- 'offen','in_bearbeitung','erledigt'
  "priorität" text       -- 'niedrig','mittel','hoch'
  "fällig" date          -- Fälligkeitsdatum
  assigned_user_name text
  created_at timestamptz, updated_at timestamptz

TABELLE opportunities  — Verkaufschancen pro Kontakt
  id uuid, contact_id uuid
  thema text
  status text
  wert numeric           -- Wert in Euro
  "nächster_schritt" text, "fällig" date, notizen text
  created_at timestamptz, updated_at timestamptz

TABELLE contracts  — Verträge pro Kontakt
  id uuid, contact_id uuid
  contract_number text
  insurance_type text        -- Gesellschaft, z.B. 'Allianz','Debeka'
  contract_type text         -- 'eigen','fremd','unknown'
  insurance_category text     -- z.B. 'Krankenversicherung','KFZ'
  monthly_premium text        -- Beitrag als Text, z.B. '€150/Monat'
  duration_start date, duration_end date
  created_at timestamptz

TABELLE dialfire_sync_log  — Dialfire-Sync-Protokoll
  id uuid, contact_id uuid, dialfire_id text
  sync_status text            -- 'success','error'
  changed_fields jsonb, changes jsonb, error_message text
  created_at timestamptz

Beziehungen:
  activities.lead_id       -> contacts.id
  tasks.contact_id         -> contacts.id
  opportunities.contact_id -> contacts.id
  contracts.contact_id     -> contacts.id
  dialfire_sync_log.contact_id -> contacts.id
`.trim()
