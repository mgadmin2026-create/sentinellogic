/**
 * Unternehmensrecherche: reichert die Gesprächsvorbereitung (call-prep.ts) für
 * Gewerbekontakte mit öffentlich recherchierten Firmendaten an. Nutzt Claudes
 * serverseitiges web_search-Tool — keine eigene Datenquellen-/Vertragsentscheidung
 * nötig, läuft komplett innerhalb eines messages.create()-Aufrufs.
 *
 * Ergebnis wird nie automatisch in Kontaktfelder übernommen — reine Anzeige in
 * der Gesprächsvorbereitung, analog zu call-prep.ts "Erfinde NICHTS".
 */
import Anthropic from '@anthropic-ai/sdk'
import { createServerClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activities-logger'

const MODEL = 'claude-sonnet-5'

export interface CompanyResearchResult {
  kurzprofil: string | null
  branche: string | null
  rechtsform: string | null
  mitarbeitanzahl: string | null
  jahresumsatz: string | null
  quellen: { url: string; beschreibung: string }[]
}

interface StoredCompanyResearch extends CompanyResearchResult {
  researched_at: string
}

export interface CompanyResearchContext {
  companyName: string
  website?: string | null
  ort?: string | null
}

const COMPANY_RESEARCH_SCHEMA = {
  type: 'object',
  properties: {
    kurzprofil: {
      type: ['string', 'null'],
      description: '2-3 Sätze Kurzprofil des Unternehmens, gesprächstauglich formuliert. null wenn keine verlässlichen Informationen gefunden wurden.',
    },
    branche: { type: ['string', 'null'], description: 'Branche/Tätigkeitsfeld, falls belegt.' },
    rechtsform: { type: ['string', 'null'], description: 'Rechtsform (z.B. GmbH, e.K.), falls belegt.' },
    mitarbeitanzahl: { type: ['string', 'null'], description: 'Ungefähre Mitarbeiterzahl als Freitext (z.B. "ca. 15-20"), falls belegt.' },
    jahresumsatz: { type: ['string', 'null'], description: 'Ungefährer Jahresumsatz als Freitext, falls belegt.' },
    quellen: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          beschreibung: { type: 'string', description: 'Kurz, was auf dieser Quelle gefunden wurde.' },
        },
        required: ['url', 'beschreibung'],
        additionalProperties: false,
      },
      description: 'Belege für jedes ausgefüllte Feld. Leeres Array wenn nichts Verlässliches gefunden wurde.',
    },
  },
  required: ['kurzprofil', 'branche', 'rechtsform', 'mitarbeitanzahl', 'jahresumsatz', 'quellen'],
  additionalProperties: false,
} as const

function buildPrompt(ctx: CompanyResearchContext): string {
  const bekannt = [
    `Firmenname: ${ctx.companyName}`,
    ctx.website ? `Bekannte Website: ${ctx.website}` : null,
    ctx.ort ? `Ort: ${ctx.ort}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  return `Du recherchierst im öffentlichen Web Basisinformationen zu einem Unternehmen, um einen Versicherungsmakler auf ein Telefonat mit diesem Gewerbekunden vorzubereiten.

WICHTIGE REGELN:
1. Nutze das web_search-Tool, um das Unternehmen zu identifizieren und Informationen zu sammeln.
2. Erfinde NICHTS. Fülle ein Feld nur, wenn die Suche einen echten Beleg dafür liefert. Wenn du dir bei der Zuordnung (Namensgleichheit mit anderen Firmen) nicht sicher bist, lass die betroffenen Felder auf null.
3. Für jedes ausgefüllte Feld muss mindestens eine Quelle in "quellen" stehen.
4. Findet sich keine verlässliche Web-Präsenz (z.B. sehr kleiner lokaler Betrieb), ist ein komplett leeres Ergebnis (alle Felder null, quellen: []) das korrekte Ergebnis — keine Vermutungen.
5. kurzprofil: 2-3 Sätze, sachlich, gesprächstauglich formuliert — kein Marketing-Ton.

BEKANNTE DATEN:
${bekannt}`
}

export async function generateCompanyResearch(ctx: CompanyResearchContext): Promise<CompanyResearchResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY ist nicht gesetzt')
  }

  const client = new Anthropic()

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5 } satisfies Anthropic.WebSearchTool20260209],
    output_config: {
      format: { type: 'json_schema', schema: COMPANY_RESEARCH_SCHEMA as unknown as Record<string, unknown> },
    },
    messages: [{ role: 'user', content: buildPrompt(ctx) }],
  })

  if (response.stop_reason === 'refusal') {
    throw new Error('Die KI hat die Anfrage abgelehnt.')
  }
  if (response.stop_reason === 'max_tokens') {
    throw new Error('Antwort abgebrochen (Token-Limit).')
  }

  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Keine Antwort erhalten.')
  }

  return JSON.parse(textBlock.text) as CompanyResearchResult
}

function isEmpty(r: CompanyResearchResult): boolean {
  return !r.kurzprofil && !r.branche && !r.rechtsform && !r.mitarbeitanzahl && !r.jahresumsatz && r.quellen.length === 0
}

/**
 * Liest den Recherche-Cache eines Kontakts, oder recherchiert bei fehlendem
 * Cache neu und persistiert das Ergebnis. Gibt null zurück wenn der Kontakt
 * kein Gewerbekontakt mit Firmenname ist (kein Fehler, einfach übersprungen).
 */
export async function ensureGewerbeRecherche(
  supabase: ReturnType<typeof createServerClient>,
  contact: {
    id: string
    kontakt_typ?: string | null
    company_name?: string | null
    website?: string | null
    city?: string | null
    gewerbe_recherche?: StoredCompanyResearch | null
  }
): Promise<CompanyResearchResult | null> {
  if (contact.kontakt_typ !== 'gewerbe' || !contact.company_name) return null

  if (contact.gewerbe_recherche) {
    const { researched_at: _researchedAt, ...result } = contact.gewerbe_recherche
    return result
  }

  return runAndPersistResearch(supabase, contact)
}

/** Erzwingt eine neue Recherche, ignoriert einen vorhandenen Cache. */
export async function refreshGewerbeRecherche(
  supabase: ReturnType<typeof createServerClient>,
  contact: { id: string; kontakt_typ?: string | null; company_name?: string | null; website?: string | null; city?: string | null }
): Promise<CompanyResearchResult | null> {
  if (contact.kontakt_typ !== 'gewerbe' || !contact.company_name) return null
  return runAndPersistResearch(supabase, contact)
}

async function runAndPersistResearch(
  supabase: ReturnType<typeof createServerClient>,
  contact: { id: string; company_name?: string | null; website?: string | null; city?: string | null }
): Promise<CompanyResearchResult> {
  const result = await generateCompanyResearch({
    companyName: contact.company_name!,
    website: contact.website,
    ort: contact.city,
  })

  const stored: StoredCompanyResearch = { ...result, researched_at: new Date().toISOString() }
  await supabase.from('contacts').update({ gewerbe_recherche: stored }).eq('id', contact.id)

  await logActivity(
    null,
    contact.id,
    'gewerbe_recherche',
    isEmpty(result) ? 'Unternehmensrecherche durchgeführt (keine verlässlichen Daten gefunden)' : 'Unternehmensrecherche durchgeführt',
    { quellen_count: result.quellen.length }
  )

  return result
}
