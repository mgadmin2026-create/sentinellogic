/**
 * Call-Vorbereitungs-Agent: fasst vorhandene CRM-Daten eines Kontakts zu einer
 * kurzen, gesprächstauglichen internen Zusammenfassung für Melih zusammen —
 * Kurzprofil + Gesprächsvorschläge + Hinweise auf sensible Punkte.
 *
 * Reine Text-Aufbereitung, keine Entscheidungen, keine externe Kommunikation.
 * Antwort ist per json_schema erzwungen (Structured Outputs), analog ki-upload.ts.
 */
import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-sonnet-5'

export interface CallPrepActivity {
  type: string
  description: string
  created_at: string
}

export interface CallPrepTask {
  titel: string
  status: string
  priorität: string
  fällig: string | null
}

export interface CallPrepNote {
  content: string
  created_at: string
  type: string
}

export interface CallPrepContext {
  firstName: string
  lastName: string
  companyName?: string | null
  status: string
  sparte?: string | null
  pipelineStage?: string | null
  source?: string | null
  assignedUserName?: string | null
  bestandskunde?: boolean | null
  qualität?: string | null
  versicherungsgesellschaft?: string | null
  jahresumsatz?: string | null
  mitarbeitanzahl?: string | null
  headNotes?: string | null
  notesHistory: CallPrepNote[]
  activities: CallPrepActivity[]
  openTasks: CallPrepTask[]
  documentCount: number
}

export interface CallPrepResult {
  summary: string
  talking_points: string[]
  flags: string[]
}

const CALL_PREP_SCHEMA = {
  type: 'object',
  properties: {
    summary: {
      type: 'string',
      description: 'Kurzprofil des Kontakts, 2-4 Sätze, gesprächstauglich formuliert (kein Fachjargon).',
    },
    talking_points: {
      type: 'array',
      items: { type: 'string' },
      description: 'Mindestens 3 konkrete, kurze Gesprächsvorschläge für den bevorstehenden Anruf.',
    },
    flags: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Sensible Punkte, auf die Melih vor/während des Anrufs achten sollte (z.B. offener Vorgang, überfällige Rückmeldung, unzufriedene Historie). Leeres Array, wenn nichts auffällig ist.',
    },
  },
  required: ['summary', 'talking_points', 'flags'],
  additionalProperties: false,
} as const

function fmtDatum(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('de-DE')
}

function buildPrompt(ctx: CallPrepContext): string {
  const stammdaten = [
    `Name: ${ctx.firstName} ${ctx.lastName}`,
    ctx.companyName ? `Firma: ${ctx.companyName}` : null,
    `Status: ${ctx.status}`,
    ctx.sparte ? `Sparte: ${ctx.sparte}` : null,
    ctx.pipelineStage ? `Pipeline-Schritt: ${ctx.pipelineStage}` : null,
    ctx.source ? `Quelle: ${ctx.source}` : null,
    ctx.assignedUserName ? `Verantwortlich: ${ctx.assignedUserName}` : null,
    ctx.qualität ? `Qualität: ${ctx.qualität}` : null,
    ctx.bestandskunde != null ? `Bestandskunde: ${ctx.bestandskunde ? 'ja' : 'nein'}` : null,
    ctx.versicherungsgesellschaft ? `Aktueller Versicherer: ${ctx.versicherungsgesellschaft}` : null,
    ctx.jahresumsatz ? `Jahresumsatz: ${ctx.jahresumsatz}` : null,
    ctx.mitarbeitanzahl ? `Mitarbeiterzahl: ${ctx.mitarbeitanzahl}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  const notizen = [
    ctx.headNotes ? `Aktuelle Notiz: ${ctx.headNotes}` : null,
    ...ctx.notesHistory.map((n) => `- [${fmtDatum(n.created_at)}] ${n.content}`),
  ]
    .filter(Boolean)
    .join('\n')

  const aktivitäten = ctx.activities.length
    ? ctx.activities.map((a) => `- [${fmtDatum(a.created_at)}] ${a.description}`).join('\n')
    : '(keine fachlichen Aktivitäten protokolliert — neuer/kaum kontaktierter Lead)'

  const aufgaben = ctx.openTasks.length
    ? ctx.openTasks
        .map((t) => `- ${t.titel} (Status: ${t.status}, Priorität: ${t.priorität}${t.fällig ? `, fällig: ${fmtDatum(t.fällig)}` : ''})`)
        .join('\n')
    : '(keine offenen Aufgaben)'

  return `Du bist ein interner Assistent für Melih (Versicherungsmakler bei einer Allianz Generalvertretung). Deine einzige Aufgabe: ihn in wenigen Sekunden auf einen bevorstehenden Telefonanruf mit diesem Kontakt vorzubereiten.

WICHTIGE REGELN:
1. Erfinde NICHTS. Nutze ausschließlich die unten aufgeführten Daten. Wenn etwas nicht bekannt ist, lass es weg statt zu spekulieren.
2. Schreibe kurz, klar und gesprächstauglich — keine Fachfloskeln, keine Marketingsprache, kein Blabla.
3. talking_points: mindestens 3 konkrete, direkt verwertbare Gesprächsvorschläge (keine allgemeinen Plattitüden wie "Beziehung aufbauen").
4. flags: sensible Punkte, die Melih vor/während des Gesprächs kennen sollte — z.B. ein offener Vorgang, eine überfällige Rückmeldung, Anzeichen von Unzufriedenheit in der Historie. Leeres Array, wenn nichts dergleichen erkennbar ist. Keine Flags erfinden, nur wenn die Daten sie hergeben.
5. Ist die Historie dünn oder leer (neuer Lead ohne bisherige Aktivitäten/Notizen): liefere trotzdem sinnvolle talking_points, aber mit Fokus auf Bedarfsklärung (Erstkontakt, offene Fragen klären) statt auf einen Rückblick, den es nicht gibt.

STAMMDATEN:
${stammdaten}

NOTIZEN:
${notizen || '(keine Notizen vorhanden)'}

FACHLICHE AKTIVITÄTEN (neueste zuerst):
${aktivitäten}

OFFENE AUFGABEN:
${aufgaben}

DOKUMENTE:
${ctx.documentCount} Dokument(e) beim Kontakt hinterlegt (Inhalt nicht ausgewertet, nur zur Orientierung).`
}

export async function generateCallPrep(ctx: CallPrepContext): Promise<CallPrepResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY ist nicht gesetzt')
  }

  const client = new Anthropic()

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    output_config: {
      format: { type: 'json_schema', schema: CALL_PREP_SCHEMA as unknown as Record<string, unknown> },
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

  return JSON.parse(textBlock.text) as CallPrepResult
}
