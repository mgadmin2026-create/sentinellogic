-- Migrate insurance_product to sparte field
-- This consolidates the old insurance_product column into the sparte column

-- First, migrate any existing data from insurance_product to sparte (if not already filled)
UPDATE contacts
SET sparte = insurance_product
WHERE sparte IS NULL AND insurance_product IS NOT NULL;

-- Drop the old index
DROP INDEX IF EXISTS idx_contacts_insurance_product;

-- Drop the old column
ALTER TABLE contacts DROP COLUMN IF EXISTS insurance_product;

-- Ensure sparte has an index for performance
CREATE INDEX IF NOT EXISTS idx_contacts_sparte ON contacts(sparte);
