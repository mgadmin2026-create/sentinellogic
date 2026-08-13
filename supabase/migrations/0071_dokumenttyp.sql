-- Dokumententyp-Erkennung: die KI-Analyse, die beim Dokument-Upload am Kontakt
-- ohnehin schon läuft (bisher nur für Vertragserkennung/Beitragsübersicht
-- genutzt), liefert bereits einen Dokumenttyp (police/angebot/nachtrag/
-- rechnung/sonstiges, siehe src/lib/ki-upload.ts). Bisher wurde dieser Wert
-- nirgends dauerhaft gespeichert — neu: persistiert pro Dokument, damit die
-- Dokumentenlisten danach gefiltert werden können.
-- NULL = nicht klassifiziert (Analyse fehlgeschlagen/nicht unterstützter
-- Dateityp) — wird in der UI wie "sonstiges" behandelt.
ALTER TABLE public.dokumente_metadata
  ADD COLUMN IF NOT EXISTS dokumenttyp text
  CHECK (dokumenttyp IS NULL OR dokumenttyp IN ('police', 'angebot', 'nachtrag', 'rechnung', 'sonstiges'));

CREATE INDEX IF NOT EXISTS idx_dokumente_dokumenttyp ON public.dokumente_metadata(dokumenttyp);
