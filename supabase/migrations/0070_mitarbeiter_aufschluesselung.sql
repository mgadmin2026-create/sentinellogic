-- Aufschlüsselung der Mitarbeiterzahl (Erstgespräch-Leitfaden Unternehmerschutz):
-- zusätzlich zur bestehenden Gesamtzahl (contacts.mitarbeitanzahl) drei neue
-- Felder für Vollzeit/Teilzeit/Minijob. Rein additiv, kein Backfill nötig —
-- NULL heißt schlicht "noch nicht erfragt".
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS mitarbeiter_vollzeit integer,
  ADD COLUMN IF NOT EXISTS mitarbeiter_teilzeit integer,
  ADD COLUMN IF NOT EXISTS mitarbeiter_minijob integer;

-- Erstgespräch-Leitfaden "Unternehmerschutz": Frage "mitarbeiter" um die drei
-- neuen Unterfelder erweitern (leitfaden_fragen ist ein JSONB-Array, generisch
-- gerendert von ErstgespraechPanel.tsx — keine Code-Änderung dafür nötig).
UPDATE public.sparten
SET leitfaden_fragen = (
  SELECT jsonb_agg(
    CASE
      WHEN frage->>'id' = 'mitarbeiter' THEN
        jsonb_set(
          frage,
          '{felder}',
          frage->'felder' || jsonb_build_array(
            jsonb_build_object('feld', 'mitarbeiter_vollzeit', 'label', 'davon Vollzeit', 'typ', 'number'),
            jsonb_build_object('feld', 'mitarbeiter_teilzeit', 'label', 'davon Teilzeit', 'typ', 'number'),
            jsonb_build_object('feld', 'mitarbeiter_minijob', 'label', 'davon Minijobler', 'typ', 'number')
          )
        )
      ELSE frage
    END
  )
  FROM jsonb_array_elements(leitfaden_fragen) AS frage
)
WHERE name = 'Unternehmerschutz'
  AND leitfaden_fragen @> '[{"id":"mitarbeiter"}]';
