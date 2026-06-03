-- ============================================================
-- Sentimental Logic — Datenbankschema
-- Ausführen im Supabase SQL-Editor: https://supabase.com/dashboard
-- Projekt: wwetuauicumqjczfdtcd
-- ============================================================

-- ── ENUMS ──────────────────────────────────────────────────────

create type lead_status as enum ('new', 'contacted', 'qualified', 'customer');
create type lead_source as enum ('facebook', 'tiktok', 'calendly', 'csv', 'email');
create type activity_type as enum ('sync', 'research', 'ai_prep', 'status_change');

-- ── LEADS ──────────────────────────────────────────────────────

create table leads (
  -- Basisdaten
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz default now(),
  source                lead_source not null,
  status                lead_status not null default 'new',

  -- Kontaktdaten
  first_name            text not null,
  last_name             text not null,
  email                 text,
  phone_mobile          text,
  phone_office          text,
  address               text,

  -- Persönliche Daten
  birth_date            date,
  marital_status        text,
  children              int,
  profession            text,
  profession_group      text,
  position              text,

  -- Unternehmensdaten
  company_name          text,
  legal_form            text,
  founded_year          int,
  employees             int,
  annual_revenue        text,
  trade_register        text,
  vat_id                text,
  industry              text,
  business_description  text,
  website               text,
  headquarters          text,

  -- Versicherungsstatus
  existing_insurances   text[] default '{}',
  current_providers     text,
  monthly_premium       text,
  coverage_gaps         text,
  next_renewals         jsonb default '[]',   -- [{type, date}]

  -- Gewerbedaten (automatisch recherchiert)
  research_data         jsonb,

  -- Gesprächshistorie
  first_contact_date    date,
  first_contact_channel text,
  last_contact_date     date,
  next_contact          jsonb,               -- {date, time}
  contact_count         int default 0,

  -- Externe System-IDs
  klicktipp_id          text,
  dialfire_id           text,

  -- Freitext
  notes                 text,
  notes_updated_at      timestamptz
);

-- Index für häufige Abfragen
create index leads_status_idx  on leads(status);
create index leads_source_idx  on leads(source);
create index leads_created_idx on leads(created_at desc);

-- ── CUSTOMERS ──────────────────────────────────────────────────

create table customers (
  id                 uuid primary key default gen_random_uuid(),
  lead_id            uuid references leads(id) on delete set null,
  created_at         timestamptz default now(),
  hidrive_folder_url text,
  amisnow_id         text
);

-- ── ACTIVITIES ─────────────────────────────────────────────────

create table activities (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid references leads(id) on delete cascade,
  created_at  timestamptz default now(),
  type        activity_type not null,
  description text not null,
  data        jsonb
);

create index activities_lead_idx     on activities(lead_id);
create index activities_created_idx  on activities(created_at desc);

-- ── ROW LEVEL SECURITY ─────────────────────────────────────────
-- Erstmal deaktiviert — aktivieren sobald Auth eingebaut ist

alter table leads      disable row level security;
alter table customers  disable row level security;
alter table activities disable row level security;

-- ── HELPER FUNCTION: updated_at Trigger ────────────────────────

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.notes_updated_at = now();
  return new;
end;
$$;

-- Trigger: notes_updated_at automatisch setzen wenn notes sich ändert
create trigger leads_notes_updated
  before update of notes on leads
  for each row execute function set_updated_at();

-- ── SEED-DATEN (optional, zum Testen) ──────────────────────────
-- Kommentar entfernen um 2 Test-Leads einzufügen

/*
insert into leads (first_name, last_name, email, phone_mobile, source, status, company_name, industry, existing_insurances, coverage_gaps) values
  ('Thomas', 'Müller', 'thomas.mueller@elektro-mueller.de', '+49 176 4421 8800', 'facebook', 'new', 'Elektro Müller GmbH', 'Elektrotechnik / Handwerk', array['KFZ','BHV'], 'Kein Cyber-Schutz, keine Betriebsunterbrechung'),
  ('Sabine', 'Hoffmann', 'sabine.hoffmann@praxis-hoffmann.de', '+49 151 2234 7766', 'calendly', 'qualified', 'Allgemeinarztpraxis Hoffmann', 'Gesundheitswesen', array['Kranken','Leben','KFZ','Berufshaftpflicht'], 'Keine Berufsunfähigkeit, keine Cyber-Versicherung');
*/
