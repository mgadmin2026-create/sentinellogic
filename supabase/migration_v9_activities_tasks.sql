-- Migration: Activities und Tasks Tabellen
-- Erstellt am: 2026-06-21

-- ──────────────────────────────────────────────────────
-- ACTIVITIES Tabelle
-- ──────────────────────────────────────────────────────
drop table if exists public.activities cascade;

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null,
  created_at timestamp with time zone default now(),
  type text not null default 'note',
  description text not null,
  data jsonb default null
);

create index if not exists idx_activities_lead_id on public.activities(lead_id);
create index if not exists idx_activities_created_at on public.activities(created_at desc);
create index if not exists idx_activities_type on public.activities(type);

-- ──────────────────────────────────────────────────────
-- TASKS Tabelle (matching existing schema)
-- ──────────────────────────────────────────────────────
drop table if exists public.tasks cascade;

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null,
  opportunity_id uuid default null,
  assigned_user_id uuid default null,
  created_by_user_id uuid default null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  titel text not null,
  beschreibung text default null,
  status text default 'open',
  priorität text default 'medium',
  fällig date not null,
  erledigt_am timestamp with time zone default null,
  triggered_by_rule text default null,
  triggered_by_process_step text default null
);

create index if not exists idx_tasks_contact_id on public.tasks(contact_id);
create index if not exists idx_tasks_status on public.tasks(status);
create index if not exists idx_tasks_fällig on public.tasks(fällig);
create index if not exists idx_tasks_assigned_user_id on public.tasks(assigned_user_id);
create index if not exists idx_tasks_priorität on public.tasks(priorität);

-- ──────────────────────────────────────────────────────
-- Trigger für updated_at
-- ──────────────────────────────────────────────────────
create or replace function public.update_tasks_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tasks_update_timestamp on public.tasks;
create trigger tasks_update_timestamp
  before update on public.tasks
  for each row
  execute function public.update_tasks_timestamp();
