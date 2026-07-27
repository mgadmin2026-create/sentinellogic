-- Placetel: persönliche SIP-Zuordnung je Mitarbeiter + Wähl-Konfiguration.
--
-- Hintergrund: Bisher lief jeder Anruf über einen einzigen globalen SIP-Benutzer
-- (PLACETEL_DEFAULT_SIPUID). Damit war nicht unterscheidbar, wer telefoniert hat,
-- und mehrere Mitarbeiter konnten nicht parallel über ihr eigenes Gerät wählen.
--
-- Die SIP-Kennung ist eine Konto-/Gerätekennung ohne Passwort. Ein SIP-Passwort
-- wird für den Anrufaufbau nicht benötigt und wird bewusst NICHT gespeichert.

alter table public.users
  add column if not exists placetel_sipuid text;

comment on column public.users.placetel_sipuid is
  'Placetel SIP-Kennung des Mitarbeiters (z. B. 7777xxxxx@fpbx.de). NULL = Rückfall auf PLACETEL_DEFAULT_SIPUID.';

-- Mehrere Mitarbeiter dürfen nicht versehentlich dieselbe SIP-Kennung bekommen,
-- sonst wäre die Zuordnung eingehender Anrufe wieder mehrdeutig.
create unique index if not exists users_placetel_sipuid_unique
  on public.users (placetel_sipuid)
  where placetel_sipuid is not null;

-- Wähl-Konfiguration als system_config-Eintrag statt Umgebungsvariable:
-- Das exakte lokale Kommando von Softphone Plus ist herstellerseitig nicht
-- dokumentiert und muss am Arbeitsplatz ermittelt werden. Über system_config
-- lässt es sich ohne neues Deployment korrigieren.
insert into public.system_config (key, config)
values (
  'placetel_dial',
  jsonb_build_object(
    -- 'tel'        = tel:-Link, Softphone Plus als Protokoll-Handler (kein Setup nötig)
    -- 'local_http' = lokales Kommando an das Softphone (url_template)
    -- 'placetel_api' = serverseitiger Rückruf über die Placetel-API (Weg A)
    'method', 'tel',
    -- {nummer} wird durch die URL-kodierte Rufnummer in E.164 ersetzt.
    'url_template', 'http://127.0.0.1:8080/make_call?number={nummer}',
    'enabled', true
  )
)
on conflict (key) do nothing;
