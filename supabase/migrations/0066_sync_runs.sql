-- Fundament für die vereinheitlichte Automation-/Sync-Architektur (Phase A der
-- Roadmap: "Automation + Synchronisation vereinheitlichen", "Einheitliches
-- Log-Handling", "Einheitliches Fehler-/Retry-Handling"). Rein additiv: ersetzt
-- weder activities noch sync_log noch dialfire_sync_log. Angelehnt an das
-- ausgereifteste bestehende Muster, klicktipp_webhook_events
-- (0064_klicktipp_reverse_sync.sql), erweitert um Retry-Felder und eine
-- Batch/Item-Verschachtelung für Job-Läufe.

create table if not exists public.sync_runs (
  id uuid primary key default gen_random_uuid(),

  run_kind text not null check (run_kind in ('batch', 'item')),
  parent_run_id uuid references public.sync_runs(id) on delete set null,

  contact_id uuid references public.contacts(id) on delete set null,
  rule_id uuid references public.rules(id) on delete set null,
  integration text not null,
  trigger_type text not null check (trigger_type in ('auto', 'manual', 'cron', 'webhook')),

  status text not null default 'pending'
    check (status in ('pending', 'running', 'success', 'failed', 'retrying', 'dead_letter', 'skipped')),

  attempt_count int not null default 0,
  max_attempts int not null default 3,
  next_retry_at timestamptz,

  error_class text,
  error_detail text,

  data jsonb not null default '{}'::jsonb,

  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists sync_runs_integration_status_idx
  on public.sync_runs (integration, status, started_at desc);

create index if not exists sync_runs_contact_idx
  on public.sync_runs (contact_id, started_at desc);

create index if not exists sync_runs_rule_idx
  on public.sync_runs (rule_id, started_at desc);

create index if not exists sync_runs_retry_due_idx
  on public.sync_runs (next_retry_at)
  where status = 'retrying';

create index if not exists sync_runs_parent_idx
  on public.sync_runs (parent_run_id);

alter table public.sync_runs enable row level security;
revoke all on public.sync_runs from anon, authenticated;
grant all on public.sync_runs to service_role;

comment on table public.sync_runs is
  'Vereinheitlichtes Job-/Attempt-Modell für Automation- und Sync-Läufe (KlickTipp, Dialfire, Facebook, SuperChat, STRATO, ...). run_kind=batch ist ein Job-Aufruf (Cron-Tick, manueller Klick), run_kind=item ein Kontakt-Versuch darunter (parent_run_id).';
comment on column public.sync_runs.error_class is
  'transient|rate_limit (retrybar), validation|auth (nicht retrybar, menschliche Prüfung nötig), unknown (einmal retrybar).';
