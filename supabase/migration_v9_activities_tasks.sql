-- Migration: Activities und Tasks Tabellen
-- Erstellt am: 2026-06-21

-- ──────────────────────────────────────────────────────
-- ACTIVITIES Tabelle
-- ──────────────────────────────────────────────────────
create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  type text not null, -- 'call', 'email', 'meeting', 'note', 'status_change', etc.
  description text not null,
  data jsonb, -- Zusätzliche Daten (z.B. Anrufdauer, E-Mail-Betreff, etc.)
  created_by uuid, -- Zukünftig: User-ID wer die Aktivität erstellt hat
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index if not exists idx_activities_contact_id on activities(contact_id);
create index if not exists idx_activities_created_at on activities(created_at desc);
create index if not exists idx_activities_type on activities(type);

-- ──────────────────────────────────────────────────────
-- TASKS Tabelle
-- ──────────────────────────────────────────────────────
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'open', -- 'open', 'in_progress', 'done'
  priority text not null default 'medium', -- 'low', 'medium', 'high'
  due_date date,
  assigned_user_id uuid,
  created_by uuid,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  completed_at timestamp with time zone
);

create index if not exists idx_tasks_contact_id on tasks(contact_id);
create index if not exists idx_tasks_status on tasks(status);
create index if not exists idx_tasks_due_date on tasks(due_date);
create index if not exists idx_tasks_assigned_user_id on tasks(assigned_user_id);
create index if not exists idx_tasks_priority on tasks(priority);

-- ──────────────────────────────────────────────────────
-- POLICIES (RLS) — Optional: Später aktivieren
-- ──────────────────────────────────────────────────────
-- alter table activities enable row level security;
-- alter table tasks enable row level security;

-- ──────────────────────────────────────────────────────
-- Trigger für updated_at
-- ──────────────────────────────────────────────────────
create or replace function update_activities_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace function update_tasks_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger activities_update_timestamp
  before update on activities
  for each row
  execute function update_activities_timestamp();

create trigger tasks_update_timestamp
  before update on tasks
  for each row
  execute function update_tasks_timestamp();
