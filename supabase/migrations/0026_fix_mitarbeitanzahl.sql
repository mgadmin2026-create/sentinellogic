-- Migration: Fix mitarbeitanzahl from INTEGER to TEXT
-- Reason: Facebook sends ranges like "1_bis_5", "6_bis_20", etc., not integers
-- This caused "invalid input syntax for type integer" errors during sync

-- Step 1: Create temporary new column as TEXT
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS mitarbeitanzahl_text TEXT;

-- Step 2: Migrate existing data (if any)
UPDATE contacts
SET mitarbeitanzahl_text = CAST(mitarbeitanzahl AS TEXT)
WHERE mitarbeitanzahl IS NOT NULL;

-- Step 3: Drop old INTEGER column
ALTER TABLE contacts DROP COLUMN IF EXISTS mitarbeitanzahl;

-- Step 4: Rename new column to original name
ALTER TABLE contacts RENAME COLUMN mitarbeitanzahl_text TO mitarbeitanzahl;

-- Step 5: Add comment
COMMENT ON COLUMN contacts.mitarbeitanzahl IS 'Employee count range from Facebook (e.g., "1_bis_5", "6_bis_20", "21_bis_50", etc.)';
