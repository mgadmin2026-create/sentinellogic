// Telefon-Helfer für Kontakt-Aktionen (WhatsApp / Anrufen)

/**
 * Wandelt eine Telefonnummer in das wa.me-Format (nur Ziffern, mit Ländervorwahl) um.
 *
 * Annahme: Ohne erkennbare Ländervorwahl wird Deutschland (49) angenommen,
 * da die Zielgruppe deutsch ist. Beispiele:
 *   "+49 151 23456789" -> "4915123456789"
 *   "0049 151 23456"   -> "4915123456"
 *   "0151/2345 678"    -> "491512345678"
 *   "+43 660 1234"     -> "436601234"
 *
 * Gibt einen leeren String zurück, wenn keine Ziffern vorhanden sind.
 */
export function toWhatsAppNumber(raw?: string | null): string {
  if (!raw) return ''

  const trimmed = raw.trim()
  const hasPlus = trimmed.startsWith('+')

  // Nur Ziffern behalten
  let digits = trimmed.replace(/\D/g, '')
  if (!digits) return ''

  if (hasPlus) {
    // Bereits internationale Notation (+49…, +43…) -> Ziffern reichen
    return digits
  }
  if (digits.startsWith('00')) {
    // 0049… -> internationale Notation ohne führende 00
    return digits.slice(2)
  }
  if (digits.startsWith('0')) {
    // Nationale Notation (0151…) -> führende 0 durch DE-Vorwahl ersetzen
    return '49' + digits.slice(1)
  }
  // Kein Präfix erkennbar -> als deutsche Nummer behandeln
  return '49' + digits
}
