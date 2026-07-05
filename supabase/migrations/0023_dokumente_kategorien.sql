-- Dokumentenablage: Kontakt-Typ, Kategorien und Drive-Ordner-Mapping
-- 1) contacts.kontakt_typ: Privat/Gewerbe steuert welche Ordnerstruktur gilt
-- 2) dokumente_metadata.kategorie: Kategorie-Pfad des Dokuments (z.B. "KFZ-Versicherung/Vertrag")
-- 3) drive_ordner_map: merkt sich Drive-IDs der lazy angelegten Unterordner,
--    damit Umbenennungen in der Config auf alle bestehenden Drive-Ordner propagiert werden koennen

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS kontakt_typ TEXT NOT NULL DEFAULT 'gewerbe'
  CHECK (kontakt_typ IN ('privat', 'gewerbe'));

ALTER TABLE dokumente_metadata
  ADD COLUMN IF NOT EXISTS kategorie TEXT NOT NULL DEFAULT 'Sonstiges';

CREATE TABLE IF NOT EXISTS drive_ordner_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kontakt_id UUID NOT NULL,
  pfad TEXT NOT NULL,               -- z.B. 'KFZ-Versicherung' oder 'KFZ-Versicherung/Vertrag'
  drive_folder_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (kontakt_id, pfad)
);

CREATE INDEX IF NOT EXISTS idx_drive_ordner_map_pfad ON drive_ordner_map (pfad);
CREATE INDEX IF NOT EXISTS idx_drive_ordner_map_kontakt ON drive_ordner_map (kontakt_id);

-- Nur Service-Role (wie google_drive_system_token)
ALTER TABLE drive_ordner_map ENABLE ROW LEVEL SECURITY;
