-- Live-sichere Playwright-Testdaten: sichtbare Marker und selektive Bereinigung.
-- Diese Migration enthält bewusst kein TRUNCATE und keine generische Tabellenlöschung.

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS is_test_data BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS test_run_id TEXT;

ALTER TABLE public.contacts
  DROP CONSTRAINT IF EXISTS contacts_test_data_marker_check;

ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_test_data_marker_check CHECK (
    (is_test_data = FALSE AND test_run_id IS NULL)
    OR
    (
      is_test_data = TRUE
      AND test_run_id ~ '^[a-zA-Z0-9._:-]{1,80}$'
      AND first_name = '[TEST]'
      AND company_name LIKE '[TESTDATEN]%'
      AND lower(email) = 'pw+' || lower(test_run_id) || '@example.invalid'
    )
  );

CREATE INDEX IF NOT EXISTS contacts_test_data_idx
  ON public.contacts(test_run_id, created_at DESC)
  WHERE is_test_data = TRUE;

-- Auch direkte Datenbank-Imports werden anhand der vollständigen sichtbaren
-- Konvention markiert. Teilmarkierte Datensätze werden absichtlich nicht markiert.
CREATE OR REPLACE FUNCTION public.mark_recognizable_test_contact()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  detected_run_id TEXT;
BEGIN
  IF NEW.first_name = '[TEST]'
    AND NEW.company_name LIKE '[TESTDATEN]%'
    AND lower(COALESCE(NEW.email, '')) ~ '^pw\+[a-z0-9._:-]{1,80}@example\.invalid$'
  THEN
    detected_run_id := split_part(split_part(lower(NEW.email), '@', 1), '+', 2);
    NEW.is_test_data := TRUE;
    NEW.test_run_id := detected_run_id;
  ELSIF NEW.is_test_data = TRUE OR NEW.test_run_id IS NOT NULL THEN
    RAISE EXCEPTION 'TEST_DATA_VISIBLE_MARKERS_REQUIRED';
  ELSE
    NEW.is_test_data := FALSE;
    NEW.test_run_id := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contacts_mark_test_data ON public.contacts;
CREATE TRIGGER contacts_mark_test_data
  BEFORE INSERT OR UPDATE OF first_name, company_name, email, is_test_data, test_run_id
  ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_recognizable_test_contact();

CREATE TABLE IF NOT EXISTS public.test_data_guard (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  guard_id UUID NOT NULL DEFAULT gen_random_uuid(),
  cleanup_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  last_cleanup_at TIMESTAMPTZ,
  last_run_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.test_data_guard (singleton)
VALUES (TRUE)
ON CONFLICT (singleton) DO NOTHING;

ALTER TABLE public.test_data_guard ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.test_data_guard FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_test_data_cleanup_status(
  p_expected_guard_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  guard_record public.test_data_guard%ROWTYPE;
BEGIN
  SELECT * INTO guard_record
  FROM public.test_data_guard
  WHERE singleton = TRUE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ready', FALSE, 'reset_allowed', FALSE);
  END IF;

  RETURN jsonb_build_object(
    'ready', guard_record.guard_id = p_expected_guard_id AND guard_record.cleanup_allowed = TRUE,
    'reset_allowed', guard_record.cleanup_allowed,
    'last_reset_at', guard_record.last_cleanup_at,
    'last_run_id', guard_record.last_run_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.prepare_test_run(
  p_expected_guard_id UUID,
  p_run_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  guard_record public.test_data_guard%ROWTYPE;
  deleted_contacts INTEGER := 0;
  deleted_activities INTEGER := 0;
  deleted_leads INTEGER := 0;
BEGIN
  IF p_run_id IS NULL OR p_run_id !~ '^[a-zA-Z0-9._:-]{1,80}$' THEN
    RAISE EXCEPTION 'TEST_DATA_INVALID_RUN_ID';
  END IF;

  IF NOT pg_try_advisory_xact_lock(hashtext('sentimental_logic_test_cleanup')) THEN
    RAISE EXCEPTION 'TEST_DATA_CLEANUP_ALREADY_RUNNING';
  END IF;

  SELECT * INTO guard_record
  FROM public.test_data_guard
  WHERE singleton = TRUE
  FOR UPDATE;

  IF NOT FOUND
    OR guard_record.guard_id <> p_expected_guard_id
    OR guard_record.cleanup_allowed IS NOT TRUE
  THEN
    RAISE EXCEPTION 'TEST_DATA_GUARD_REJECTED';
  END IF;

  -- Activities besitzen historisch keinen Foreign Key. Darum werden Einträge
  -- der markierten Kontakte vor dem Kontakt-Cascade explizit entfernt.
  DELETE FROM public.activities
  WHERE lead_id IN (
    SELECT id FROM public.contacts WHERE is_test_data = TRUE
  );
  GET DIAGNOSTICS deleted_activities = ROW_COUNT;

  -- Abhängige Aufgaben, Opportunities, Verträge, Notizen und Audit-Einträge
  -- werden über ihre bestehenden ON DELETE CASCADE Beziehungen entfernt.
  DELETE FROM public.contacts
  WHERE is_test_data = TRUE
    AND test_run_id IS NOT NULL;
  GET DIAGNOSTICS deleted_contacts = ROW_COUNT;

  -- Legacy-Leads werden nur bereinigt, falls die Tabelle und ihre Marker existieren.
  IF to_regclass('public.leads') IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'is_test_data'
    )
  THEN
    EXECUTE 'DELETE FROM public.leads WHERE is_test_data = TRUE AND test_run_id IS NOT NULL';
    GET DIAGNOSTICS deleted_leads = ROW_COUNT;
  END IF;

  UPDATE public.test_data_guard
  SET last_cleanup_at = NOW(),
      last_run_id = p_run_id,
      updated_at = NOW()
  WHERE singleton = TRUE;

  RETURN jsonb_build_object(
    'runId', p_run_id,
    'preparedAt', NOW(),
    'deletedContacts', deleted_contacts,
    'deletedActivities', deleted_activities,
    'deletedLegacyLeads', deleted_leads,
    'stateRetention', 'until_next_run'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_test_data_cleanup_status(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prepare_test_run(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_test_data_cleanup_status(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.prepare_test_run(UUID, TEXT) TO service_role;

COMMENT ON COLUMN public.contacts.is_test_data IS
  'Technischer Marker für eindeutig sichtbare, automatisch bereinigbare Testdaten.';
COMMENT ON FUNCTION public.prepare_test_run(UUID, TEXT) IS
  'Löscht ausschließlich Kontakte mit vollständigem Testmarker; niemals reguläre Live-Daten.';
