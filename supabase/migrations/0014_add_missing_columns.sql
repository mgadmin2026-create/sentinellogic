-- Migration: Add missing columns to contact_notes_history
-- Purpose: Ensure all required columns exist for Dialfire sync

-- Add missing columns to contact_notes_history
ALTER TABLE contact_notes_history ADD COLUMN IF NOT EXISTS source VARCHAR DEFAULT 'manual';
ALTER TABLE contact_notes_history ADD COLUMN IF NOT EXISTS source_metadata JSONB;
ALTER TABLE contact_notes_history ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;
ALTER TABLE contact_notes_history ADD COLUMN IF NOT EXISTS created_by VARCHAR DEFAULT 'system';

-- Verify the table structure
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'contact_notes_history' ORDER BY ordinal_position;
