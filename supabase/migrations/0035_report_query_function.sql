-- Migration: Abgesicherte Reporting-Funktion für flexibles Text-zu-SQL Reporting
--
-- Führt eine EINZELNE, ausschließlich lesende SELECT/WITH-Abfrage aus und liefert
-- das Ergebnis als JSON (max. 1000 Zeilen). Mehrschichtige Absicherung:
--   - nur SELECT/WITH, genau eine Anweisung
--   - Blacklist schreibender/gefährlicher Keywords
--   - Blacklist von Geheim-/Token-Tabellen + Katalog/Schema
--   - read-only Transaktion + statement_timeout
--
-- Aufruf aus der App: supabase.rpc('execute_report_query', { query: '<SELECT ...>' })

CREATE OR REPLACE FUNCTION public.execute_report_query(query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lower_q text;
  result  jsonb;
BEGIN
  IF query IS NULL OR btrim(query) = '' THEN
    RAISE EXCEPTION 'Leere Abfrage';
  END IF;

  lower_q := lower(query);

  -- Muss mit SELECT oder WITH beginnen
  IF lower_q !~ '^\s*(select|with)\s' THEN
    RAISE EXCEPTION 'Nur lesende SELECT-Abfragen erlaubt';
  END IF;

  -- Genau eine Anweisung: nach Entfernen eines optionalen End-Semikolons darf kein ';' mehr vorkommen
  IF regexp_replace(btrim(query), ';\s*$', '') LIKE '%;%' THEN
    RAISE EXCEPTION 'Nur eine einzelne Abfrage erlaubt';
  END IF;

  -- Schreibende / gefährliche Schlüsselwörter (als ganze Wörter)
  IF lower_q ~ '\y(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|merge|vacuum|reindex|refresh|comment|lock|call|execute|prepare|do|listen|notify|savepoint|begin|commit|rollback|set)\y' THEN
    RAISE EXCEPTION 'Nicht erlaubtes Schlüsselwort in der Abfrage';
  END IF;

  -- Geheim-/Token-Tabellen und interne Kataloge
  IF lower_q ~ '(google_oauth_tokens|google_drive_system_token|system_config|facebook_sync_config|token|secret|oauth|pg_catalog|pg_|information_schema)' THEN
    RAISE EXCEPTION 'Zugriff auf geschützte Objekte abgelehnt';
  END IF;

  -- Read-only + Timeout als zusätzliche Absicherung
  SET LOCAL transaction_read_only = on;
  SET LOCAL statement_timeout = '5000ms';

  EXECUTE format(
    'SELECT coalesce(jsonb_agg(row_to_json(sub)), ''[]''::jsonb) '
    'FROM (SELECT * FROM (%s) q LIMIT 1000) sub',
    query
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.execute_report_query(text) FROM public;
GRANT EXECUTE ON FUNCTION public.execute_report_query(text) TO service_role;
