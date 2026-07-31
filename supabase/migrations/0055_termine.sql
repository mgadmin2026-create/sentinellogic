-- Termine: echte Kalendertermine mit Uhrzeit (Start/Ende), getrennt von
-- Aufgaben (die Fälligkeitsdaten, aber keine Uhrzeiten haben). Grundlage für
-- den neu gestalteten Kalender (Tag/Arbeitswoche/Woche/Monat/Jahr, analog zum
-- STRATO-Webmail-Kalender des Kunden) sowie für die geplante spätere
-- CalDAV-Synchronisation mit STRATO — external_uid/external_source sind
-- dafür bereits vorgesehen, aber noch ungenutzt (keine Sync-Logik in dieser
-- Migration).
create table if not exists public.termine (
  id uuid primary key default gen_random_uuid(),
  titel text not null,
  beschreibung text,
  start_zeit timestamptz not null,
  end_zeit timestamptz not null,
  ganztaegig boolean not null default false,
  ort text,
  contact_id uuid references public.contacts(id) on delete set null,
  assigned_user_id uuid references public.users(id),
  created_by_user_id uuid references public.users(id),
  -- Quelle für die "Meine Kalender"-Sidebar (togglebare Kalender wie bei
  -- STRATO). 'crm' = manuell im CRM angelegt; künftige Sync-Termine würden
  -- hier z.B. 'strato' tragen.
  kalender_quelle text not null default 'crm',
  farbe text,
  external_uid text,
  external_source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_termine_start_zeit on public.termine (start_zeit);
create index if not exists idx_termine_contact_id on public.termine (contact_id) where contact_id is not null;
create index if not exists idx_termine_assigned_user on public.termine (assigned_user_id) where assigned_user_id is not null;

-- Verhindert Duplikate bei künftiger Synchronisation (ein externer Termin
-- kommt pro Quelle+UID nur einmal ins CRM).
create unique index if not exists idx_termine_external_unique
  on public.termine (external_source, external_uid)
  where external_uid is not null;

comment on table public.termine is
  'Echte Kalendertermine mit Start-/Endzeit (Uhrzeit), getrennt von Aufgaben-Fälligkeiten. Kalender-UI unter /kalender.';
comment on column public.termine.kalender_quelle is
  'Togglebare Kalenderquelle in der Sidebar, z.B. crm (manuell) oder künftig strato (CalDAV-Sync).';
comment on column public.termine.external_uid is
  'iCal-UID für künftige CalDAV-Synchronisation — verhindert doppeltes Importieren. Noch ungenutzt.';
