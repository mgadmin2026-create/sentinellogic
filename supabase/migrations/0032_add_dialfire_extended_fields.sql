-- Migration: Add Extended Dialfire Fields for PKV Campaign
-- Purpose: Support additional fields for Dialfire PKV integration

-- Add Hausnummer (House Number)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS hausnummer VARCHAR;

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_contacts_hausnummer ON contacts(hausnummer);
