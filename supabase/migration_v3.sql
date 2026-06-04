-- ============================================================
-- Migration v3 — Regeln + Sync-Protokoll Tabellen
-- Im Supabase SQL-Editor ausführen
-- ============================================================

-- ── REGELN ─────────────────────────────────────────────────
create table if not exists rules (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz default now(),
  name             text not null,
  condition_source text not null default 'all', -- 'all' | lead_source enum
  actions          jsonb not null default '{}', -- {klicktipp_tag, dialfire_campaign, set_status, send_notification}
  active           boolean default true,
  runs             int default 0
);

-- 3 Standard-Regeln einfügen
insert into rules (name, condition_source, actions, active) values
  ('Facebook → Klicktipp + Dialfire', 'facebook',
   '{"klicktipp_tag":"fb-lead","dialfire_campaign":"BHV-Gewerbe","send_notification":true}',
   true),
  ('Calendly → Qualifiziert setzen', 'calendly',
   '{"klicktipp_tag":"termin-vereinbart","set_status":"qualified","send_notification":true}',
   true),
  ('CSV → Kalt-Akquise Kampagne', 'csv',
   '{"klicktipp_tag":"csv-import","dialfire_campaign":"Kalt-Akquise"}',
   false)
on conflict do nothing;

-- ── SYNC-PROTOKOLL ─────────────────────────────────────────
create table if not exists sync_log (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz default now(),
  source              text not null,
  count               int default 0,
  duplicates_skipped  int default 0,
  status              text default 'success', -- success | warning | error
  message             text,
  lead_ids            uuid[] default '{}',
  lead_names          text[] default '{}'     -- z.B. {"Thomas Müller","Sabine Hoffmann"}
);

create index if not exists sync_log_created_idx on sync_log(created_at desc);
