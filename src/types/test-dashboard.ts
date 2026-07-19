export type TestRunStatus = 'passed' | 'failed' | 'skipped' | 'interrupted'
export type TestResultStatus = 'passed' | 'failed' | 'skipped' | 'interrupted'

export interface TestResultRecord {
  title: string
  suite: string
  status: TestResultStatus
  durationMs: number
  errorMessage?: string | null
}

export interface TestRunRecord {
  id: string
  runId: string
  createdAt: string
  startedAt: string
  completedAt: string
  status: TestRunStatus
  environment: string
  source: string
  sourceUrl?: string | null
  commitSha?: string | null
  branch?: string | null
  durationMs: number
  totalCount: number
  passedCount: number
  failedCount: number
  skippedCount: number
  results: TestResultRecord[]
}

export interface TestRunSummary {
  totalRuns: number
  passedRuns: number
  failedRuns: number
  successRate: number | null
}

export interface TestRunsResponse {
  runs: TestRunRecord[]
  summary: TestRunSummary
}
