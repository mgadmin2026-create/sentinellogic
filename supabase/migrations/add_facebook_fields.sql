-- Add Facebook integration fields to contacts table
ALTER TABLE public.contacts
  ADD COLUMN facebook_id TEXT UNIQUE,
  ADD COLUMN facebook_form_id TEXT,
  ADD COLUMN metadata JSONB DEFAULT '{}',
  ADD COLUMN source TEXT;

-- Create index for facebook_id lookups
CREATE INDEX idx_contacts_facebook_id ON public.contacts(facebook_id);
CREATE INDEX idx_contacts_source ON public.contacts(source);

-- Backfill existing records with metadata = {} if null
UPDATE public.contacts SET metadata = '{}' WHERE metadata IS NULL;
