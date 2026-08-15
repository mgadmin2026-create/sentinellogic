-- Angebote (Deal-/Angebotsnachverfolgung, v0.32.0). Eigenständiges Datenmodell
-- statt der alten, seit v0.3.0 aus der UI entfernten opportunities-Tabelle
-- (deren Status-Werte neu/kontaktiert/analyse/... nicht zum gewünschten
-- Verkaufs-Lifecycle passen).
CREATE TABLE IF NOT EXISTS angebote (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_erstellung'
    CHECK (status IN ('in_erstellung', 'versendet', 'in_verhandlung', 'gewonnen', 'verloren')),
  -- Rohwert + Zyklus; der monatliche Beitrag wird live berechnet (wie bei der
  -- Beitragsübersicht) über konvertiereBetrag() aus beitragsuebersicht-zyklus.ts,
  -- nie persistiert.
  betrag NUMERIC,
  zyklus TEXT CHECK (zyklus IN ('monatlich', 'vierteljaehrlich', 'halbjaehrlich', 'jaehrlich')),
  sparte TEXT,
  leistungsumfang TEXT,
  dokument_id UUID REFERENCES dokumente_metadata(id) ON DELETE SET NULL,
  created_by TEXT NOT NULL DEFAULT 'manuell', -- 'manuell' | 'ki_upload' | 'dokument_upload'
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_angebote_contact_id ON angebote(contact_id);
CREATE INDEX IF NOT EXISTS idx_angebote_status ON angebote(status) WHERE archived_at IS NULL;
