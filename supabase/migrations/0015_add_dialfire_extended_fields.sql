-- Migration: Add extended Dialfire fields to contacts table
-- Purpose: Support full field sync from Dialfire

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS anrede VARCHAR;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS rechtsform VARCHAR;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS geburtstag_gf_inhaber DATE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS geschaeftsfuehrer_anzahl INT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS seit_wann_gewerbe DATE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS versicherungsgesellschaft VARCHAR;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS zahlweise VARCHAR;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS beitrag_vorsorge DECIMAL(10,2);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS kontoinhaber VARCHAR;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS iban VARCHAR;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS bemerkung TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS sparte VARCHAR;

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_contacts_anrede ON contacts(anrede);
CREATE INDEX IF NOT EXISTS idx_contacts_rechtsform ON contacts(rechtsform);
