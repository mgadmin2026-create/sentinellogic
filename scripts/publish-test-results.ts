import { readFile } from 'node:fs/promises'

type ResultStatus = 'passed' | 'failed' | 'skipped' | 'interrupted'

interface PlaywrightResult {
  status?: string
  duration?: number
  error?: { message?: string }
  errors?: Array<{ message?: string }>
}

interface PlaywrightTest {
  title?: string
  projectName?: string
  status?: string
  results?: PlaywrightResult[]
}

interface PlaywrightSpec {
  title?: string
  tests?: PlaywrightTest[]
}

interface PlaywrightSuite {
  title?: string
  specs?: PlaywrightSpec[]
  suites?: PlaywrightSuite[]
}

interface PlaywrightReport {
  suites?: PlaywrightSuite[]
  stats?: {
    startTime?: string
    duration?: number
    expected?: number
    unexpected?: number
    skipped?: number
    flaky?: number
  }
}

interface PublishedResult {
  title: string
  suite: string
  status: ResultStatus
  durationMs: number
  errorMessage: string | null
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} fehlt.`)
  return value
}

function mapStatus(status?: string): ResultStatus {
  if (status === 'passed') return 'passed'
  if (status === 'skipped') return 'skipped'
  if (status === 'interrupted') return 'interrupted'
  return 'failed'
}

function collectResults(suites: PlaywrightSuite[], parentTitles: string[] = []): PublishedResult[] {
  return suites.flatMap((suite) => {
    const suiteTitles = suite.title ? [...parentTitles, suite.title] : parentTitles
    const directResults = (suite.specs ?? []).flatMap((spec) =>
      (spec.tests ?? []).map((test) => {
        const latest = test.results?.at(-1)
        const error = latest?.error?.message ?? latest?.errors?.[0]?.message ?? null
        return {
          title: spec.title ?? test.title ?? 'Unbenannter Test',
          suite: suiteTitles.filter(Boolean).join(' › '),
          status: mapStatus(latest?.status ?? test.status),
          durationMs: Math.max(0, Math.round(latest?.duration ?? 0)),
          errorMessage: error,
        }
      })
    )

    return [...directResults, ...collectResults(suite.suites ?? [], suiteTitles)]
  })
}

async function main() {
  const baseUrl = new URL(requiredEnvironment('PLAYWRIGHT_BASE_URL')).origin
  const cleanupToken = requiredEnvironment('TEST_DATA_CLEANUP_TOKEN')
  const runId = requiredEnvironment('PLAYWRIGHT_RUN_ID')
  const report = JSON.parse(await readFile('test-results/results.json', 'utf8')) as PlaywrightReport
  const results = collectResults(report.suites ?? [])
  const stats = report.stats ?? {}
  const startedAt = stats.startTime ? new Date(stats.startTime) : new Date()
  const durationMs = Math.max(0, Math.round(stats.duration ?? results.reduce((sum, result) => sum + result.durationMs, 0)))
  const completedAt = new Date(startedAt.getTime() + durationMs)
  const passedCount = results.filter((result) => result.status === 'passed').length
  const failedCount = results.filter((result) => result.status === 'failed' || result.status === 'interrupted').length
  const skippedCount = results.filter((result) => result.status === 'skipped').length
  const status: ResultStatus = failedCount > 0 ? 'failed' : results.length > 0 ? 'passed' : 'skipped'

  const response = await fetch(`${baseUrl}/api/test-runs`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-test-cleanup-token': cleanupToken,
    },
    body: JSON.stringify({
      runId,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      status,
      environment: process.env.TEST_ENVIRONMENT ?? 'production',
      source: 'github-actions',
      sourceUrl: process.env.TEST_SOURCE_URL ?? null,
      commitSha: process.env.TEST_COMMIT_SHA ?? null,
      branch: process.env.TEST_BRANCH ?? 'main',
      durationMs,
      totalCount: results.length,
      passedCount,
      failedCount,
      skippedCount,
      results,
    }),
  })

  if (!response.ok) {
    throw new Error(`Testdashboard hat das Ergebnis abgelehnt (HTTP ${response.status}).`)
  }

  console.log(`[Testdashboard] Lauf ${runId} wurde ohne sensible Testdaten veröffentlicht.`)
}

main().catch((error: unknown) => {
  console.error('[Testdashboard] Ergebnisveröffentlichung fehlgeschlagen:', error instanceof Error ? error.message : 'Unbekannter Fehler')
  process.exitCode = 1
})
