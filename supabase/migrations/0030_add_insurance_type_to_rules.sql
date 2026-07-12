-- Migration: Add insurance_product condition to automation rules
-- Purpose: Rules can now filter by insurance type (PKV, Unternehmerschutz, etc.)

ALTER TABLE rules ADD COLUMN IF NOT EXISTS condition_insurance_product TEXT;
-- NULL or empty = matches all insurance types
-- "PKV" = only PKV leads
-- "Unternehmerschutz" = only Unternehmerschutz leads
-- Can be extended for other types

CREATE INDEX IF NOT EXISTS idx_rules_insurance_condition ON rules(condition_insurance_product);

COMMENT ON COLUMN rules.condition_insurance_product IS 'Optional: Filter by insurance_product (PKV, Unternehmerschutz, etc.). NULL/empty = all types.';
