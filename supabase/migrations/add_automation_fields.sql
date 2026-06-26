-- Add automation fields to contacts table
-- Allows per-contact automation control and auto/manual toggles

ALTER TABLE contacts ADD COLUMN (
  automation_disabled BOOLEAN DEFAULT false,
  dialfire_campaign_auto BOOLEAN DEFAULT true,
  dialfire_campaign_id TEXT,
  dialfire_task_auto BOOLEAN DEFAULT true,
  dialfire_task_name_field TEXT,
  klicktipp_tags_auto BOOLEAN DEFAULT true,
  klicktipp_tags_field TEXT[] DEFAULT '{}'
);

-- Create indexes for faster queries
CREATE INDEX idx_contacts_automation_disabled ON contacts(automation_disabled);
CREATE INDEX idx_contacts_dialfire_campaign_id ON contacts(dialfire_campaign_id);
