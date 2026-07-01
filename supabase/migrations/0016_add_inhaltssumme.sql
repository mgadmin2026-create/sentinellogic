-- Migration: Add Inhaltssumme field to contacts table
-- Purpose: Store Dialfire Inhaltssumme data

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS inhaltssumme VARCHAR;

-- Add index for common queries
CREATE INDEX IF NOT EXISTS idx_contacts_inhaltssumme ON contacts(inhaltssumme);
