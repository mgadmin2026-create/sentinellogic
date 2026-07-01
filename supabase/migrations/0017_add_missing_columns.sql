-- Migration: Add missing columns for dialfire sync
-- Purpose: Add dialfire_version to dialfire_sync_log and metadata to activities

ALTER TABLE dialfire_sync_log ADD COLUMN IF NOT EXISTS dialfire_version VARCHAR;

ALTER TABLE activities ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_dialfire_sync_log_version ON dialfire_sync_log(dialfire_version);
CREATE INDEX IF NOT EXISTS idx_activities_metadata ON activities USING gin(metadata);
