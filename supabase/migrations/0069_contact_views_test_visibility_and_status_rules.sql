-- Kontaktansichten, benutzerbezogene Testdaten-Sichtbarkeit und
-- statusbasierte Automatisierungsregeln.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS show_test_data BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.users.show_test_data IS
  'Zeigt technisch markierte Testkontakte und deren Aufgaben nur diesem Teammitglied.';

ALTER TABLE public.rules
  ADD COLUMN IF NOT EXISTS condition_status TEXT;

ALTER TABLE public.rules
  DROP CONSTRAINT IF EXISTS rules_condition_status_check;

ALTER TABLE public.rules
  ADD CONSTRAINT rules_condition_status_check CHECK (
    condition_status IS NULL OR condition_status IN (
      'new', 'contacted', 'qualified', 'customer', 'not_interested'
    )
  );

CREATE INDEX IF NOT EXISTS rules_condition_status_idx
  ON public.rules (condition_status)
  WHERE active = TRUE AND condition_status IS NOT NULL;

-- Der Regressionstest-Benutzer muss die von ihm erzeugten Testdaten weiterhin
-- sehen können. Reguläre Teammitglieder behalten den sicheren Standard FALSE.
UPDATE public.users
SET show_test_data = TRUE
WHERE lower(COALESCE(email, '')) = 'test-admin@sentinellogic.de';

-- Fachlich bestätigte Regel. Das Gesprächslabel wird auf alle bereits
-- vorhandenen SuperChat-Gespräche des verknüpften Kontakts gesetzt.
INSERT INTO public.rules (
  name,
  condition_source,
  condition_status,
  actions,
  active,
  runs
)
SELECT
  'Status Kunde → SuperChat Gesprächslabel Kunde AZ',
  'all',
  'customer',
  '{"superchat_label":"Kunde AZ"}'::jsonb,
  TRUE,
  0
WHERE NOT EXISTS (
  SELECT 1
  FROM public.rules
  WHERE condition_status = 'customer'
    AND actions ->> 'superchat_label' = 'Kunde AZ'
);
