/**
 * KI-Upload: Versicherungsdokumente (PDF/Bild) mit Claude analysieren.
 *
 * Das Dokument geht als document-/image-Block direkt an die Claude API —
 * funktioniert fuer digitale UND gescannte PDFs (Vision), kein eigenes OCR.
 * Die Antwort ist per json_schema erzwungen (Structured Outputs).
 */
import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-opus-4-8'

export interface Leistung {
  type: string
  description: string
  coverage?: string
}

export interface KiExtraktion {
  dokumenttyp: 'police' | 'angebot' | 'nachtrag' | 'rechnung' | 'sonstiges'
  kontakt_typ: 'privat' | 'gewerbe'
  first_name: string
  last_name: string
  company_name: string
  email: string
  phone: string
  street: string
  postal_code: string
  city: string
  country: string
  versicherungsgesellschaft: string
  versicherungstyp: string
  sparte: string
  vertragsnummer: string
  beitrag: string
  zahlweise: string
  vertragsbeginn: string
  vertragsende: string
  kategorie: string
  zusammenfassung: string
  weitere_personen: string[]
  // Vertragsdetails (neu v0.6.0)
  is_contract: boolean
  contract_type: 'eigen' | 'fremd' | 'unknown'
  benefits: Leistung[]
}

const EXTRAKTION_SCHEMA = {
  type: 'object',
  properties: {
    dokumenttyp: {
      type: 'string',
      enum: ['police', 'angebot', 'nachtrag', 'rechnung', 'sonstiges'],
      description: 'Art des Dokuments',
    },
    kontakt_typ: {
      type: 'string',
      enum: ['privat', 'gewerbe'],
      description: 'gewerbe wenn Versicherungsnehmer eine Firma ist, sonst privat',
    },
    first_name: { type: 'string', description: 'Vorname des Versicherungsnehmers; leer wenn Firma ohne genannte Person' },
    last_name: { type: 'string', description: 'Nachname des Versicherungsnehmers; bei Firma ohne Person der Firmenname' },
    company_name: { type: 'string', description: 'Firmenname des Versicherungsnehmers; leer bei Privatperson' },
    email: { type: 'string', description: 'E-Mail des Versicherungsnehmers (NICHT des Versicherers/Vermittlers); leer wenn nicht vorhanden' },
    phone: { type: 'string', description: 'Telefon des Versicherungsnehmers (NICHT Service-Hotline des Versicherers); leer wenn nicht vorhanden' },
    street: { type: 'string' },
    postal_code: { type: 'string' },
    city: { type: 'string' },
    country: { type: 'string', description: 'Land, z.B. Deutschland oder Schweiz; leer wenn unklar' },
    versicherungsgesellschaft: { type: 'string', description: 'Name des Versicherers, z.B. Allianz, Verti' },
    versicherungstyp: { type: 'string', description: 'z.B. KFZ-Versicherung, Betriebshaftpflicht, Rechtsschutz' },
    sparte: { type: 'string', description: 'Sparte falls genannt, sonst leer' },
    vertragsnummer: { type: 'string', description: 'Versicherungsschein-/Vertrags-/Angebotsnummer' },
    beitrag: { type: 'string', description: 'Beitrag inkl. Waehrung und Periode, z.B. "521,60 EUR jährlich"' },
    zahlweise: { type: 'string', description: 'z.B. monatlich, vierteljährlich, jährlich; leer wenn unklar' },
    vertragsbeginn: { type: 'string', description: 'Datum YYYY-MM-DD oder leer' },
    vertragsende: { type: 'string', description: 'Datum YYYY-MM-DD oder leer' },
    kategorie: { type: 'string', description: 'Exakt einer der erlaubten Kategorie-Pfade oder "Sonstiges"' },
    zusammenfassung: { type: 'string', description: 'Ein Satz: was ist dieses Dokument' },
    weitere_personen: {
      type: 'array',
      items: { type: 'string' },
      description: 'Weitere versicherte Personen (Name), falls das Dokument mehrere enthält',
    },
    // Vertragsdetails (neu v0.6.0)
    is_contract: {
      type: 'boolean',
      description: 'true wenn es sich um einen Versicherungsvertrag/eine Police handelt',
    },
    contract_type: {
      type: 'string',
      enum: ['eigen', 'fremd', 'unknown'],
      description: 'eigen: Allianz + Melih Gün; fremd: andere Versicherer; unknown: unklar',
    },
    benefits: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', description: 'Art der Leistung (z.B. Krankenversicherung, Rente)' },
          description: { type: 'string', description: 'Detail-Beschreibung der Leistung' },
          coverage: { type: 'string', description: 'Deckung/Betrag falls genannt (z.B. €2000/Monat)' },
        },
        required: ['type', 'description'],
        additionalProperties: false,
      },
      description: 'Leistungen aus dem Vertrag, falls vorhanden',
    },
  },
  required: [
    'dokumenttyp', 'kontakt_typ', 'first_name', 'last_name', 'company_name',
    'email', 'phone', 'street', 'postal_code', 'city', 'country',
    'versicherungsgesellschaft', 'versicherungstyp', 'sparte', 'vertragsnummer',
    'beitrag', 'zahlweise', 'vertragsbeginn', 'vertragsende',
    'kategorie', 'zusammenfassung', 'weitere_personen',
    'is_contract', 'contract_type', 'benefits',
  ],
  additionalProperties: false,
} as const

function buildPrompt(kategorienPrivat: string[], kategorienGewerbe: string[]): string {
  return `Du extrahierst Daten aus einem deutschen Versicherungsdokument (Police, Angebot, Nachtrag o.ä.).

WICHTIGE REGELN:
1. Der Kontakt ist der VERSICHERUNGSNEHMER (Kunde) — niemals der Versicherer, Vermittler oder Makler.
   Achtung: "Überreicht durch", "Ihr Berater", "Vermittler" bezeichnet den Makler — dessen Daten NICHT als Kontakt verwenden.
2. Bei mehreren versicherten Personen: Die erste/Hauptperson ist der Kontakt; weitere Namen in weitere_personen.
3. kontakt_typ: "gewerbe" wenn der Versicherungsnehmer eine Firma ist (GmbH, AG, e.K., UG, KG, Einzelunternehmen mit Betriebsart), sonst "privat".
4. Bei Firma ohne genannte Ansprechperson: company_name = Firmenname, first_name leer, last_name = Firmenname.
5. kategorie: Wähle den PASSENDSTEN Pfad aus der Liste des jeweiligen kontakt_typ. Passt keiner, nimm exakt "Sonstiges". Erfinde keine neuen Kategorien.

Erlaubte Kategorien für kontakt_typ "privat":
${kategorienPrivat.map((k) => `- ${k}`).join('\n') || '- (keine konfiguriert)'}
- Sonstiges

Erlaubte Kategorien für kontakt_typ "gewerbe":
${kategorienGewerbe.map((k) => `- ${k}`).join('\n') || '- (keine konfiguriert)'}
- Sonstiges

6. is_contract & Leistungen (benefits):
   - is_contract=true wenn es ein Versicherungsvertrag/eine Police ist (auch Angebote/Aufträge).
   - is_contract=false für Rechnungen, Mahnungen, Schreiben ohne Vertragsdetails.
   - benefits=[]: Extrahiere die Leistungen/Deckungen aus dem Vertrag. Jede Leistung hat:
     * type: Art der Leistung (z.B. "Krankenversicherung", "Zahnbehandlung", "Unfallversicherung")
     * description: Was ist versichert (z.B. "Ambulante und stationäre Behandlung", "Bis zu €100/Jahr")
     * coverage: Optionale Deckungssumme (z.B. "€50.000", "€200/Monat")

7. contract_type (EIGEN vs. FREMD):
   - eigen: Wenn BEIDE "Allianz" UND "Melih Gün" im Dokument erwähnt sind.
   - fremd: Alle anderen Versicherer (Debeka, DKV, Signal, etc.).
   - unknown: Wenn Eigenschaftsdaten unklar sind.
   ➜ Case-INSENSITIVE Suche durchführen!

8. Felder ohne Information: leerer String bzw. leeres Array. Nichts erfinden.`
}

export async function analysiereVersicherungsdokument(
  file: Buffer,
  mimeType: string,
  kategorienPrivat: string[],
  kategorienGewerbe: string[]
): Promise<KiExtraktion> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY ist nicht gesetzt')
  }

  const client = new Anthropic()
  const base64 = file.toString('base64')

  const isPdf = mimeType === 'application/pdf'
  const isImage = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mimeType)
  if (!isPdf && !isImage) {
    throw new Error(`Nicht unterstützter Dateityp: ${mimeType}. Erlaubt: PDF, JPG, PNG, WebP.`)
  }

  const dokumentBlock = isPdf
    ? ({
        type: 'document' as const,
        source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 },
      })
    : ({
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
          data: base64,
        },
      })

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    output_config: {
      format: { type: 'json_schema', schema: EXTRAKTION_SCHEMA as unknown as Record<string, unknown> },
    },
    messages: [
      {
        role: 'user',
        content: [
          dokumentBlock,
          { type: 'text', text: buildPrompt(kategorienPrivat, kategorienGewerbe) },
        ],
      },
    ],
  })

  if (response.stop_reason === 'refusal') {
    throw new Error('Die KI hat die Analyse dieses Dokuments abgelehnt.')
  }
  if (response.stop_reason === 'max_tokens') {
    throw new Error('Analyse abgebrochen (Token-Limit). Bitte kleineres Dokument versuchen.')
  }

  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Keine Analyse-Antwort erhalten.')
  }

  const daten = JSON.parse(textBlock.text) as KiExtraktion

  // Kategorie gegen die erlaubte Liste absichern (Fallback Sonstiges)
  const erlaubt = new Set([
    ...kategorienPrivat,
    ...kategorienGewerbe,
    'Sonstiges',
  ])
  if (!erlaubt.has(daten.kategorie)) {
    daten.kategorie = 'Sonstiges'
  }

  return daten
}
