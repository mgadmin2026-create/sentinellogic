-- Self-Service-Profil: Name/E-Mail/Passwort durch den User selbst änderbar.
-- public.users.email wird bislang nur beim Anlegen (INSERT-Trigger) gesetzt.
-- Sobald ein User seine E-Mail selbst ändert (Bestätigung über den von
-- Supabase versendeten Link) oder ein Admin sie ändert, muss public.users
-- nachziehen — sonst zeigt die App eine veraltete Adresse.

create or replace function public.handle_auth_user_email_sync()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email is distinct from old.email then
    update public.users set email = new.email where id = new.id;
  end if;
  return new;
end; $$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated after update on auth.users
  for each row execute function public.handle_auth_user_email_sync();
