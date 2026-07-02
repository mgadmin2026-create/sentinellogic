-- Migration: Create dokumente_metadata table for Google Drive documents
-- Purpose: Track all documents uploaded for contacts with compression metrics

-- Create dokumente_metadata table
CREATE TABLE dokumente_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Zuordnung (Kontakt + Ordner)
  kontakt_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  ordner_id TEXT NOT NULL,  -- Google Drive Folder ID
  ordner_name TEXT NOT NULL,  -- e.g., "kontakt-12345_Musterfirma"

  -- Datei-Info
  file_id TEXT NOT NULL UNIQUE,  -- Google Drive File ID
  file_name TEXT NOT NULL,
  file_type TEXT,  -- MIME type or extension

  -- Größen & Komprimierung
  original_size INTEGER,  -- Bytes (before compression)
  compressed_size INTEGER,  -- Bytes (after compression)
  compression_ratio NUMERIC(5, 2),  -- e.g., 37.5 = 37.5% savings

  -- Status
  ordner_archived BOOLEAN DEFAULT false,
  kontakt_deleted_at TIMESTAMP,  -- When was contact deleted?

  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  created_by TEXT,
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  CONSTRAINT file_id_unique UNIQUE(file_id),
  CONSTRAINT compression_ratio_valid CHECK (compression_ratio >= 0 AND compression_ratio <= 100)
);

-- Indexes for common queries
CREATE INDEX idx_dokumente_kontakt_id ON dokumente_metadata(kontakt_id);
CREATE INDEX idx_dokumente_ordner_id ON dokumente_metadata(ordner_id);
CREATE INDEX idx_dokumente_ordner_archived ON dokumente_metadata(ordner_archived);
CREATE INDEX idx_dokumente_created_at ON dokumente_metadata(created_at DESC);
CREATE INDEX idx_dokumente_kontakt_deleted ON dokumente_metadata(kontakt_deleted_at);

-- Add columns to contacts table for Google Drive tracking
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS google_drive_ordner_id TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS google_drive_ordner_name TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS dokumente_count INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS dokumente_total_size INTEGER DEFAULT 0;  -- After compression
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS dokumente_last_upload TIMESTAMP;

-- Index for Google Drive lookups
CREATE INDEX IF NOT EXISTS idx_contacts_google_drive_ordner_id ON contacts(google_drive_ordner_id);
