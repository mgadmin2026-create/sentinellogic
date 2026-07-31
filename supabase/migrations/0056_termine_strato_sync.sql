-- Erweiterung für die STRATO-CalDAV-Synchronisation (beidseitig):
-- external_etag verfolgt den Änderungsstand auf STRATO-Seite (WebDAV ETag),
-- last_synced_at den Zeitpunkt des letzten erfolgreichen Abgleichs dieses
-- Termins. Beides zusammen mit dem bereits vorhandenen external_uid
-- entscheidet beim Pull, ob ein Termin neu, unverändert oder auf
-- STRATO-Seite neuer ist als der lokale Stand.
-- external_href ist die exakte STRATO-Ressourcen-URL (PUT/DELETE-Ziel) —
-- wird beim ersten Push/Pull gespeichert, damit spätere Updates/Löschungen
-- nicht neu konstruiert werden müssen.
alter table public.termine
  add column if not exists external_etag text,
  add column if not exists external_href text,
  add column if not exists last_synced_at timestamptz;

comment on column public.termine.external_etag is
  'WebDAV-ETag des zuletzt synchronisierten STRATO-Stands. Ändert sich der ETag beim Pull, wurde der Termin auf STRATO-Seite bearbeitet.';
comment on column public.termine.external_href is
  'Exakte STRATO-CalDAV-Ressourcen-URL dieses Termins (PUT/DELETE-Ziel).';
comment on column public.termine.last_synced_at is
  'Zeitpunkt des letzten erfolgreichen Abgleichs mit STRATO (Push oder Pull) für diesen Termin.';
