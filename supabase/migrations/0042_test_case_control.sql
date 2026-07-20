-- Persistente Steuerung, welche automatisierten Testfälle im nächsten Lauf ausgeführt werden.
-- Die Einstellung liegt im bereits geschützten Singleton des Live-Testbetriebs.

ALTER TABLE public.test_data_guard
  ADD COLUMN IF NOT EXISTS disabled_test_cases TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

COMMENT ON COLUMN public.test_data_guard.disabled_test_cases IS
  'Testfall-IDs, die durch einen berechtigten Benutzer für kommende Playwright-Läufe deaktiviert wurden.';
