-- Migration: Add new Facebook campaign fields
-- New fields from updated Facebook Lead Ads form

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS situation TEXT;
-- Stores: "Welche Situation passt aktuell am besten zu dir?"
-- Example: "Angestellter", "Selbstständiger", "Unternehmer", etc.

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS krankenversicherung_status TEXT;
-- Stores: "Wie bist du aktuell krankenversichert?"
-- Example: "GKV", "PKV", "Keine", etc.

-- Note: "Was möchtest du prüfen lassen?" already mapped to "insurance_product"

CREATE INDEX IF NOT EXISTS idx_contacts_situation ON contacts(situation);
CREATE INDEX IF NOT EXISTS idx_contacts_krankenversicherung ON contacts(krankenversicherung_status);
