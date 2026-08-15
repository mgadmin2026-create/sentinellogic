// Überträgt den Beitrag eines per KI-Upload erkannten Vertrags automatisch
// als neue Zeile in die Beitragsübersicht des Kontakts — bisher musste jede
// Zeile manuell im Panel eingetragen werden, obwohl Sparte/Beitrag/Beginn/
// Ende bereits aus dem hochgeladenen Dokument bekannt sind.
//
// Mehrere Policen zur selben Sparte erzeugen bewusst mehrere Zeilen statt
// einer zusammengeführten — keine Deduplizierung nach Sparte, siehe
// Nutzer-Vorgabe "bei mehreren Policen zu einer Sparte mehrere Zeilen machen".
import { createServerClient } from '@/lib/supabase/server'
import type { Beitragsuebersicht, BeitragsPosition } from '@/types/beitragsuebersicht'
import { konvertiereBetrag, type Zyklus } from '@/lib/beitragsuebersicht-zyklus'

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

// KI liefert den Beitrag als freien Text ("521,60 EUR jährlich", "1.200 €
// p.a."), keine Zahl — hier auf einen Euro-Betrag reduziert. Punkte gelten
// als Tausendertrennzeichen (deutsches Format), Komma als Dezimaltrennzeichen.
export function parseBeitrag(raw?: string | null): number | null {
  if (!raw) return null
  const bereinigt = raw.replace(/\./g, '')
  const match = bereinigt.match(/(\d+)(?:,(\d+))?/)
  if (!match) return null
  const value = Number(`${match[1]}.${match[2] || '0'}`)
  return Number.isFinite(value) && value > 0 ? value : null
}

export async function uebernehmeVertragInBeitragsuebersicht(
  supabase: SupabaseClient,
  kontaktId: string,
  extraktion: VertragsExtraktionFuerUebernahme
): Promise<void> {
  const sparte = extraktion.sparte?.trim()
  const betragRoh = parseBeitrag(extraktion.beitrag)
  if (!sparte || betragRoh === null) return

  const istEigenvertrag = extraktion.spalte === 'neu'

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
    const wurdeUmgerechnet = extraktion.betragZyklus !== zielZyklus
    const betrag = wurdeUmgerechnet ? konvertiereBetrag(betragRoh, extraktion.betragZyklus, zielZyklus) : betragRoh

    const position: BeitragsPosition = {
      sparte,
      versicherer_alt: istEigenvertrag ? '' : extraktion.versicherungsgesellschaft?.trim() || '',
      beitrag_alt: istEigenvertrag ? null : betrag,
      beitrag_neu: istEigenvertrag ? betrag : null,
      beginn: extraktion.vertragsbeginn || null,
      ablauf: extraktion.vertragsende || null,
      bemerkung: wurdeUmgerechnet
        ? `Automatisch aus Vertragsupload übernommen: „${extraktion.beitrag}" (umgerechnet)`
        : `Automatisch aus Vertragsupload übernommen: „${extraktion.beitrag}"`,
      automatisch_uebernommen: true,
    }

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
