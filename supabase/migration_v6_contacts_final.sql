-- ============================================================
-- Migration v6 — Leads → Contacts (SUPABASE COMPATIBLE)
-- ============================================================

-- 1. NEUE ENUMS (ohne IF NOT EXISTS — Supabase unterstützt das nicht)
do $$
begin
  create type task_status as enum ('offen', 'in_bearbeitung', 'erledigt');
exception when duplicate_object then
  null;
end $$;

do $$
begin
  create type task_priority as enum ('niedrig', 'mittel', 'hoch');
exception when duplicate_object then
  null;
end $$;

do $$
begin
  create type opportunity_status as enum ('neu', 'kontaktiert', 'analyse', 'angebot', 'nachfassen', 'kunde');
exception when duplicate_object then
  null;
end $$;

-- 2. NEUE TABELLE: users
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  email text not null unique,
  name text not null,
  active bool default true
);

-- 3. NEUE TABELLE: contacts
create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  first_name text not null,
  last_name text not null,
  email text not null,
  phone_mobile text,
  phone_office text,

  company_name text,
  industry text,
  position text,
  website text,

  street text,
  postal_code text,
  city text,
  country text,

  source text default 'manuell',
  status text default 'new',
  assigned_user_id uuid references users(id) on delete set null,
  qualität text,
  bestandskunde bool default false,

  notes text,
  notes_updated_at timestamptz,

  pipeline_stage text,
  pipeline_steps jsonb default '[]'::jsonb,

  klicktipp_id text,
  dialfire_id text
);

create index if not exists contacts_email_idx on contacts(email);
create index if not exists contacts_status_idx on contacts(status);
create index if not exists contacts_assigned_user_idx on contacts(assigned_user_id);
create index if not exists contacts_created_idx on contacts(created_at desc);

-- 4. NEUE TABELLE: opportunities
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

create index if not exists opportunities_contact_idx on opportunities(contact_id);
create index if not exists opportunities_status_idx on opportunities(status);

-- 5. NEUE TABELLE: tasks
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

create index if not exists tasks_contact_idx on tasks(contact_id);
create index if not exists tasks_opportunity_idx on tasks(opportunity_id);
create index if not exists tasks_assigned_user_idx on tasks(assigned_user_id);
create index if not exists tasks_status_idx on tasks(status);
create index if not exists tasks_fällig_idx on tasks(fällig);

-- 6. HELPER TRIGGERS
create or replace function set_updated_at_opportunities()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists opportunities_updated on opportunities;
create trigger opportunities_updated
  before update on opportunities
  for each row execute function set_updated_at_opportunities();

create or replace function set_updated_at_tasks()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tasks_updated on tasks;
create trigger tasks_updated
  before update on tasks
  for each row execute function set_updated_at_tasks();

-- 7. SEED: Demo-User
insert into users (email, name) values
  ('max@sentinellogic.de', 'Max Mustermann'),
  ('laura@sentinellogic.de', 'Laura Klein'),
  ('system@sentinellogic.de', 'System')
on conflict (email) do nothing;

-- 8. SEED: Demo-Kontakte
insert into contacts (first_name, last_name, email, phone_mobile, company_name, city, status) values
  ('Max', 'Mustermann', 'max@example.com', '+49 123 456789', 'Beispiel GmbH', 'Hamburg', 'new'),
  ('Laura', 'Klein', 'laura@example.com', '+49 456 789012', 'Klein AG', 'Berlin', 'contacted'),
  ('John', 'Doe', 'john@example.com', '+49 789 012345', 'Doe Consulting', 'München', 'qualified')
on conflict do nothing;
