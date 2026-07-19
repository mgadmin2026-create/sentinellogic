import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getTestEnvironmentConfiguration, isValidCleanupToken, isValidTestRunId } from '@/lib/test-environment'
import type { TestResultRecord, TestRunRecord, TestRunsResponse, TestRunStatus } from '@/types/test-dashboard'

export const dynamic = 'force-dynamic'

const RUN_STATUSES: TestRunStatus[] = ['passed', 'failed', 'skipped', 'interrupted']
const RESULT_STATUSES = new Set(['passed', 'failed', 'skipped', 'interrupted'])

interface TestRunRow {
  id: string
  run_id: string
  created_at: string
  started_at: string
  completed_at: string
  status: TestRunStatus
  environment: string
  source: string
  source_url: string | null
  commit_sha: string | null
  branch: string | null
  duration_ms: number
  total_count: number
  passed_count: number
  failed_count: number
  skipped_count: number
  results: TestResultRecord[]
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0
}

function sanitizeText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return ''
  return value.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

function sanitizeErrorMessage(value: unknown): string | null {
  const message = sanitizeText(value, 800)
  if (!message) return null

  return message
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+=*/gi, 'Bearer [ENTFERNT]')
    .replace(/(token|secret|password|key)\s*[=:]\s*[^\s,;]+/gi, '$1=[ENTFERNT]')
}

function parseResult(value: unknown): TestResultRecord | null {
  if (!value || typeof value !== 'object') return null
  const result = value as Record<string, unknown>
  const title = sanitizeText(result.title, 200)
  const suite = sanitizeText(result.suite, 200)
  const status = result.status
  const durationMs = result.durationMs

  if (!title || typeof status !== 'string' || !RESULT_STATUSES.has(status) || !isNonNegativeInteger(durationMs)) {
    return null
  }

  return {
    title,
    suite,
    status: status as TestResultRecord['status'],
    durationMs,
    errorMessage: sanitizeErrorMessage(result.errorMessage),
  }
}

function parsePayload(value: unknown) {
  if (!value || typeof value !== 'object') return null
  const payload = value as Record<string, unknown>
  const runId = typeof payload.runId === 'string' ? payload.runId : null
  const status = payload.status
  const startedAt = typeof payload.startedAt === 'string' ? payload.startedAt : ''
  const completedAt = typeof payload.completedAt === 'string' ? payload.completedAt : ''
  const results = Array.isArray(payload.results) ? payload.results.map(parseResult).filter(Boolean) as TestResultRecord[] : []

  if (
    !isValidTestRunId(runId)
    || typeof status !== 'string'
    || !RUN_STATUSES.includes(status as TestRunStatus)
    || !startedAt
    || !completedAt
    || Number.isNaN(Date.parse(startedAt))
    || Number.isNaN(Date.parse(completedAt))
    || !isNonNegativeInteger(payload.durationMs)
    || !isNonNegativeInteger(payload.totalCount)
    || !isNonNegativeInteger(payload.passedCount)
    || !isNonNegativeInteger(payload.failedCount)
    || !isNonNegativeInteger(payload.skippedCount)
    || results.length > 500
  ) {
    return null
  }

  if (payload.passedCount + payload.failedCount + payload.skippedCount > payload.totalCount) return null

  const commitSha = sanitizeText(payload.commitSha, 40).toLowerCase()
  if (commitSha && !/^[0-9a-f]{7,40}$/.test(commitSha)) return null

  const sourceUrl = sanitizeText(payload.sourceUrl, 500)
  if (sourceUrl) {
    try {
      if (new URL(sourceUrl).hostname !== 'github.com') return null
    } catch {
      return null
    }
  }

  return {
    run_id: runId,
    started_at: new Date(startedAt).toISOString(),
    completed_at: new Date(completedAt).toISOString(),
    status: status as TestRunStatus,
    environment: sanitizeText(payload.environment, 40) || 'production',
    source: sanitizeText(payload.source, 60) || 'github-actions',
    source_url: sourceUrl || null,
    commit_sha: commitSha || null,
    branch: sanitizeText(payload.branch, 100) || null,
    duration_ms: payload.durationMs,
    total_count: payload.totalCount,
    passed_count: payload.passedCount,
    failed_count: payload.failedCount,
    skipped_count: payload.skippedCount,
    results,
  }
}

function mapRun(row: TestRunRow): TestRunRecord {
  return {
    id: row.id,
    runId: row.run_id,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    status: row.status,
    environment: row.environment,
    source: row.source,
    sourceUrl: row.source_url,
    commitSha: row.commit_sha,
    branch: row.branch,
    durationMs: Number(row.duration_ms),
    totalCount: row.total_count,
    passedCount: row.passed_count,
    failedCount: row.failed_count,
    skippedCount: row.skipped_count,
    results: Array.isArray(row.results) ? row.results : [],
  }
}

/** Liefert ausschließlich nicht-sensible Ergebnisdaten für das Testdashboard. */
export async function GET() {
  try {
    const supabase = createServerClient()
    const [runsResult, totalResult, passedResult, failedResult] = await Promise.all([
      supabase.from('test_runs').select('*').order('completed_at', { ascending: false }).limit(50),
      supabase.from('test_runs').select('id', { count: 'exact', head: true }),
      supabase.from('test_runs').select('id', { count: 'exact', head: true }).eq('status', 'passed'),
      supabase.from('test_runs').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
    ])

    if (runsResult.error || totalResult.error || passedResult.error || failedResult.error) {
      console.error('[Testläufe] Ergebnisdaten konnten nicht geladen werden')
      return NextResponse.json({ error: 'Testläufe konnten nicht geladen werden.' }, { status: 500 })
    }

    const totalRuns = totalResult.count ?? 0
    const passedRuns = passedResult.count ?? 0
    const response: TestRunsResponse = {
      runs: ((runsResult.data ?? []) as TestRunRow[]).map(mapRun),
      summary: {
        totalRuns,
        passedRuns,
        failedRuns: failedResult.count ?? 0,
        successRate: totalRuns > 0 ? Math.round((passedRuns / totalRuns) * 1000) / 10 : null,
      },
    }

    return NextResponse.json(response)
  } catch {
    console.error('[Testläufe] Ergebnisabfrage fehlgeschlagen')
    return NextResponse.json({ error: 'Testläufe konnten nicht geladen werden.' }, { status: 500 })
  }
}

/** Speichert idempotent ein von der CI übermitteltes, bereinigtes Testergebnis. */
export async function POST(request: NextRequest) {
  const configuration = getTestEnvironmentConfiguration()
  if (!configuration.ready || !configuration.config) {
    return NextResponse.json({ success: false, error: 'Testbetrieb ist nicht freigegeben.' }, { status: 403 })
  }

  if (!isValidCleanupToken(request.headers.get('x-test-cleanup-token'), configuration.config.cleanupToken)) {
    return NextResponse.json({ success: false, error: 'Ergebnis-Autorisierung ungültig.' }, { status: 401 })
  }

  try {
    const payload = parsePayload(await request.json())
    if (!payload) {
      return NextResponse.json({ success: false, error: 'Testergebnis ist ungültig.' }, { status: 400 })
    }

    const supabase = createServerClient()
    const { error } = await supabase.from('test_runs').upsert(payload, { onConflict: 'run_id' })
    if (error) {
      console.error('[Testläufe] Ergebnis konnte nicht gespeichert werden')
      return NextResponse.json({ success: false, error: 'Testergebnis konnte nicht gespeichert werden.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, runId: payload.run_id })
  } catch {
    console.error('[Testläufe] Ergebnisübertragung fehlgeschlagen')
    return NextResponse.json({ success: false, error: 'Testergebnis konnte nicht verarbeitet werden.' }, { status: 500 })
  }
}
