-- Zentrales Google-Drive-System-Konto
-- Statt pro User (Service Accounts haben keine Storage-Quota, per-User ist nicht zentral)
-- speichert diese Tabelle EIN gemeinsames OAuth-Token. Alle Uploads aller Mitarbeiter
-- landen zentral im Drive dieses einen Kontos.
--
-- Genau eine Zeile (id = 1). Zugriff ausschliesslich ueber den Service-Role-Key
-- (RLS aktiv, keine Policies -> anon/authenticated koennen nichts lesen/schreiben).

CREATE TABLE IF NOT EXISTS google_drive_system_token (
  id INTEGER PRIMARY KEY DEFAULT 1,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  scope TEXT,
  root_folder_id TEXT,
  connected_email TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT google_drive_system_token_single_row CHECK (id = 1)
);

ALTER TABLE google_drive_system_token ENABLE ROW LEVEL SECURITY;
-- Bewusst keine Policies: nur der Service-Role-Key (umgeht RLS) darf zugreifen.
