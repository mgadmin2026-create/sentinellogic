// Überträgt den Beitrag eines per KI-Upload erkannten Vertrags automatisch
// als neue Zeile in die Beitragsübersicht des Kontakts — bisher musste jede
// Zeile manuell im Panel eingetragen werden, obwohl Sparte/Beitrag/Beginn/
// Ende bereits aus dem hochgeladenen Dokument bekannt sind.
//
// Mehrere Policen zur selben Sparte erzeugen bewusst mehrere Zeilen statt
// einer zusammengeführten — keine Deduplizierung nach Sparte, siehe
// Nutzer-Vorgabe "bei mehreren Policen zu einer Sparte mehrere Zeilen machen".
import { createServerClient } from '@/lib/supabase/server'
import type { Beitragsuebersicht } from '@/types/beitragsuebersicht'
import { parseBeitrag, type Zyklus } from '@/lib/beitragsuebersicht-zyklus'
import { baueBeitragspositionAusVertrag } from '@/lib/beitragsuebersicht-calc'

// Re-exportiert für Bestandscode (z.B. api/ki-upload/commit), das parseBeitrag
// bisher von hier importiert hat — die eigentliche Implementierung liegt
// jetzt client-sicher in beitragsuebersicht-zyklus.ts.
export { parseBeitrag }

type SupabaseClient = ReturnType<typeof createServerClient>

export interface VertragsExtraktionFuerUebernahme {
  sparte?: string | null
  beitrag?: string | null
  /** Vom Nutzer bestätigter Zyklus des gelesenen Betrags (siehe BeitragsuebersichtUebernahmeForm). */
  betragZyklus: Zyklus
  /** Vom Nutzer bestätigte Zielspalte — ersetzt die frühere automatische contract_type-Ableitung. */
  spalte: 'alt' | 'neu'
  versicherungsgesellschaft?: string | null
  vertragsbeginn?: string | null
  vertragsende?: string | null
}

export async function uebernehmeVertragInBeitragsuebersicht(
  supabase: SupabaseClient,
  kontaktId: string,
  extraktion: VertragsExtraktionFuerUebernahme
): Promise<void> {
  const sparte = extraktion.sparte?.trim()
  const betragRoh = parseBeitrag(extraktion.beitrag)
  if (!sparte || betragRoh === null) return

  try {
    const { data: kontakt, error } = await supabase
      .from('contacts')
      .select('beitragsuebersicht')
      .eq('id', kontaktId)
      .single()

    if (error) {
      console.warn('[beitragsuebersicht-uebernahme] Kontakt konnte nicht geladen werden:', error)
      return
    }

    const heute = new Date().toISOString().slice(0, 10)
    const bestehend = kontakt?.beitragsuebersicht as Beitragsuebersicht | null
    const zielZyklus: Zyklus = bestehend?.zyklus ?? 'jaehrlich'

    const position = baueBeitragspositionAusVertrag({
      sparte,
      betragRoh,
      betragZyklus: extraktion.betragZyklus,
      zielZyklus,
      spalte: extraktion.spalte,
      versicherungsgesellschaft: extraktion.versicherungsgesellschaft,
      beginn: extraktion.vertragsbeginn,
      ende: extraktion.vertragsende,
      beitragOriginalText: extraktion.beitrag,
    })

    const neu: Beitragsuebersicht = bestehend
      ? { ...bestehend, datum: heute, positionen: [...bestehend.positionen, position] }
      : { datum: heute, flotte_aktiv: false, positionen: [position], fahrzeuge: [], zyklus: 'jaehrlich' }

    const { error: updateError } = await supabase
      .from('contacts')
      .update({ beitragsuebersicht: neu })
      .eq('id', kontaktId)

    if (updateError) {
      console.warn('[beitragsuebersicht-uebernahme] Speichern fehlgeschlagen:', updateError)
    }
  } catch (err) {
    console.warn('[beitragsuebersicht-uebernahme] Unerwarteter Fehler (nicht blockierend):', err)
  }
}
