-- Neue Mail-Vorlage für den Versand der Beitragsübersicht (siehe neuer
-- "Per E-Mail senden"-Button in BeitragsuebersichtPanel.tsx, wird beim
-- Öffnen automatisch anhand des Namens ausgewählt).
-- mail_templates hat keinen Unique-Constraint auf "name" — Idempotenz daher
-- per WHERE NOT EXISTS statt ON CONFLICT sicherstellen.
INSERT INTO mail_templates (name, subject, body)
SELECT
  'Beitragsübersicht',
  'Ihre aktuelle Beitragsübersicht',
  'Hallo {{vorname}},

anbei erhalten Sie Ihre aktuelle Beitragsübersicht mit dem Vergleich Ihrer bisherigen und der neuen Beiträge.

Bei Fragen dazu stehe ich Ihnen jederzeit gerne zur Verfügung.

Beste Grüße'
WHERE NOT EXISTS (SELECT 1 FROM mail_templates WHERE name = 'Beitragsübersicht');
