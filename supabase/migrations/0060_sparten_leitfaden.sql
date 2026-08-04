-- Migration: Sparten-Verwaltung + Mehrfach-Sparten pro Kontakt
--
-- Ersetzt den hartcodierten Erstgespräch-Leitfaden (src/data/erstgespraech-leitfaden.ts)
-- durch eine admin-pflegbare Tabelle und führt eine n:m-Beziehung Kontakt<->Sparte
-- ein (analog zu tags/contact_tag_map).
--
-- WICHTIG: contacts.sparte (die bisherige einzelne Text-Spalte) bleibt unverändert
-- bestehen und wird weiterhin von der bestehenden Automatisierung (Dialfire-
-- Kampagnen-Zuordnung, KlickTipp-Tags, Facebook-Import, Regeln) genutzt -- diese
-- Migration ändert daran nichts. Die neue Zuordnungstabelle ist zusätzlich; die
-- Anwendung hält contacts.sparte künftig automatisch mit der primären Sparte
-- synchron (siehe PUT /api/kontakte/[id]/sparten).

CREATE TABLE sparten (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  leitfaden_titel TEXT,
  leitfaden_fragen JSONB NOT NULL DEFAULT '[]'::jsonb,
  leitfaden_abschluss TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE contact_sparte_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  sparte_id UUID NOT NULL REFERENCES sparten(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT contact_sparte_map_unique UNIQUE (contact_id, sparte_id)
);

CREATE INDEX idx_contact_sparte_map_contact ON contact_sparte_map(contact_id);
CREATE INDEX idx_contact_sparte_map_sparte ON contact_sparte_map(sparte_id);

-- Max. eine primäre Sparte pro Kontakt
CREATE UNIQUE INDEX idx_contact_sparte_map_one_primary
  ON contact_sparte_map(contact_id) WHERE is_primary;

-- Seed: die 4 bereits im Code bekannten Sparten (bisher verstreut in
-- regeln/page.tsx SPARTE_OPTIONS + Facebook-Formular-Mappings). Der
-- Unternehmerschutz-Leitfaden wird 1:1 aus erstgespraech-leitfaden.ts
-- übernommen; die anderen drei starten leer, Melih befüllt sie über
-- /einstellungen/sparten.
INSERT INTO sparten (name, sort_order, leitfaden_titel, leitfaden_fragen, leitfaden_abschluss)
VALUES (
  'Unternehmerschutz',
  1,
  'Leitfaden Unternehmerschutz Paket für Lead',
  '[
    {"id":"firma","frage":"Wie lautet Ihre vollständige Anschrift?","felder":[
      {"feld":"company_name","label":"Firmenname"},
      {"feld":"rechtsform","label":"Rechtsform"},
      {"feld":"street","label":"Straße"},
      {"feld":"hausnummer","label":"Hausnummer"},
      {"feld":"postal_code","label":"PLZ"},
      {"feld":"city","label":"Ort"}
    ]},
    {"id":"gewerbe_seit","frage":"Seit wann besteht Ihr Gewerbe?","felder":[
      {"feld":"seit_wann_gewerbe","label":"Gewerbe seit","typ":"date"}
    ]},
    {"id":"gf_geburtsdatum","frage":"Könnten Sie mir Ihr Geburtsdatum nennen?","felder":[
      {"feld":"geburtstag_gf_inhaber","label":"Geburtsdatum GF/Inhaber","typ":"date"}
    ]},
    {"id":"taetigkeit","frage":"Können Sie mir kurz Ihre Tätigkeit beschreiben?","felder":[
      {"feld":"industry","label":"Branche / Tätigkeit"}
    ]},
    {"id":"mitarbeiter","frage":"Wie viele Mitarbeiter haben Sie?","felder":[
      {"feld":"mitarbeitanzahl","label":"Mitarbeiteranzahl","typ":"number"}
    ]},
    {"id":"umsatz","frage":"Wie hoch ist Ihr Jahresumsatz?","felder":[
      {"feld":"jahresumsatz","label":"Jahresumsatz"}
    ]},
    {"id":"inhaltssumme","frage":"Was ist der Wert Ihrer Waren oder Inhalte?","felder":[
      {"feld":"inhaltssumme","label":"Inhaltssumme"}
    ]},
    {"id":"interesse","frage":"Sie haben sich als Firmenprofis eingetragen. Welche Art von Versicherung interessiert Sie besonders?","felder":[
      {"feld":"versicherungstyp","label":"Interesse an Versicherung"}
    ]},
    {"id":"vorversicherung","frage":"Haben Sie bereits eine Vorversicherung?","felder":[
      {"feld":"bestandskunde","label":"Bestandskunde","typ":"checkbox"},
      {"feld":"versicherungsgesellschaft","label":"Versicherungsgesellschaft"}
    ]},
    {"id":"bestaetigung","frage":"Könnten Sie bitte Ihren Firmennamen sowie Ihre Telefonnummer und E-Mail-Adresse bestätigen?","nurAnzeige":true,"felder":[
      {"feld":"company_name","label":"Firmenname"},
      {"feld":"phone_mobile","label":"Telefon"},
      {"feld":"email","label":"E-Mail"}
    ]}
  ]'::jsonb,
  'Abschluss: Folgetermin vereinbaren, um ein Angebot zuzuschicken & zu besprechen.'
)
ON CONFLICT (name) DO NOTHING;

INSERT INTO sparten (name, sort_order) VALUES
  ('PKV', 2),
  ('Auslandsreiseversicherung', 3),
  ('Auslandskrankenversicherung', 4)
ON CONFLICT (name) DO NOTHING;

-- Best-Effort-Backfill: bestehende Kontakte mit gesetztem contacts.sparte, das
-- einem der 4 Namen entspricht, bekommen einen passenden Zuordnungs-Eintrag
-- (als primäre Sparte). contacts.sparte bleibt in jedem Fall unverändert.
INSERT INTO contact_sparte_map (contact_id, sparte_id, is_primary)
SELECT c.id, s.id, true
FROM contacts c
JOIN sparten s ON s.name = c.sparte
WHERE c.sparte IS NOT NULL
ON CONFLICT (contact_id, sparte_id) DO NOTHING;
