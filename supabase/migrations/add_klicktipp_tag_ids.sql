-- Add klicktipp_tag_ids column to contacts table
ALTER TABLE public.contacts
ADD COLUMN klicktipp_tag_ids bigint[] DEFAULT '{}';

-- Create index for better query performance
CREATE INDEX idx_contacts_klicktipp_tag_ids ON public.contacts USING gin(klicktipp_tag_ids);

-- Update existing Sentinel test contacts with tag ID 14700012
UPDATE public.contacts
SET klicktipp_tag_ids = ARRAY[14700012]::bigint[]
WHERE klicktipp_tags = ARRAY['Sentinel']::text[];
