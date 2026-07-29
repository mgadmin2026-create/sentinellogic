-- SuperChat-Kontaktsynchronisation: Provider-ID und letzter Übertragungsstand.
-- Die eigentlichen Kontaktdaten bleiben in public.contacts; es werden keine
-- Provider-Antworten oder API-Schlüssel in der Datenbank gespeichert.

alter table public.contacts
  add column if not exists superchat_id text,
  add column if not exists superchat_last_sync timestamptz,
  add column if not exists superchat_sync_error text;

create unique index if not exists contacts_superchat_id_unique
  on public.contacts (superchat_id)
  where superchat_id is not null;

comment on column public.contacts.superchat_id is
  'Technische ID des zugeordneten Kontakts im SuperChat-Workspace.';
comment on column public.contacts.superchat_last_sync is
  'Zeitpunkt der letzten erfolgreichen Übertragung zu SuperChat.';
comment on column public.contacts.superchat_sync_error is
  'Letzte nutzerlesbare Fehlermeldung der SuperChat-Übertragung, ohne Kontaktdaten.';
