'use client'

// Führt das vom Server zurückgegebene Wähl-Kommando am Arbeitsplatz aus.
//
// Weg B: Der Anruf wird lokal vom Placetel Softphone Plus aufgebaut.
//
// Zwei Besonderheiten, die hier bewusst behandelt werden:
//
// 1. Browser blockieren unverschlüsselte Anfragen aus einer HTTPS-Seite
//    normalerweise als "Mixed Content". localhost bzw. 127.0.0.1 gelten dabei
//    laut Spezifikation als vertrauenswürdig und sind ausgenommen — das lokale
//    Kommando funktioniert deshalb auch aus der gehosteten Anwendung heraus.
//
// 2. Das Softphone antwortet auf diese Anfrage sehr wahrscheinlich ohne
//    CORS-Freigabe. Die Antwort ist deshalb für uns nicht lesbar. Da wir sie
//    nicht benötigen — es geht nur darum, das Wählen auszulösen — wird die
//    Anfrage mit 'no-cors' abgesetzt. Ein Fehlschlag bedeutet dann "Softphone
//    nicht erreichbar", nicht "Anruf fehlgeschlagen".

export interface DialCommand {
  scheme: 'tel' | 'http'
  url: string
}

export interface DialResult {
  ok: boolean
  /** Für den Nutzer verständliche Rückmeldung, falls etwas nicht geklappt hat. */
  hint?: string
}

const LOCAL_TIMEOUT_MS = 4_000

export async function executeDialCommand(command: DialCommand): Promise<DialResult> {
  if (command.scheme === 'tel') {
    // Öffnet den registrierten Protokoll-Handler (Softphone Plus).
    // Ob ein Handler registriert ist, kann der Browser uns nicht mitteilen —
    // deshalb hier bewusst keine Erfolgsmeldung erfinden.
    window.location.href = command.url
    return { ok: true }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), LOCAL_TIMEOUT_MS)

  try {
    await fetch(command.url, {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
    })
    return { ok: true }
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === 'AbortError'
    return {
      ok: false,
      hint: aborted
        ? 'Das Softphone hat nicht rechtzeitig geantwortet. Läuft Placetel Softphone Plus auf diesem Rechner?'
        : 'Das Softphone ist auf diesem Rechner nicht erreichbar. Bitte Softphone Plus starten — oder die Wähl-Einstellungen prüfen.',
    }
  } finally {
    clearTimeout(timeout)
  }
}
