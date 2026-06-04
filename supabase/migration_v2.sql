-- ============================================================
-- Migration v2 — Adressfelder + fehlende Spalten
-- Im Supabase SQL-Editor ausführen
-- ============================================================

alter table leads
  add column if not exists street       text,       -- Straße + Hausnummer
  add column if not exists postal_code  text,       -- PLZ
  add column if not exists city         text,       -- Ort
  add column if not exists country      text default 'Deutschland';
