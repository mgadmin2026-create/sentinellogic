-- Benutzerkonten für die Agentur: public.users an echte Supabase-Auth-Konten koppeln.
-- Vorher: public.users hatte eigene Random-UUIDs ohne echtes Login dahinter (3 Demo-Zeilen).
-- Geprüft: 0 Kontakte/Aufgaben referenzieren diese Demo-IDs -> gefahrlos leerbar.

DELETE FROM public.users;

ALTER TABLE public.users ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.users
  ADD CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'mitarbeiter';

-- Legt automatisch eine public.users-Zeile an, sobald ein Supabase-Auth-Konto entsteht.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role, active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'mitarbeiter'),
    true
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

COMMENT ON COLUMN public.users.role IS
  'Freitext statt Enum, bewusst erweiterbar (z.B. weitere Rollen später ohne Migration). Aktuell: admin | mitarbeiter.';
COMMENT ON TABLE public.users IS
  'Profil-Tabelle, 1:1 an auth.users gekoppelt (id = auth.users.id). Wird durch on_auth_user_created-Trigger befüllt.';
