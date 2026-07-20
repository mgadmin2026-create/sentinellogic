-- Placetel-Telefonie: Anrufhistorie und idempotente Webhook-Verarbeitung.
-- Die Tabellen sind absichtlich nur über serverseitige API-Routen erreichbar.

create table if not exists public.call_logs (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts(id) on delete set null,
  initiated_by_user_id uuid references public.users(id) on delete set null,
  placetel_call_id text,
  direction text not null check (direction in ('incoming', 'outgoing')),
  status text not null check (status in (
    'initiated', 'ringing', 'accepted', 'completed',
    'missed', 'blocked', 'voicemail', 'failed'
  )),
  from_number text,
  to_number text,
  remote_number_normalized text,
  sipuid text,
  started_at timestamptz not null default now(),
  accepted_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  result text check (result is null or result in (
    'termin', 'wiedervorlage', 'kein_interesse',
    'nicht_erreicht', 'falsche_nummer', 'sonstiges'
  )),
  notes text,
  result_recorded_by uuid references public.users(id) on delete set null,
  result_recorded_at timestamptz,
  provider_payload jsonb,
  reconciliation_state text not null default 'pending'
    check (reconciliation_state in ('pending', 'matched', 'ambiguous', 'reconciled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists call_logs_placetel_call_id_unique
  on public.call_logs (placetel_call_id)
  where placetel_call_id is not null;
create index if not exists call_logs_contact_created_idx
  on public.call_logs (contact_id, created_at desc);
create index if not exists call_logs_user_created_idx
  on public.call_logs (initiated_by_user_id, created_at desc);
create index if not exists call_logs_remote_number_idx
  on public.call_logs (remote_number_normalized, started_at desc);
create index if not exists call_logs_unassigned_idx
  on public.call_logs (created_at desc)
  where contact_id is null;

create table if not exists public.placetel_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_fingerprint text not null unique,
  event_type text,
  placetel_call_id text,
  redacted_payload jsonb,
  processing_status text not null default 'received'
    check (processing_status in ('received', 'processed', 'ignored', 'failed')),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text
);

create index if not exists placetel_webhook_events_received_idx
  on public.placetel_webhook_events (received_at desc);
create index if not exists placetel_webhook_events_call_idx
  on public.placetel_webhook_events (placetel_call_id)
  where placetel_call_id is not null;

create or replace function public.set_placetel_call_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists call_logs_updated_at on public.call_logs;
create trigger call_logs_updated_at
  before update on public.call_logs
  for each row execute function public.set_placetel_call_updated_at();

alter table public.call_logs enable row level security;
alter table public.placetel_webhook_events enable row level security;

revoke all on public.call_logs from anon, authenticated;
revoke all on public.placetel_webhook_events from anon, authenticated;
grant all on public.call_logs to service_role;
grant all on public.placetel_webhook_events to service_role;

comment on table public.call_logs is
  'Placetel-Anrufmetadaten; keine Audioaufzeichnungen. Zugriff nur über Serverrouten.';
comment on column public.call_logs.provider_payload is
  'Redigierte Provider-Metadaten ohne Token und ohne vollständigen Roh-Callback.';
comment on table public.placetel_webhook_events is
  'Technisches Register zur idempotenten Verarbeitung von Placetel-Callbacks.';
