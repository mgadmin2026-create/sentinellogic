-- Migration: Neues Feld für die Dialfire-Kampagne "Auslandskrankenversicherung"
-- Campaign-ID: 7ZXEC6Z53YHPL2GR

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS usa_kanada_eingeschlossen TEXT;
-- Stores Dialfire-Feld: "soll_USA_Kanada_eingeschlossen_werden_"
-- Beispielwerte (Dialfire-seitig noch nicht final beobachtet): "Ja", "Nein"
