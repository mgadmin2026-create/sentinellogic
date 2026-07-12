-- Migration: Add prüfung_grund field
-- Purpose: Store what the contact wants to check/optimize (separate from insurance_product)

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS prüfung_grund TEXT;
-- Stores: "was_möchtest_du_prüfen_lassen?"
-- Example: "ob_mein_beitrag_optimiert_werden_kann", etc.

CREATE INDEX IF NOT EXISTS idx_contacts_pruefung_grund ON contacts(prüfung_grund);

COMMENT ON COLUMN contacts.prüfung_grund IS 'What the contact wants to check/verify (from: was_möchtest_du_prüfen_lassen?)';
