-- KI-Upload: Kontakte aus Versicherungsdokumenten haben oft keine Kunden-E-Mail.
-- E-Mail wird optional; Duplikat-Checks laufen dann ueber Name/Firma.
ALTER TABLE contacts ALTER COLUMN email DROP NOT NULL;
