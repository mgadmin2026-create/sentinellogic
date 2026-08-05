-- Additiver KlickTipp-Rückkanal: Zustell-/Einwilligungsstatus am Kontakt und
-- idempotente, datensparsame Ereignisablage. Der bestehende Outbound-Sync
-- bleibt davon vollständig unabhängig.

alter table public.contacts
  add column if not exists klicktipp_email_status text,
  add column if not exists klicktipp_status_updated_at timestamptz,
  add column if not exists klicktipp_status_checked_at timestamptz,
  add column if not exists klicktipp_last_event_at timestamptz;

alter table public.activities
  add column if not exists external_event_key text;

create unique index if not exists activities_external_event_key_unique
  on public.activities (external_event_key)
  where external_event_key is not null;

alter table public.contacts
  drop constraint if exists contacts_klicktipp_email_status_check;

alter table public.contacts
  add constraint contacts_klicktipp_email_status_check check (
    klicktipp_email_status is null or klicktipp_email_status in (
      'subscribed', 'opt_in_pending', 'unsubscribed', 'soft_bounce', 'hard_bounce', 'unknown'
    )
  );

create index if not exists contacts_klicktipp_status_check_idx
  on public.contacts (klicktipp_status_checked_at asc nulls first)
  where klicktipp_id is not null and archived_at is null;

create table if not exists public.klicktipp_webhook_events (
  event_fingerprint text primary key check (event_fingerprint ~ '^[a-f0-9]{64}$'),
  contact_id uuid references public.contacts(id) on delete set null,
  klicktipp_id text,
  event_type text not null,
  occurred_at timestamptz not null,
  email_status text,
  campaign_name text,
  message_name text,
  tag_name text,
  link_label text,
  redacted_payload jsonb not null default '{}'::jsonb,
  processing_status text not null default 'received'
    check (processing_status in ('received', 'processed', 'unmatched', 'ignored', 'failed')),
  processing_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists klicktipp_events_contact_idx
  on public.klicktipp_webhook_events (contact_id, occurred_at desc);

create index if not exists klicktipp_events_status_idx
  on public.klicktipp_webhook_events (processing_status, received_at desc);

alter table public.klicktipp_webhook_events enable row level security;
revoke all on public.klicktipp_webhook_events from anon, authenticated;
grant all on public.klicktipp_webhook_events to service_role;

comment on table public.klicktipp_webhook_events is
  'Idempotente KlickTipp-Ereignisse ohne vollständige Payload oder E-Mail-Adresse.';
comment on column public.contacts.klicktipp_email_status is
  'Normalisierter KlickTipp-E-Mail-Status; bis zur Ablösung bleibt KlickTipp hierfür führend.';
comment on column public.activities.external_event_key is
  'Optionale eindeutige ID externer Ereignisse zum Schutz vor doppelten Timeline-Einträgen.';
