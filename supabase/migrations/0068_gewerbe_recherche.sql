-- Cache für die KI-Unternehmensrecherche (Teil der Gesprächsvorbereitung, siehe
-- src/lib/company-research.ts). Rein additiv, kein Backfill nötig — NULL heißt
-- schlicht "noch nicht recherchiert".
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS gewerbe_recherche jsonb;
