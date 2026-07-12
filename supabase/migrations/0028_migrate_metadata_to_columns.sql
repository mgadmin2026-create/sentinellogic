-- Migration: Migrate Facebook field data from metadata JSON to dedicated columns
-- Purpose: Extract old data stored in metadata and populate new columns

-- Migrate mitarbeitanzahl (from metadata.wie_viele_mitarbeitende_habt_ihr?__)
UPDATE contacts
SET mitarbeitanzahl = metadata->>'wie_viele_mitarbeitende_habt_ihr?__'
WHERE mitarbeitanzahl IS NULL
  AND metadata ? 'wie_viele_mitarbeitende_habt_ihr?__';

-- Migrate situation (from metadata.welche_situation_passt_aktuell_am_besten_zu_dir?)
UPDATE contacts
SET situation = metadata->>'welche_situation_passt_aktuell_am_besten_zu_dir?'
WHERE situation IS NULL
  AND metadata ? 'welche_situation_passt_aktuell_am_besten_zu_dir?';

-- Migrate krankenversicherung_status (from metadata.wie_bist_du_aktuell_krankenversichert?)
UPDATE contacts
SET krankenversicherung_status = metadata->>'wie_bist_du_aktuell_krankenversichert?'
WHERE krankenversicherung_status IS NULL
  AND metadata ? 'wie_bist_du_aktuell_krankenversichert?';

-- Migrate industry (from metadata.in_welcher_branche_seid_ihr_tätig?)
UPDATE contacts
SET industry = metadata->>'in_welcher_branche_seid_ihr_tätig?'
WHERE industry IS NULL
  AND metadata ? 'in_welcher_branche_seid_ihr_tätig?';

-- Migrate insurance_product (from multiple possible metadata keys)
UPDATE contacts
SET insurance_product = COALESCE(
  metadata->>'welche_absicherung_möchtest_du_prüfen_lassen?',
  metadata->>'was_möchtest_du_prüfen_lassen?'
)
WHERE insurance_product IS NULL
  AND (metadata ? 'welche_absicherung_möchtest_du_prüfen_lassen?'
    OR metadata ? 'was_möchtest_du_prüfen_lassen?');

-- Migrate jahresumsatz (from metadata.wie_hoch_ist_euer_jahresumsatz?)
UPDATE contacts
SET jahresumsatz = metadata->>'wie_hoch_ist_euer_jahresumsatz?'
WHERE jahresumsatz IS NULL
  AND metadata ? 'wie_hoch_ist_euer_jahresumsatz?';

-- Log migration results
DO $$
DECLARE
  mitarbeit_count INT;
  situation_count INT;
  kranken_count INT;
BEGIN
  SELECT COUNT(*) INTO mitarbeit_count FROM contacts WHERE mitarbeitanzahl IS NOT NULL;
  SELECT COUNT(*) INTO situation_count FROM contacts WHERE situation IS NOT NULL;
  SELECT COUNT(*) INTO kranken_count FROM contacts WHERE krankenversicherung_status IS NOT NULL;

  RAISE NOTICE 'Migration complete: mitarbeitanzahl=%, situation=%, krankenversicherung=%',
    mitarbeit_count, situation_count, kranken_count;
END $$;
