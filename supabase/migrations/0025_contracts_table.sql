-- v0.6.0 — Contracts Table für Vertragsdetails aus KI Upload
-- Speichert Versicherungsverträge mit Leistungen, Typ (Eigen/Fremd) und Metadaten

CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,

  -- Vertrags-Grunddaten
  contract_number TEXT,
  insurance_type TEXT,                    -- z.B. "Allianz", "Debeka"
  contract_type TEXT,                     -- 'eigen' | 'fremd' | 'unknown'

  -- Versicherungsdetails
  insurance_category TEXT,                -- z.B. "Krankenversicherung", "KFZ"
  monthly_premium TEXT,                   -- z.B. "€150/Monat"
  duration_start DATE,
  duration_end DATE,

  -- Leistungen (JSON Array)
  -- Format: [{ type: string, description: string, coverage?: string }]
  benefits JSONB DEFAULT '[]',

  -- Metadaten
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT DEFAULT 'ki_upload',    -- 'ki_upload' oder 'manual'
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index für schnelle Abfragen pro Kontakt
CREATE INDEX idx_contracts_contact_id ON contracts(contact_id);
CREATE INDEX idx_contracts_created_at ON contracts(created_at DESC);

-- Kommentar für Dokumentation
COMMENT ON TABLE contracts IS 'Versicherungsverträge mit Leistungen; erstellt via KI Upload';
COMMENT ON COLUMN contracts.benefits IS 'JSON Array von Leistungen: [{ type, description, coverage? }]';
COMMENT ON COLUMN contracts.contract_type IS 'eigen = Allianz + Melih Gün, fremd = andere, unknown = unklar';
