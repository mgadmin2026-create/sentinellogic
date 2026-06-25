-- Add Facebook custom fields and form ID to contacts table
ALTER TABLE public.contacts
  ADD COLUMN facebook_form_id TEXT,
  ADD COLUMN facebook_form_name TEXT,
  ADD COLUMN branche TEXT,
  ADD COLUMN versicherungstyp TEXT,
  ADD COLUMN jahresumsatz TEXT,
  ADD COLUMN mitarbeiterzahl TEXT;

-- Create indexes for better query performance
CREATE INDEX idx_contacts_facebook_form_id ON public.contacts(facebook_form_id);
CREATE INDEX idx_contacts_branche ON public.contacts(branche);
CREATE INDEX idx_contacts_versicherungstyp ON public.contacts(versicherungstyp);
