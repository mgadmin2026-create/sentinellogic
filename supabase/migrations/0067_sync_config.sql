-- Phase 3 der Sync-Architektur-Vereinheitlichung: eine gemeinsame
-- sync_config-Tabelle statt zwei spaltengleicher Tabellen
-- (facebook_sync_config, dialfire_sync_config). Rein additiv: die beiden
-- Alt-Tabellen werden hier NICHT gedroppt (bleiben als ungenutzte Reste
-- stehen, bis der Nutzer nach ausführlichem Testen selbst einen expliziten
-- Cleanup-Schritt entscheidet) und keine bestehenden Spalten verändert.

create table if not exists public.sync_config (
  id uuid primary key default gen_random_uuid(),

  integration text not null unique check (integration in ('facebook', 'dialfire_pull')),

  enabled boolean not null default false,
  interval_type text not null default '15min'
    check (interval_type in ('15min', '30min', '60min', 'daily', 'weekly')),
  daily_hour int default 8,
  weekly_day int default 1,
  weekly_hour int default 8,

  last_sync_at timestamptz,
  next_sync_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sync_config enable row level security;
revoke all on public.sync_config from anon, authenticated;
grant all on public.sync_config to service_role;

comment on table public.sync_config is
  'Vereinheitlichte Scheduler-Konfiguration pro Integration (facebook, dialfire_pull). Ersetzt facebook_sync_config/dialfire_sync_config als Datenquelle; die Alt-Tabellen bleiben unangetastet stehen.';

-- Bestehende Einstellungen übernehmen, damit enabled/interval_type nach dem
-- Umstieg nicht auf die Defaults zurückfallen.
insert into public.sync_config (integration, enabled, interval_type, daily_hour, weekly_day, weekly_hour, last_sync_at, next_sync_at)
select 'facebook', enabled, interval_type, daily_hour, weekly_day, weekly_hour, last_sync_at, next_sync_at
from public.facebook_sync_config
limit 1
on conflict (integration) do nothing;

insert into public.sync_config (integration, enabled, interval_type, daily_hour, weekly_day, weekly_hour, last_sync_at, next_sync_at)
select 'dialfire_pull', enabled, interval_type, daily_hour, weekly_day, weekly_hour, last_sync_at, next_sync_at
from public.dialfire_sync_config
limit 1
on conflict (integration) do nothing;

-- Falls beide Alt-Tabellen leer waren (frisch angelegt, nie konfiguriert),
-- trotzdem eine Default-Zeile pro Integration anlegen, damit die neuen
-- CRUD-Routen immer einen Datensatz zum Lesen/Aktualisieren vorfinden.
insert into public.sync_config (integration)
values ('facebook'), ('dialfire_pull')
on conflict (integration) do nothing;
