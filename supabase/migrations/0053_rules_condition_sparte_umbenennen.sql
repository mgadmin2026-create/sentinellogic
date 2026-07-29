-- Automatisierungsregeln: Spalte an die Bezeichnung angleichen, die die
-- Anwendung durchgängig verwendet.
--
-- Hintergrund: Migration 0030 legte die Spalte als `condition_insurance_product`
-- an. Die gesamte Anwendung (Regel-Formular, POST/PATCH, Automations-Engine und
-- Batch-Ausführung) spricht sie jedoch als `condition_sparte` an. Dadurch
--   1. schlug jedes Speichern des Versicherungstyps fehl (Spalte unbekannt) und
--   2. lief die Sparten-Bedingung beim Regelabgleich ins Leere: `condition_sparte`
--      war beim gelesenen Datensatz immer undefiniert, die Prüfung damit immer
--      wahr — eine Regel für „Unternehmerschutz" wurde also auf ALLE Kontakte
--      der Quelle angewandt.
--
-- Umbenennen statt neu anlegen, damit die vorhandenen Werte (PKV,
-- Unternehmerschutz) erhalten bleiben. Der Name `condition_sparte` passt
-- zusätzlich zum Feld `contacts.sparte`, gegen das verglichen wird.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'rules'
      and column_name = 'condition_insurance_product'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'rules'
      and column_name = 'condition_sparte'
  ) then
    alter table public.rules rename column condition_insurance_product to condition_sparte;
  end if;
end $$;

-- Index mit umbenennen, falls er noch unter dem alten Namen existiert.
do $$
begin
  if exists (select 1 from pg_class where relname = 'idx_rules_insurance_condition') then
    alter index idx_rules_insurance_condition rename to idx_rules_condition_sparte;
  end if;
end $$;

create index if not exists idx_rules_condition_sparte
  on public.rules (condition_sparte);

comment on column public.rules.condition_sparte is
  'Optionale Bedingung: nur Kontakte mit dieser Sparte (Vergleich gegen contacts.sparte). NULL = alle Sparten.';
