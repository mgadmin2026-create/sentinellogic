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

/**
 * Normalisiert eine Rufnummer für Placetel und den Datenbankabgleich nach E.164.
 * Gibt null zurück, wenn die Eingabe keine plausible internationale Rufnummer ist.
 */
export function normalizePhoneNumber(
  raw?: string | null,
  defaultCountryCallingCode = '49'
): string | null {
  if (!raw) return null

  // Übliche Durchwahl-Markierungen am Ende nicht als Teil der Rufnummer werten.
  const withoutExtension = raw.trim().replace(/(?:durchwahl|dw|ext\.?|x)\s*\d+$/i, '')
  const startsInternational = withoutExtension.startsWith('+')
  let digits = withoutExtension.replace(/\D/g, '')

  if (!digits) return null

  if (startsInternational) {
    // Schreibweisen wie +49 (0) 170 ... enthalten eine nationale Null.
    if (digits.startsWith(`${defaultCountryCallingCode}0`)) {
      digits = defaultCountryCallingCode + digits.slice(defaultCountryCallingCode.length + 1)
    }
  } else if (digits.startsWith('00')) {
    digits = digits.slice(2)
  } else if (digits.startsWith('0')) {
    digits = defaultCountryCallingCode + digits.slice(1)
  } else if (!digits.startsWith(defaultCountryCallingCode)) {
    digits = defaultCountryCallingCode + digits
  }

  // E.164 erlaubt höchstens 15 Ziffern. Acht Ziffern vermeiden offensichtliche
  // Durchwahlen oder interne Kurzwahlen als kostenpflichtiges externes Ziel.
  if (digits.length < 8 || digits.length > 15 || digits.startsWith('0')) return null

  return `+${digits}`
}

/** Prüft, ob eine E.164-Nummer in ein freigegebenes Zielland fällt. */
export function isAllowedPhoneDestination(
  normalizedPhone: string,
  allowedCountryCodes: string[]
): boolean {
  return allowedCountryCodes.some((code) => {
    const normalizedCode = code.trim().replace(/\s/g, '')
    if (!/^\+\d{1,4}$/.test(normalizedCode)) return false
    return normalizedPhone.startsWith(normalizedCode)
  })
}
