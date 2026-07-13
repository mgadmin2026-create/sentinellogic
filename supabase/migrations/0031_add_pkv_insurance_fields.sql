-- Migration: Add PKV Insurance Fields for Dialfire Campaign 6X42NJWGH4YA6HC7
-- Purpose: Support full field sync for PKV campaign with multiple insurance records

-- Personal Information Fields
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS geburtstag DATE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS jahreseinkommen DECIMAL(12,2);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS groesse INT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS gewicht INT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS gesundheitszustand TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS seit_wann_selbststaendig DATE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS dienstverhaltnis TEXT;

-- Insurance Fields (Support for 5 Insurance Records)
-- Insurance 1
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS versicherungsgesellschaft_1 VARCHAR;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS leistungen_1 TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS aktueller_beitrag_1 DECIMAL(10,2);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS kontoinhaber_1 VARCHAR;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS iban_1 VARCHAR;

-- Insurance 2
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS versicherungsgesellschaft_2 VARCHAR;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS leistungen_2 TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS aktueller_beitrag_2 DECIMAL(10,2);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS kontoinhaber_2 VARCHAR;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS iban_2 VARCHAR;

-- Insurance 3
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS versicherungsgesellschaft_3 VARCHAR;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS leistungen_3 TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS aktueller_beitrag_3 DECIMAL(10,2);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS kontoinhaber_3 VARCHAR;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS iban_3 VARCHAR;

-- Insurance 4
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS versicherungsgesellschaft_4 VARCHAR;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS leistungen_4 TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS aktueller_beitrag_4 DECIMAL(10,2);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS kontoinhaber_4 VARCHAR;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS iban_4 VARCHAR;

-- Insurance 5
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS versicherungsgesellschaft_5 VARCHAR;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS leistungen_5 TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS aktueller_beitrag_5 DECIMAL(10,2);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS kontoinhaber_5 VARCHAR;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS iban_5 VARCHAR;

-- Additional Notes Field
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS notizen_2 TEXT;

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_contacts_geburtstag ON contacts(geburtstag);
CREATE INDEX IF NOT EXISTS idx_contacts_versicherungsgesellschaft ON contacts(versicherungsgesellschaft_1);
CREATE INDEX IF NOT EXISTS idx_contacts_iban ON contacts(iban);
