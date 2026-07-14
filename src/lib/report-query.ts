// NL → SQL für flexibles Reporting (Text-zu-SQL via Claude) + Sicherheits-Guard
import Anthropic from '@anthropic-ai/sdk'
import { REPORT_SCHEMA } from './report-schema'

const MODEL = 'claude-opus-4-8'

// Verbotene Keywords (schreibend / gefährlich) — als ganze Wörter geprüft
const FORBIDDEN_KEYWORDS = [
  'insert', 'update', 'delete', 'drop', 'alter', 'create', 'truncate',
  'grant', 'revoke', 'copy', 'merge', 'call', 'do', 'vacuum', 'analyze',
  'comment', 'reindex', 'refresh', 'listen', 'notify', 'lock', 'set',
  'begin', 'commit', 'rollback', 'savepoint', 'execute', 'prepare',
]

// Geheim-/Token-Tabellen, die niemals abgefragt werden dürfen
const FORBIDDEN_TABLES = [
  'google_oauth_tokens', 'google_drive_system_token', 'system_config',
  'facebook_sync_config', 'token', 'secret', 'oauth', 'pg_',
]

export interface SqlValidation {
  ok: boolean
  error?: string
}

/** Guard: erlaubt nur EINE lesende SELECT/WITH-Anweisung. */
export function validateSelectSql(sqlRaw: string): SqlValidation {
  if (!sqlRaw || !sqlRaw.trim()) {
    return { ok: false, error: 'Leere SQL-Abfrage' }
  }

  // Kommentare entfernen, damit sie den Check nicht umgehen
  const sql = sqlRaw
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .trim()

  const lower = sql.toLowerCase()

  // Genau eine Anweisung: kein ';' außer optional am Ende
  const withoutTrailing = sql.replace(/;\s*$/, '')
  if (withoutTrailing.includes(';')) {
    return { ok: false, error: 'Nur eine einzelne Abfrage erlaubt' }
  }

  // Muss mit SELECT oder WITH beginnen
  if (!/^\s*(select|with)\b/i.test(sql)) {
    return { ok: false, error: 'Nur lesende SELECT-Abfragen erlaubt' }
  }

  // Verbotene Keywords (Wortgrenzen)
  for (const kw of FORBIDDEN_KEYWORDS) {
    if (new RegExp(`\\b${kw}\\b`, 'i').test(lower)) {
      return { ok: false, error: `Nicht erlaubtes Schlüsselwort: ${kw}` }
    }
  }

  // Geheim-Tabellen
  for (const t of FORBIDDEN_TABLES) {
    if (lower.includes(t)) {
      return { ok: false, error: 'Zugriff auf geschützte Tabelle abgelehnt' }
    }
  }

  return { ok: true }
}

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    sql: {
      type: 'string',
      description: 'Eine einzelne read-only PostgreSQL-SELECT-Abfrage. Leer, wenn nicht umsetzbar.',
    },
    explanation: {
      type: 'string',
      description: 'Kurze deutsche Erklärung, was die Abfrage liefert (1-2 Sätze).',
    },
  },
  required: ['sql', 'explanation'],
  additionalProperties: false,
}

function buildPrompt(userPrompt: string): string {
  const today = new Date().toISOString().slice(0, 10)
  return `Du bist ein Reporting-Assistent für ein CRM. Übersetze die deutsche Auswertungs-Anfrage
in GENAU EINE lesende PostgreSQL-Abfrage (SELECT oder WITH … SELECT).

Regeln:
- NUR lesend. Niemals INSERT/UPDATE/DELETE/DDL o.ä.
- Nur Tabellen und Spalten aus dem Schema unten verwenden.
- Spalten/Bezeichner mit Umlauten IMMER doppelt quoten, z.B. "prüfung_grund", "priorität", "fällig".
- Zeiträume relativ zum heutigen Datum (${today}) berechnen, z.B. created_at >= now() - interval '7 days'.
- Sinnvolle Spaltennamen/Aliase und, wo passend, ORDER BY.
- Bei Aggregationen sprechende Aliase (z.B. anzahl).
- Wenn die Anfrage nicht sicher/umsetzbar ist: leere sql und Begründung in explanation.

SCHEMA:
${REPORT_SCHEMA}

ANFRAGE:
${userPrompt}`
}

export interface GeneratedReport {
  sql: string
  explanation: string
}

export async function generateReportSql(userPrompt: string): Promise<GeneratedReport> {
  const client = new Anthropic()

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    output_config: {
      format: { type: 'json_schema', schema: RESPONSE_SCHEMA as unknown as Record<string, unknown> },
    },
    messages: [{ role: 'user', content: [{ type: 'text', text: buildPrompt(userPrompt) }] }],
  })

  if (response.stop_reason === 'refusal') {
    throw new Error('Die Anfrage wurde von der KI abgelehnt.')
  }

  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Keine Antwort von der KI erhalten.')
  }

  const parsed = JSON.parse(textBlock.text) as GeneratedReport
  // Abschließendes Semikolon entfernen — die Abfrage wird serverseitig als Subquery gewrappt
  const sql = (parsed.sql || '').trim().replace(/;\s*$/, '')
  return { sql, explanation: parsed.explanation || '' }
}
