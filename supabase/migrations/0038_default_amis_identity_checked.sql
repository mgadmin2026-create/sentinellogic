-- AMIS.NOW: identity document confirmation should be checked by default.
ALTER TABLE contacts
  ALTER COLUMN amis_identity_document_checked SET DEFAULT true;

UPDATE contacts
SET amis_identity_document_checked = true
WHERE amis_identity_document_checked IS DISTINCT FROM true;
