-- Migration: prüfung_grund aus insurance_product korrigieren (Nicht-PKV)
--
-- Problem: Bei Nicht-PKV-Kontakten hat die Intake-Form den Prüfungsgrund
-- fälschlich in insurance_product gespeichert (z.B. betriebshaftpflicht,
-- strafrechtsschutz, unternehmerschutz_paket, d&o, Unternehmerschutz).
-- Das tatsächliche Versicherungsprodukt ist bei all diesen Kontakten
-- "Unternehmerschutz".
--
-- Fix:
--   prüfung_grund     := aktueller insurance_product-Wert
--   insurance_product := 'Unternehmerschutz'
--
-- Ausgenommen:
--   - PKV-Kontakte (insurance_product = 'PKV') -> haben korrekte Daten
--   - Kontakte ohne insurance_product (NULL)   -> kein Prüfungsgrund vorhanden

UPDATE contacts
SET
  prüfung_grund    = insurance_product,
  insurance_product = 'Unternehmerschutz'
WHERE insurance_product IS NOT NULL
  AND insurance_product <> 'PKV';
