-- Eingehende STRATO-E-Mails idempotent als Kontaktaktivität protokollieren.
-- Der Nachrichtentext und die Absenderadresse werden bewusst nicht gespeichert.

create table if not exists public.strato_email_events (
  event_key text primary key check (event_key ~ '^[a-f0-9]{64}$'),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  mailbox_uid bigint not null,
  message_id text,
  received_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_strato_email_events_contact
  on public.strato_email_events (contact_id, received_at desc);

alter table public.strato_email_events enable row level security;

comment on table public.strato_email_events is
  'Technische Idempotenzschlüssel für bereits protokollierte STRATO-E-Mails; ohne Nachrichtentext oder Absenderadresse.';

create or replace function public.log_incoming_strato_emails(p_messages jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message jsonb;
  v_event_key text;
  v_sender_email text;
  v_mailbox_uid bigint;
  v_uid_validity text;
  v_message_id text;
  v_subject text;
  v_received_at timestamptz;
  v_contact_ids uuid[];
  v_contact_id uuid;
  v_inserted integer;
  v_created_count integer := 0;
begin
  if p_messages is null or jsonb_typeof(p_messages) <> 'array' then
    return 0;
  end if;

  for v_message in select value from jsonb_array_elements(p_messages)
  loop
    v_event_key := v_message->>'event_key';
    v_sender_email := v_message->>'sender_email';
    v_mailbox_uid := (v_message->>'mailbox_uid')::bigint;
    v_uid_validity := v_message->>'uid_validity';
    v_message_id := v_message->>'message_id';
    v_subject := v_message->>'subject';
    v_received_at := nullif(v_message->>'received_at', '')::timestamptz;

    continue when v_event_key is null
      or v_event_key !~ '^[a-f0-9]{64}$'
      or nullif(trim(v_sender_email), '') is null;

    select array_agg(id order by id)
      into v_contact_ids
    from public.contacts
    where lower(email) = lower(trim(v_sender_email));

    -- Nur eindeutige Treffer automatisch zuordnen. Bei keinem oder mehreren
    -- Kontakten bleibt die Nachricht unverändert im Postfach und wird später
    -- bei einem erneuten Abgleich erneut geprüft.
    continue when coalesce(array_length(v_contact_ids, 1), 0) <> 1;

    v_contact_id := v_contact_ids[1];

    insert into public.strato_email_events (
      event_key,
      contact_id,
      mailbox_uid,
      message_id,
      received_at
    ) values (
      v_event_key,
      v_contact_id,
      v_mailbox_uid,
      left(nullif(trim(v_message_id), ''), 500),
      v_received_at
    )
    on conflict (event_key) do nothing;

    get diagnostics v_inserted = row_count;
    continue when v_inserted = 0;

    insert into public.activities (
      lead_id,
      type,
      description,
      data,
      created_at
    ) values (
      v_contact_id,
      'email_received',
      'E-Mail empfangen: ' || left(coalesce(nullif(trim(v_subject), ''), '(Kein Betreff)'), 300),
      jsonb_build_object(
        'channel', 'strato_imap',
        'direction', 'incoming',
        'subject', left(coalesce(nullif(trim(v_subject), ''), '(Kein Betreff)'), 300),
        'message_id', left(nullif(trim(v_message_id), ''), 500),
        'mailbox_uid', v_mailbox_uid,
        'uid_validity', v_uid_validity
      ),
      coalesce(v_received_at, now())
    );

    v_created_count := v_created_count + 1;
  end loop;

  return v_created_count;
end;
$$;

revoke all on function public.log_incoming_strato_emails(jsonb) from public;
grant execute on function public.log_incoming_strato_emails(jsonb) to service_role;
