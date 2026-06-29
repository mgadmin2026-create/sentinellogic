-- Add insurance_product field to contacts table
ALTER TABLE contacts ADD COLUMN insurance_product TEXT;

CREATE INDEX idx_contacts_insurance_product ON contacts(insurance_product);
