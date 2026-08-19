-- Providerneutrale Kommunikationszentrale. Gespräche und Nachrichten bleiben
-- Eigentum von Sentimental Logic; SuperChat, Meta oder E-Mail sind nur Transportwege.

create table if not exists public.communication_conversations (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts(id) on delete set null,
  provider text not null,
  provider_conversation_id text not null,
  channel text not null check (channel in ('whatsapp', 'email', 'webchat', 'sms')),
  status text not null default 'open' check (status in ('open', 'snoozed', 'done')),
  assigned_user_id uuid references public.users(id) on delete set null,
  unread_count integer not null default 0 check (unread_count >= 0),
  last_message_preview text,
  last_message_at timestamptz,
  snoozed_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_conversation_id)
);

create table if not exists public.communication_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.communication_conversations(id) on delete cascade,
  provider_message_id text,
  direction text not null check (direction in ('inbound', 'outbound', 'internal')),
  message_type text not null default 'text' check (message_type in ('text', 'image', 'document', 'audio', 'template', 'note', 'system')),
  text_content text,
  sender_name text,
  sent_at timestamptz not null default now(),
  delivery_status text not null default 'received' check (delivery_status in ('pending', 'sent', 'delivered', 'read', 'failed', 'received')),
  attachment_metadata jsonb not null default '[]'::jsonb,
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_communication_messages_provider_id
  on public.communication_messages (conversation_id, provider_message_id)
  where provider_message_id is not null;
create index if not exists idx_communication_conversations_last_message
  on public.communication_conversations (last_message_at desc nulls last);
create index if not exists idx_communication_conversations_status
  on public.communication_conversations (status, last_message_at desc nulls last);
create index if not exists idx_communication_conversations_assigned
  on public.communication_conversations (assigned_user_id, status);
create index if not exists idx_communication_conversations_contact
  on public.communication_conversations (contact_id);
create index if not exists idx_communication_messages_conversation
  on public.communication_messages (conversation_id, sent_at);

create or replace function public.set_communication_conversation_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists communication_conversations_updated_at on public.communication_conversations;
create trigger communication_conversations_updated_at
  before update on public.communication_conversations
  for each row execute function public.set_communication_conversation_updated_at();

comment on table public.communication_conversations is
  'Providerneutrale Gesprächsliste der zentralen Inbox. Transportanbieter können ohne UI-Umbau gewechselt werden.';
comment on table public.communication_messages is
  'Chronologische Nachrichten und interne Notizen je Gespräch. Kundendaten werden nicht in technische Logs geschrieben.';

