-- Teilnehmer-Einladungen für Termine (analog zu STRATOs "Teilnehmer und
-- Ressourcen"-Feld im Termin-Dialog). Bisher gab es dafür keine Spalte —
-- ein Termin konnte im CRM nur mit Titel/Zeit/Ort/Beschreibung angelegt
-- werden, ohne dass jemand eingeladen werden konnte.
--
-- JSONB statt eigener Tabelle: Teilnehmer sind Ad-hoc-E-Mail-Adressen (kein
-- eigenständiger, wiederverwendbarer Entity-Typ), analog zu anderen
-- flexiblen Listen in diesem Projekt (z.B. payment_steps, leitfaden_fragen).
alter table public.termine
  add column if not exists teilnehmer jsonb not null default '[]'::jsonb;

comment on column public.termine.teilnehmer is
  'Eingeladene Teilnehmer als JSON-Array [{email, name?}]. Wird beim Push als ATTENDEE-Zeilen ins iCal geschrieben (siehe src/lib/strato-caldav.ts) und beim Pull aus ATTENDEE-Zeilen befüllt.';
