-- Migration: prüfung_grund aus metadata-Rohwert rekonstruieren (idempotent)
--
-- Hintergrund: Migration 0033 (prüfung_grund := insurance_product, dann
-- insurance_product := 'Unternehmerschutz') ist NICHT idempotent. Bei
-- mehrfacher Ausführung wurde prüfung_grund mit dem bereits gesetzten
-- 'Unternehmerschutz' überschrieben -> die echten Prüfgründe gingen verloren.
--
-- Rettung: Die ursprüngliche Formularantwort liegt unverändert in
-- metadata->>'welche_absicherung_möchtest_du_prüfen_lassen?' (Facebook-Rohdaten),
-- teils mit Formatierungsmüll ("•_betriebshaftpflicht_", "_•_d&o_" ...).
--
-- Diese Migration setzt prüfung_grund aus dem bereinigten Rohwert:
--   - "•" entfernen
--   - führende/abschließende "_" und Leerzeichen trimmen
-- Idempotent: liest ausschließlich aus metadata, nie aus insurance_product.
--
-- Betrifft nur Nicht-PKV-Kontakte (insurance_product = 'Unternehmerschutz').

UPDATE contacts
SET prüfung_grund = trim(both '_ ' from replace(
      metadata->>'welche_absicherung_möchtest_du_prüfen_lassen?', '•', ''))
WHERE insurance_product = 'Unternehmerschutz'
  AND metadata ? 'welche_absicherung_möchtest_du_prüfen_lassen?'
  AND trim(both '_ ' from replace(
        metadata->>'welche_absicherung_möchtest_du_prüfen_lassen?', '•', '')) <> '';
