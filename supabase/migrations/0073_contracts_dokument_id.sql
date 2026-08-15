-- Verträge (contracts) hatten bisher keine Verknüpfung zum Quelldokument in
-- Google Drive, obwohl beide Anlage-Pfade (KI-Upload-Commit und direkter
-- Kontakt-Upload) die Datei im selben Request bereits hochladen. Analog zu
-- angebote.dokument_id (0072).
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS dokument_id UUID REFERENCES public.dokumente_metadata(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contracts_dokument_id ON public.contracts(dokument_id);
