// Leichte, code-basierte Fehlerklassifikation für sync_runs — bewusst kein
// DB-Policy-Engine. Bestehende Integrationen (KlickTipp-Client, Dialfire-Edge-
// Function, etc.) werfen plain Error-Objekte mit dem HTTP-Status im Message-
// Text (z.B. "KlickTipp hat die Kontaktdaten abgelehnt (HTTP 406)."), daher
// wird der Status per Regex aus der Message extrahiert statt eine strukturierte
// Exception-Hierarchie in jeder Integration einzuführen.

export type ErrorClass = 'transient' | 'validation' | 'auth' | 'rate_limit' | 'unknown'

export interface ErrorClassification {
  errorClass: ErrorClass
  retryable: boolean
  detail: string
}

const TRANSIENT_PATTERNS = [
  /zeitüberschreitung/i,
  /timeout/i,
  /timed out/i,
  /econnreset/i,
  /econnrefused/i,
  /etimedout/i,
  /enotfound/i,
  /fetch failed/i,
  /network/i,
]

function extractHttpStatus(message: string): number | null {
  const match = message.match(/\b(?:HTTP\s*)?(\d{3})\b/)
  if (!match) return null
  const status = Number(match[1])
  return status >= 100 && status < 600 ? status : null
}

/** Klassifiziert einen gefangenen Fehler für sync_runs.error_class / .retryable. */
export function classifyError(error: unknown): ErrorClassification {
  const detail = error instanceof Error ? error.message : String(error)

  const status = extractHttpStatus(detail)
  if (status === 401 || status === 403) {
    return { errorClass: 'auth', retryable: false, detail }
  }
  if (status === 429) {
    return { errorClass: 'rate_limit', retryable: true, detail }
  }
  if (status != null && status >= 500) {
    return { errorClass: 'transient', retryable: true, detail }
  }
  if (status != null && status >= 400) {
    // 400/404/406/422 u.ä. — Server hat die Anfrage inhaltlich abgelehnt,
    // ein erneuter Versuch mit denselben Daten würde denselben Fehler liefern.
    return { errorClass: 'validation', retryable: false, detail }
  }

  if (TRANSIENT_PATTERNS.some((pattern) => pattern.test(detail))) {
    return { errorClass: 'transient', retryable: true, detail }
  }

  return { errorClass: 'unknown', retryable: true, detail }
}
