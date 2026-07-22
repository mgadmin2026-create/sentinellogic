-- E-Mail-Vorlagen für den Kontakt-Compose-Flow (ContactEmailModal).
-- Platzhalter-Syntax: {{vorname}}, {{nachname}}, {{name}}, {{firma}}, {{email}},
-- {{telefon}}, {{versicherungsgesellschaft}}, {{sparte}} — Ersetzung in
-- src/lib/mail-template-placeholders.ts.
CREATE TABLE IF NOT EXISTS mail_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO mail_templates (name, subject, body) VALUES
(
  'Datenanfrage',
  'Ergänzende Angaben für Ihre {{sparte}}',
  'Hallo {{vorname}},

um Ihren Vorgang weiter bearbeiten zu können, benötige ich noch ein paar ergänzende Angaben von Ihnen.

Könnten Sie mir bitte folgende Unterlagen bzw. Informationen zukommen lassen:
-
-

Sie können mir das einfach als Antwort auf diese E-Mail oder als Anhang zusenden.

Vielen Dank und beste Grüße'
),
(
  'Kündigung',
  'Kündigung Ihres bestehenden Vertrags bei {{versicherungsgesellschaft}}',
  'Hallo {{vorname}},

wie besprochen kümmere ich mich um die Kündigung Ihres bestehenden Vertrags bei {{versicherungsgesellschaft}}.

Damit ich die Kündigung fristgerecht einreichen kann, bestätigen Sie mir bitte kurz per Antwort auf diese E-Mail, dass ich in Ihrem Namen tätig werden darf.

Vielen Dank und beste Grüße'
),
(
  'Termin',
  'Terminvorschlag für unser Gespräch',
  'Hallo {{vorname}},

gerne würde ich mit Ihnen einen Termin für unser Gespräch vereinbaren.

Passt Ihnen folgender Termin: [Datum] um [Uhrzeit]?

Alternativ nennen Sie mir gerne 2–3 Termine, die bei Ihnen passen würden.

Beste Grüße'
);
