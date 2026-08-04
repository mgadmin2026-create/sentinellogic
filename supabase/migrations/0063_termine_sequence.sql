-- iTIP-SEQUENCE-Zähler für Termin-Benachrichtigungen (Einladung/Update/Absage
-- per E-Mail an Teilnehmer, siehe src/lib/termin-email.ts). Muss bei jeder
-- Änderung erhöht werden, die per Mail an Teilnehmer geht, damit Kalender-Apps
-- der Empfänger (Outlook, Gmail, Apple Kalender) eine neuere Nachricht korrekt
-- als Update statt als Duplikat/veraltete Nachricht erkennen (RFC 5546).
alter table public.termine
  add column if not exists sequence int not null default 0;

comment on column public.termine.sequence is
  'iTIP SEQUENCE-Zähler für Kalendereinladungen/-updates per E-Mail und CalDAV — wird bei jeder Änderung erhöht, die Teilnehmer betrifft.';
