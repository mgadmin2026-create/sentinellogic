-- Archivieren statt Löschen für Kontakte/Aufgaben, plus interne Tags.

ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS contacts_archived_at_idx
  ON public.contacts(archived_at) WHERE archived_at IS NOT NULL;

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS tasks_archived_at_idx
  ON public.tasks(archived_at) WHERE archived_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tags_name_unique UNIQUE (name)
);
CREATE INDEX IF NOT EXISTS tags_name_idx ON public.tags(lower(name));

CREATE TABLE IF NOT EXISTS public.contact_tag_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT contact_tag_map_unique UNIQUE (contact_id, tag_id)
);
CREATE INDEX IF NOT EXISTS contact_tag_map_contact_idx ON public.contact_tag_map(contact_id);
CREATE INDEX IF NOT EXISTS contact_tag_map_tag_idx ON public.contact_tag_map(tag_id);

COMMENT ON COLUMN public.contacts.archived_at IS
  'Zeitpunkt der Archivierung. NULL = aktiv. Ersetzt das frühere Hard-Delete in der App; echtes Löschen bleibt nur über direkten Supabase-Zugriff (Tests/Admin) möglich.';
COMMENT ON COLUMN public.tasks.archived_at IS
  'Zeitpunkt der Archivierung, gesetzt wenn beim Archivieren des zugehörigen Kontakts explizit bestätigt.';
COMMENT ON TABLE public.tags IS 'Interne, frei vergebbare Tags (kein Bezug zu KlickTipp-Tags).';
COMMENT ON TABLE public.contact_tag_map IS 'Zuordnung Kontakt ↔ Tag (n:m).';
