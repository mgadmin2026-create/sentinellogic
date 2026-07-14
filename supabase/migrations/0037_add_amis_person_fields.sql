-- AMIS.NOW person creation fields stored on contacts.
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS amis_identity_document_checked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS amis_usage TEXT DEFAULT 'privat';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'contacts_amis_usage_check'
  ) THEN
    ALTER TABLE contacts
      ADD CONSTRAINT contacts_amis_usage_check
      CHECK (amis_usage IN ('privat'));
  END IF;
END $$;
