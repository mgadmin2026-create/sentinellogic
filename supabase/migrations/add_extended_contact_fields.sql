-- Add extended fields to contacts table for better CRM functionality
-- These fields expand the contact model for more detailed sales/company information

ALTER TABLE contacts ADD COLUMN qualität TEXT;
ALTER TABLE contacts ADD COLUMN bestandskunde BOOLEAN DEFAULT false;
ALTER TABLE contacts ADD COLUMN jahresumsatz TEXT;
ALTER TABLE contacts ADD COLUMN mitarbeitanzahl INTEGER;
ALTER TABLE contacts ADD COLUMN versicherungstyp TEXT;

-- Create indexes for frequently queried fields
CREATE INDEX idx_contacts_qualität ON contacts(qualität);
CREATE INDEX idx_contacts_bestandskunde ON contacts(bestandskunde);
CREATE INDEX idx_contacts_versicherungstyp ON contacts(versicherungstyp);
