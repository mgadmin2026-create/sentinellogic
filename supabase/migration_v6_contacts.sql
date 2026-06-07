-- ============================================================
-- Migration v6 — Leads → Contacts (Datenmodell-Umstrukturierung)
-- Sentinel Logic: Von Lead-Management zu Makler-Betriebssystem
-- ============================================================

-- ── NEUE TABELLE: users (Team-Mitglieder) ───────────────────
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  email text not null unique,
  name text not null,
  active bool default true
);

-- ── NEUE ENUM: opportunity_status ──────────────────────────
create type opportunity_status as enum ('neu', 'kontaktiert', 'analyse', 'angebot', 'nachfassen', 'kunde');

-- ── NEUE TABELLE: opportunities ─────────────────────────────
create table if not exists opportunities (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  contact_id uuid not null references contacts(id) on delete cascade,

  -- Opportunity-Daten
  thema text not null,                    -- z.B. "KFZ", "BU", "Hausrat"
  status opportunity_status default 'neu',
  wert decimal(10, 2),                    -- Geschätzter Wert
  nächster_schritt text,                  -- Nächster Schritt/Action
  fällig date,                             -- Fälligkeitsdatum

  -- Intern
  notizen text,
  notizen_updated_at timestamptz
);

create index opportunities_contact_idx on opportunities(contact_id);
create index opportunities_status_idx on opportunities(status);

-- ── NEUE ENUM: task_status ─────────────────────────────────
create type task_status as enum ('offen', 'in_bearbeitung', 'erledigt');
create type task_priority as enum ('niedrig', 'mittel', 'hoch');

-- ── NEUE TABELLE: tasks ────────────────────────────────────
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- Verknüpfungen
  contact_id uuid not null references contacts(id) on delete cascade,
  opportunity_id uuid references opportunities(id) on delete set null,
  assigned_user_id uuid references users(id) on delete set null,
  created_by_user_id uuid references users(id) on delete set null,

  -- Task-Daten
  titel text not null,
  beschreibung text,
  status task_status default 'offen',
  priorität task_priority default 'mittel',
  fällig date not null,
  erledigt_am timestamptz,

  -- Trigger/Automation
  triggered_by_rule text,                 -- z.B. "process_step_offer"
  triggered_by_process_step text
);

create index tasks_contact_idx on tasks(contact_id);
create index tasks_opportunity_idx on tasks(opportunity_id);
create index tasks_assigned_user_idx on tasks(assigned_user_id);
create index tasks_status_idx on tasks(status);
create index tasks_fällig_idx on tasks(fällig);

-- ── UPDATE: leads → contacts (Spalten erweitern) ────────────
alter table leads
  add column if not exists assigned_user_id uuid references users(id) on delete set null,
  add column if not exists qualität text,
  add column if not exists bestandskunde bool default false;

-- Rename table (logisch, aber wir behalten "leads" physical für backward compatibility)
-- Statt: create view contacts as select ... from leads;
-- Besser: leads bleiben, wir erstellen eine neue "contacts" Tabelle mit kopiertem Schema

-- ── CREATE: contacts (neu, basierend auf leads) ─────────────
create table if not exists contacts as
select * from leads where 1=0;  -- Struktur kopieren, keine Daten

-- Füge fehlende Spalten hinzu
alter table contacts
  add column if not exists assigned_user_id uuid references users(id) on delete set null,
  add column if not exists qualität text,
  add column if not exists bestandskunde bool default false;

-- Index
create index contacts_status_idx on contacts(status);
create index contacts_assigned_user_idx on contacts(assigned_user_id);
create index contacts_created_idx on contacts(created_at desc);

-- ── MIGRATION: leads → contacts (Daten kopieren) ────────────
-- Dies wird manuell durchgeführt nach Verifikation
-- insert into contacts select * from leads;

-- ── UPDATE: activities (Activity Type erweitern) ────────────
-- Neue Types für erweiterte Timeline
do $$
begin
  if not exists (select 1 from pg_enum where enumlabel = 'task_created') then
    alter type activity_type add value 'task_created';
    alter type activity_type add value 'task_completed';
    alter type activity_type add value 'opportunity_created';
    alter type activity_type add value 'opportunity_updated';
  end if;
end $$;

-- ── HELPER: Updated-At Trigger für Opportunities ────────────
create or replace function set_updated_at_opportunities()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger opportunities_updated
  before update on opportunities
  for each row execute function set_updated_at_opportunities();

-- ── HELPER: Updated-At Trigger für Tasks ────────────────────
create or replace function set_updated_at_tasks()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tasks_updated
  before update on tasks
  for each row execute function set_updated_at_tasks();

-- ── SEED: Demo-User ─────────────────────────────────────────
insert into users (email, name) values
  ('max@sentinellogic.de', 'Max Mustermann'),
  ('laura@sentinellogic.de', 'Laura Klein'),
  ('system@sentinellogic.de', 'System')
on conflict (email) do nothing;
