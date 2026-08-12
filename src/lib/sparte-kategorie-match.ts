// Best-effort-Zuordnung einer Kontakt-Sparte (z.B. "KFZ", "Haftpflicht") zu einer
// Dokumenten-Ablage-Kategorie (Google-Drive-Ordnerstruktur, konfigurierbar über
// system_config "dokument_ordnerstruktur"). Es gibt kein festes Mapping — Sparten-
// und Kategorie-Namen stammen aus unabhängig gepflegten Listen — daher ein
// normalisierter Teilstring-Abgleich statt exakter Zuordnungstabelle. Liefert
// null bei Uneindeutigkeit, der Aufrufer fällt dann auf "Sonstiges" zurück und
// der Nutzer wählt manuell (nie eine falsche Kategorie erzwingen).
// Gängige Branchen-Abkürzungen, die als Initialismus keinen Teilstring-Treffer
// gegen ausgeschriebene Kategorie-Namen liefern würden (z.B. "PKV" vs. "Private
// Krankenversicherung"). Bewusst klein gehalten — nur eindeutige Standardkürzel.
const ABKUERZUNGEN: Record<string, string> = {
  pkv: 'privatekrankenversicherung',
  phv: 'privathaftpflichtversicherung',
  bu: 'berufsunfaehigkeitsversicherung',
  bav: 'betrieblichealtersvorsorge',
  bkv: 'betrieblichekrankenversicherung',
}

function normalisiere(text: string): string {
  const bereinigt = text.toLowerCase().trim()
  const aufgeloest = ABKUERZUNGEN[bereinigt] ?? bereinigt
  return aufgeloest
    .replace(/versicherung(en)?/g, '')
    .replace(/[^a-z0-9äöüß]/g, '')
    .trim()
}

/**
 * @param sparte Name der (primären) Kontakt-Sparte, falls vorhanden
 * @param kategorien Geflachte Liste verfügbarer Ablage-Kategorien (Top-Level + "Eltern/Kind")
 * @returns eine passende Top-Level-Kategorie oder null, falls keine eindeutig genug ist
 */
export function findeKategorieFuerSparte(sparte: string | null | undefined, kategorien: string[]): string | null {
  const spartenKern = normalisiere(sparte ?? '')
  if (!spartenKern) return null

  // Nur Top-Level-Kategorien als automatischer Vorschlag — bei einer Unterkategorie
  // (z.B. "KFZ-Versicherung/Vertrag") wäre die Auswahl sonst zu spezifisch/zufällig.
  const topLevel = kategorien.filter((k) => !k.includes('/'))

  for (const kategorie of topLevel) {
    const kategorieKern = normalisiere(kategorie)
    if (!kategorieKern) continue
    if (kategorieKern.includes(spartenKern) || spartenKern.includes(kategorieKern)) {
      return kategorie
    }
  }
  return null
}
