-- Migration: Neue Felder für das KinderProfis-Formular "Auslandsreiseversicherung"
-- Facebook Lead-Formular-ID: 3169048349946307

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS anzahl_personen TEXT;
-- Stores: "Wie viele Personen sollen in der Family abgesichert werden?"
-- Beispiele: "2 Personen", "3 Personen", "oder mehr"

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS reisezeitpunkt TEXT;
-- Stores: "Wann verreist ihr das nächste Mal?"
-- Beispiele: "Innerhalb der nächsten 4 Wochen", "In den nächsten 3 Monaten", "Später"

CREATE INDEX IF NOT EXISTS idx_contacts_reisezeitpunkt ON contacts(reisezeitpunkt);
