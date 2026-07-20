-- Verantwortlicher (Team-Zuweisung) für Kontakte & Aufgaben + Aktivitäten-Attribution.
-- Jetzt, wo echte User-Accounts existieren, kann der Verantwortlicher auf
-- Kontakten/Aufgaben und die Attribution von Aktivitäten korrekt an
-- public.users gebunden werden.

-- activities: Attribution nachrüsten (aktuell komplett ohne Actor)
alter table public.activities add column if not exists user_id uuid references public.users(id) on delete set null;

-- tasks.assigned_user_id: FK zu public.users sicherstellen (eine spätere
-- Migration (v9_activities_tasks) hat die Tabelle ohne FK neu angelegt)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tasks_assigned_user_id_fkey'
  ) then
    alter table public.tasks
      add constraint tasks_assigned_user_id_fkey
      foreign key (assigned_user_id) references public.users(id) on delete set null;
  end if;
end $$;
