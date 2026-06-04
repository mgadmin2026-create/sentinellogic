-- ============================================================
-- Migration v3 — Regeln + Sync-Protokoll Tabellen
-- Im Supabase SQL-Editor ausführen
-- ============================================================

-- ── REGELN ─────────────────────────────────────────────────
create table if not exists rules (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz default now(),
  name             text not null,
  condition_source text not null default 'all',
  -- actions: {klicktipp_tag?, dialfire_campaign?, set_status?, send_notification?, notification_email?}
  actions          jsonb not null default '{}',
  active           boolean default true,
  runs             int default 0
);

-- Standard-Regeln + gewünschte Facebook→Sentinel Regel
insert into rules (name, condition_source, actions, active) values
  (
    'Facebook → KlickTipp Sentinel',
    'facebook',
    '{"klicktipp_tag":"Sentinel","send_notification":true,"notification_email":"mg.admin2026@gmail.com"}',
    true
  ),
  (
    'Calendly → Qualifiziert setzen',
    'calendly',
    '{"klicktipp_tag":"termin-vereinbart","set_status":"qualified","send_notification":true,"notification_email":"mg.admin2026@gmail.com"}',
    true
  ),
  (
    'CSV → Kalt-Akquise Kampagne',
    'csv',
    '{"klicktipp_tag":"csv-import","dialfire_campaign":"Kalt-Akquise"}',
    false
  )
on conflict do nothing;

-- ── SYNC-PROTOKOLL ─────────────────────────────────────────
create table if not exists sync_log (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz default now(),
  source              text not null,
  count               int default 0,
  duplicates_skipped  int default 0,
  status              text default 'success',
  message             text,
  lead_ids            uuid[] default '{}',
  lead_names          text[] default '{}'
);

create index if not exists sync_log_created_idx on sync_log(created_at desc);
