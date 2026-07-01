-- Consolidate mitarbeiterzahl (TEXT) and mitarbeitanzahl (INTEGER) into single column
-- PURPOSE: Remove duplicate field schema, migrate Facebook data into Dialfire column

-- Step 1: Copy and convert existing mitarbeiterzahl (TEXT) data to mitarbeitanzahl (INTEGER)
-- Only convert if mitarbeitanzahl is NULL and mitarbeiterzahl has a value
UPDATE contacts
SET mitarbeitanzahl = CAST(mitarbeiterzahl AS INTEGER)
WHERE mitarbeitanzahl IS NULL
  AND mitarbeiterzahl IS NOT NULL
  AND mitarbeiterzahl ~ '^\d+$';  -- Only convert if it's a valid integer string

-- Step 2: Drop the old mitarbeiterzahl column (Facebook field is now consolidated)
ALTER TABLE contacts DROP COLUMN IF EXISTS mitarbeiterzahl;

-- Step 3: Ensure mitarbeitanzahl has an index for query performance
CREATE INDEX IF NOT EXISTS idx_contacts_mitarbeitanzahl ON contacts(mitarbeitanzahl);

-- Step 4: Add a comment to document the consolidation
COMMENT ON COLUMN contacts.mitarbeitanzahl IS 'Employee count (Mitarbeiterzahl) - consolidated from both Facebook and Dialfire sources';
