-- ============================================================
-- Migration v6 — Leads → Contacts (FIXED REIHENFOLGE)
-- ============================================================

-- 1. NEUE ENUM: task_status, task_priority (keine Abhängigkeiten)
create type if not exists task_status as enum ('offen', 'in_bearbeitung', 'erledigt');
create type if not exists task_priority as enum ('niedrig', 'mittel', 'hoch');
create type if not exists opportunity_status as enum ('neu', 'kontaktiert', 'analyse', 'angebot', 'nachfassen', 'kunde');

-- 2. NEUE TABELLE: users (keine Abhängigkeiten)
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  email text not null unique,
  name text not null,
  active bool default true
);

-- 3. NEUE TABELLE: contacts (erstelle JETZT, bevor opportunities/tasks)
create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- Persönlich
  first_name text not null,
  last_name text not null,
  email text not null,
  phone_mobile text,
  phone_office text,

  -- Firma
  company_name text,
  industry text,
  position text,
  website text,

  -- Adresse
  street text,
  postal_code text,
  city text,
  country text,

  -- Status & Tracking
  source text default 'manuell',
  status text default 'new',
  assigned_user_id uuid references users(id) on delete set null,
  qualität text,
  bestandskunde bool default false,

  -- Daten
  notes text,
  notes_updated_at timestamptz,

  -- Pipeline (optional, für 12-Schritte-System Phase 2)
  pipeline_stage text,
  pipeline_steps jsonb default '[]'::jsonb,

  -- Legacys
  klicktipp_id text,
  dialfire_id text
);

create index contacts_email_idx on contacts(email);
create index contacts_status_idx on contacts(status);
create index contacts_assigned_user_idx on contacts(assigned_user_id);
create index contacts_created_idx on contacts(created_at desc);

-- 4. NEUE TABELLE: opportunities (JETZT dass contacts existiert)
create table if not exists opportunities (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  contact_id uuid not null references contacts(id) on delete cascade,

  thema text not null,
  status opportunity_status default 'neu',
  wert decimal(10, 2),
  nächster_schritt text,
  fällig date,
  notizen text,
  notizen_updated_at timestamptz
);

create index opportunities_contact_idx on opportunities(contact_id);
create index opportunities_status_idx on opportunities(status);

-- 5. NEUE TABELLE: tasks (JETZT dass contacts existiert)
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  contact_id uuid not null references contacts(id) on delete cascade,
  opportunity_id uuid references opportunities(id) on delete set null,
  assigned_user_id uuid references users(id) on delete set null,
  created_by_user_id uuid references users(id) on delete set null,

  titel text not null,
  beschreibung text,
  status task_status default 'offen',
  priorität task_priority default 'mittel',
  fällig date not null,
  erledigt_am timestamptz,

  triggered_by_rule text,
  triggered_by_process_step text
);

create index tasks_contact_idx on tasks(contact_id);
create index tasks_opportunity_idx on tasks(opportunity_id);
create index tasks_assigned_user_idx on tasks(assigned_user_id);
create index tasks_status_idx on tasks(status);
create index tasks_fällig_idx on tasks(fällig);

-- 6. HELPER TRIGGERS
create or replace function set_updated_at_opportunities()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger if not exists opportunities_updated
  before update on opportunities
  for each row execute function set_updated_at_opportunities();

create or replace function set_updated_at_tasks()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger if not exists tasks_updated
  before update on tasks
  for each row execute function set_updated_at_tasks();

-- 7. SEED: Demo-User
insert into users (email, name) values
  ('max@sentinellogic.de', 'Max Mustermann'),
  ('laura@sentinellogic.de', 'Laura Klein'),
  ('system@sentinellogic.de', 'System')
on conflict (email) do nothing;

-- 8. SEED: Demo-Kontakte (damit du sofort testen kannst)
insert into contacts (first_name, last_name, email, phone_mobile, company_name, city, status) values
  ('Max', 'Mustermann', 'max@example.com', '+49 123 456789', 'Beispiel GmbH', 'Hamburg', 'new'),
  ('Laura', 'Klein', 'laura@example.com', '+49 456 789012', 'Klein AG', 'Berlin', 'contacted'),
  ('John', 'Doe', 'john@example.com', '+49 789 012345', 'Doe Consulting', 'München', 'qualified')
on conflict do nothing;
