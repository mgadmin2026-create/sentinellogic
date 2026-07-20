'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { TEST_CASES, type TestCaseDefinition, type TestPriority } from '@/data/test-cases'
import type { TestResultRecord, TestRunRecord, TestRunsResponse, TestRunStatus } from '@/types/test-dashboard'

type DashboardTab = 'testfaelle' | 'durchfuehrungen' | 'umgebung'
interface TestEnvironmentStatus {
  configured: boolean
  ready: boolean
  cleanupEnabled: boolean
  lastResetAt?: string | null
  lastRunId?: string | null
  message: string
}

interface TestCaseControlItem {
  id: string
  executable: boolean
  enabled: boolean
}

interface TestCaseControlResponse {
  configured: boolean
  cases: TestCaseControlItem[]
  message: string
}

const PRIORITY_STYLES: Record<TestPriority, string> = {
  Kritisch: 'bg-red-50 text-red-700 ring-red-600/10',
  Hoch: 'bg-orange-50 text-orange-700 ring-orange-600/10',
  Mittel: 'bg-blue-50 text-blue-700 ring-blue-600/10',
}

function StatusIcon({ type }: { type: 'planned' | 'empty' | 'waiting' | 'environment' }) {
  const paths = {
    planned: <><path d="M9 11l3 3L22 4" /><path d="M21 12a9 9 0 1 1-5.3-8.2" /></>,
    empty: <><path d="M3 3v18h18" /><path d="M7 16l4-4 3 3 5-6" /></>,
    waiting: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    environment: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 8h.01M11 8h.01" /><path d="M7 13h10M7 16h6" /></>,
  }

  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[type]}
    </svg>
  )
}

function EmptyRuns() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
        <StatusIcon type="waiting" />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-gray-900">Noch keine Testdurchführung</h3>
      <p className="mt-1 max-w-md text-sm leading-6 text-gray-500">
        Sobald Playwright angebunden ist, erscheinen hier Testlauf, Commit, Umgebung, Laufzeit und Ergebnis.
      </p>
    </div>
  )
}

const RUN_STATUS_LABELS: Record<TestRunStatus, string> = {
  passed: 'Erfolgreich',
  failed: 'Fehlgeschlagen',
  skipped: 'Übersprungen',
  interrupted: 'Abgebrochen',
}

const RUN_STATUS_STYLES: Record<TestRunStatus, string> = {
  passed: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10',
  failed: 'bg-red-50 text-red-700 ring-red-600/10',
  skipped: 'bg-gray-100 text-gray-600 ring-gray-500/10',
  interrupted: 'bg-orange-50 text-orange-700 ring-orange-600/10',
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1000) return `${durationMs} ms`
  const seconds = Math.round(durationMs / 1000)
  if (seconds < 60) return `${seconds} s`
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

interface TestCaseExecution {
  run: TestRunRecord
  status: TestRunStatus
}

function combineResultStatus(results: TestResultRecord[]): TestRunStatus {
  if (results.some((result) => result.status === 'failed')) return 'failed'
  if (results.some((result) => result.status === 'interrupted')) return 'interrupted'
  if (results.every((result) => result.status === 'passed')) return 'passed'
  return 'skipped'
}

function getTestCaseExecutions(testCase: TestCaseDefinition, runs: TestRunRecord[]): TestCaseExecution[] {
  if (testCase.resultTitles.length === 0) return []

  return runs.flatMap((run) => {
    const matchingResults = run.results.filter((result) => testCase.resultTitles.includes(result.title))
    if (matchingResults.length === 0) return []
    return [{ run, status: combineResultStatus(matchingResults) }]
  })
}

function RunsView({ runs, loading, error }: { runs: TestRunRecord[]; loading: boolean; error: string | null }) {
  const [expandedRunIds, setExpandedRunIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (runs[0]) {
      setExpandedRunIds((current) => current.size > 0 ? current : new Set([runs[0].id]))
    }
  }, [runs])

  function toggleRun(runId: string) {
    setExpandedRunIds((current) => {
      const next = new Set(current)
      if (next.has(runId)) next.delete(runId)
      else next.add(runId)
      return next
    })
  }

  if (loading) {
    return <div className="px-6 py-14 text-center text-sm text-gray-500">Testdurchführungen werden geladen …</div>
  }

  if (error) {
    return <div className="px-6 py-14 text-center text-sm text-red-600">{error}</div>
  }

  if (runs.length === 0) return <EmptyRuns />

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-left text-sm">
        <thead className="bg-gray-50/70 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-6 py-3">Ergebnis</th>
            <th className="px-6 py-3">Durchführung</th>
            <th className="px-6 py-3">Commit</th>
            <th className="px-6 py-3">Tests</th>
            <th className="px-6 py-3">Dauer</th>
            <th className="px-6 py-3">Zeitpunkt</th>
            <th className="px-6 py-3 text-right">Einzeltests</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {runs.map((run, runIndex) => {
            const isExpanded = expandedRunIds.has(run.id)
            const detailsId = `test-run-details-${run.id}`

            return (
              <Fragment key={run.id}>
                <tr className="hover:bg-gray-50/70">
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${RUN_STATUS_STYLES[run.status]}`}>
                      {RUN_STATUS_LABELS[run.status]}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {run.sourceUrl ? (
                      <a href={run.sourceUrl} target="_blank" rel="noreferrer" className="font-mono text-xs font-semibold text-blue-700 hover:underline">
                        {run.runId}
                      </a>
                    ) : <span className="font-mono text-xs text-gray-600">{run.runId}</span>}
                    <p className="mt-1 text-xs text-gray-400">{run.environment}</p>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 font-mono text-xs text-gray-600">{run.commitSha?.slice(0, 7) ?? '—'}</td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className="font-semibold text-emerald-700">{run.passedCount} ✓</span>
                    {run.failedCount > 0 && <span className="ml-3 font-semibold text-red-700">{run.failedCount} ✕</span>}
                    {run.skippedCount > 0 && <span className="ml-3 text-gray-500">{run.skippedCount} –</span>}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-gray-600">{formatDuration(run.durationMs)}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-xs text-gray-500">{formatDate(run.completedAt)}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      aria-controls={detailsId}
                      onClick={() => toggleRun(run.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
                    >
                      {isExpanded ? 'Ausblenden' : 'Anzeigen'}
                      <svg className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </button>
                  </td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={7} className="bg-gray-50/80 px-6 py-5">
                      <div
                        id={detailsId}
                        data-testid={runIndex === 0 ? 'latest-test-run-details' : undefined}
                        className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h3 className="text-sm font-semibold text-gray-900">Einzeltests</h3>
                            <p className="mt-1 text-xs text-gray-500">Grün = erfolgreich, Rot = fehlgeschlagen.</p>
                          </div>
                          <span className="text-xs text-gray-500">{run.results.length} Ergebnisse</span>
                        </div>

                        {run.results.length > 0 ? (
                          <ul className="mt-4 divide-y divide-gray-100 border-t border-gray-100">
                            {run.results.map((result, resultIndex) => (
                              <li key={`${result.title}-${resultIndex}`} className="py-3">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                  <div className="min-w-0">
                                    <div className="flex items-start gap-2.5">
                                      <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${result.status === 'passed' ? 'bg-emerald-500' : result.status === 'failed' ? 'bg-red-500' : result.status === 'interrupted' ? 'bg-orange-500' : 'bg-gray-400'}`} />
                                      <div>
                                        <p className="text-sm font-semibold text-gray-900">{result.title}</p>
                                        {result.suite && <p className="mt-0.5 text-xs text-gray-500">{result.suite}</p>}
                                      </div>
                                    </div>
                                    {result.errorMessage && (
                                      <p className="ml-5 mt-2 break-words rounded-lg border border-red-100 bg-red-50 px-3 py-2 font-mono text-[11px] leading-5 text-red-700">
                                        {result.errorMessage}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex shrink-0 items-center gap-3 pl-5 sm:pl-0">
                                    <span className="text-xs text-gray-400">{formatDuration(result.durationMs)}</span>
                                    <span
                                      data-test-result-status={result.status}
                                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${RUN_STATUS_STYLES[result.status]}`}
                                    >
                                      {RUN_STATUS_LABELS[result.status]}
                                    </span>
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-4 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-center text-xs text-gray-500">
                            Für diesen älteren Lauf wurden noch keine Einzeltestergebnisse gespeichert.
                          </p>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function TestdashboardPage() {
  const [activeTab, setActiveTab] = useState<DashboardTab>('testfaelle')
  const [search, setSearch] = useState('')
  const [priority, setPriority] = useState<'Alle' | TestPriority>('Alle')
  const [environmentStatus, setEnvironmentStatus] = useState<TestEnvironmentStatus | null>(null)
  const [testRuns, setTestRuns] = useState<TestRunsResponse>({
    runs: [],
    summary: { totalRuns: 0, passedRuns: 0, failedRuns: 0, successRate: null },
  })
  const [runsLoading, setRunsLoading] = useState(true)
  const [runsError, setRunsError] = useState<string | null>(null)
  const [expandedCaseIds, setExpandedCaseIds] = useState<Set<string>>(new Set())
  const [testCaseControl, setTestCaseControl] = useState<TestCaseControlResponse>({ configured: false, cases: [], message: 'Testfallsteuerung wird geladen …' })
  const [controlLoading, setControlLoading] = useState(true)
  const [controlToken, setControlToken] = useState('')
  const [controlUnlocked, setControlUnlocked] = useState(false)
  const [showControlLogin, setShowControlLogin] = useState(false)
  const [controlError, setControlError] = useState<string | null>(null)
  const [controlSavingId, setControlSavingId] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function loadEnvironmentStatus() {
      try {
        const response = await fetch('/api/test-environment', { cache: 'no-store' })
        const status = await response.json() as TestEnvironmentStatus
        if (active) setEnvironmentStatus(status)
      } catch {
        if (active) {
          setEnvironmentStatus({
            configured: false,
            ready: false,
            cleanupEnabled: false,
            message: 'Der Status der Testdaten-Bereinigung ist derzeit nicht erreichbar.',
          })
        }
      }
    }

    async function loadTestRuns() {
      try {
        const response = await fetch('/api/test-runs', { cache: 'no-store' })
        if (!response.ok) throw new Error('Testläufe konnten nicht geladen werden.')
        const data = await response.json() as TestRunsResponse
        if (active) {
          setTestRuns(data)
          setRunsError(null)
        }
      } catch {
        if (active) setRunsError('Testläufe konnten derzeit nicht geladen werden.')
      } finally {
        if (active) setRunsLoading(false)
      }
    }

    async function loadTestCaseControl() {
      try {
        const response = await fetch('/api/test-cases', { cache: 'no-store' })
        if (!response.ok) throw new Error('Testfallsteuerung konnte nicht geladen werden.')
        const data = await response.json() as TestCaseControlResponse
        if (active) {
          setTestCaseControl(data)
          setControlError(null)
        }
      } catch {
        if (active) setControlError('Testfallsteuerung konnte derzeit nicht geladen werden.')
      } finally {
        if (active) setControlLoading(false)
      }
    }

    loadEnvironmentStatus()
    loadTestRuns()
    loadTestCaseControl()
    return () => { active = false }
  }, [])

  const filteredCases = useMemo(() => {
    const query = search.trim().toLowerCase()
    return TEST_CASES.filter((testCase) => {
      const searchableText = `${testCase.id} ${testCase.name} ${testCase.description} ${testCase.steps.join(' ')} ${testCase.area}`
      const matchesSearch = !query || searchableText.toLowerCase().includes(query)
      const matchesPriority = priority === 'Alle' || testCase.priority === priority
      return matchesSearch && matchesPriority
    })
  }, [priority, search])

  const executionsByCase = useMemo(() => new Map(
    TEST_CASES.map((testCase) => [testCase.id, getTestCaseExecutions(testCase, testRuns.runs)])
  ), [testRuns.runs])

  const controlByCase = useMemo(() => new Map(
    testCaseControl.cases.map((testCase) => [testCase.id, testCase])
  ), [testCaseControl.cases])

  const executableCaseCount = testCaseControl.cases.filter((testCase) => testCase.executable).length
  const enabledCaseCount = testCaseControl.cases.filter((testCase) => testCase.executable && testCase.enabled).length

  async function unlockTestCaseControl(event: React.FormEvent) {
    event.preventDefault()
    setControlError(null)

    try {
      const response = await fetch('/api/test-cases', {
        method: 'POST',
        headers: { 'x-test-control-token': controlToken },
      })
      const data = await response.json() as { success?: boolean; error?: string }
      if (!response.ok || !data.success) throw new Error(data.error || 'Steuerung konnte nicht entsperrt werden.')

      setControlUnlocked(true)
      setShowControlLogin(false)
      setControlError(null)
    } catch (error) {
      setControlUnlocked(false)
      setControlError(error instanceof Error ? error.message : 'Steuerung konnte nicht entsperrt werden.')
    }
  }

  async function setTestCaseEnabled(caseId: string, enabled: boolean) {
    if (!controlUnlocked || !testCaseControl.configured || controlSavingId) return
    setControlSavingId(caseId)
    setControlError(null)

    try {
      const response = await fetch('/api/test-cases', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-test-control-token': controlToken,
        },
        body: JSON.stringify({ caseId, enabled }),
      })
      const data = await response.json() as { success?: boolean; cases?: TestCaseControlItem[]; error?: string }
      if (!response.ok || !data.success || !data.cases) throw new Error(data.error || 'Testfall konnte nicht geändert werden.')

      setTestCaseControl((current) => ({ ...current, cases: data.cases ?? current.cases }))
    } catch (error) {
      setControlError(error instanceof Error ? error.message : 'Testfall konnte nicht geändert werden.')
    } finally {
      setControlSavingId(null)
    }
  }

  function toggleTestCase(testCaseId: string) {
    setExpandedCaseIds((current) => {
      const next = new Set(current)
      if (next.has(testCaseId)) next.delete(testCaseId)
      else next.add(testCaseId)
      return next
    })
  }

  const tabs: Array<{ id: DashboardTab; label: string; count?: number }> = [
    { id: 'testfaelle', label: 'Testfälle', count: TEST_CASES.length },
    { id: 'durchfuehrungen', label: 'Durchführungen', count: testRuns.summary.totalRuns },
    { id: 'umgebung', label: 'Testbetrieb' },
  ]

  return (
    <div className="min-h-full bg-[#F7F7F5]">
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full bg-[#FFC300]/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#705600]">
                Qualitätssicherung
              </span>
              <span className="rounded-full bg-gray-200/70 px-2.5 py-1 text-[11px] font-semibold text-gray-600">
                Aufbauphase
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#1A1A1A] sm:text-3xl">Testdashboard</h1>
            <p className="mt-1 text-sm text-gray-500">Regressionstests planen, ausführen und nachvollziehen.</p>
          </div>
          <div className={`flex items-center gap-2 self-start rounded-lg border bg-white px-3 py-2 text-xs shadow-sm ${environmentStatus?.ready ? 'border-emerald-200 text-emerald-700' : 'border-gray-200 text-gray-500'}`}>
            <span className={`h-2 w-2 rounded-full ${environmentStatus?.ready ? 'bg-emerald-500' : 'bg-gray-300'}`} />
            {environmentStatus?.ready ? 'Testdaten-Bereinigung bereit' : 'Playwright noch nicht verbunden'}
          </div>
        </header>

        <section className="mt-7 grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Test-Kennzahlen">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between text-gray-400">
              <p className="text-xs font-semibold uppercase tracking-wide">Testfälle</p>
              <StatusIcon type="planned" />
            </div>
            <p className="mt-3 text-2xl font-bold text-gray-900">{TEST_CASES.length}</p>
            <p className="mt-1 text-xs text-gray-500">für den ersten Testlauf geplant</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between text-gray-400">
              <p className="text-xs font-semibold uppercase tracking-wide">Testläufe</p>
              <StatusIcon type="waiting" />
            </div>
            <p className="mt-3 text-2xl font-bold text-gray-900">{testRuns.summary.totalRuns}</p>
            <p className="mt-1 text-xs text-gray-500">dauerhaft protokolliert</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between text-gray-400">
              <p className="text-xs font-semibold uppercase tracking-wide">Erfolgsquote</p>
              <StatusIcon type="empty" />
            </div>
            <p className={`mt-3 text-2xl font-bold ${testRuns.summary.successRate === null ? 'text-gray-400' : 'text-gray-900'}`}>
              {testRuns.summary.successRate === null ? '—' : `${testRuns.summary.successRate} %`}
            </p>
            <p className="mt-1 text-xs text-gray-500">über alle Testläufe</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between text-gray-400">
              <p className="text-xs font-semibold uppercase tracking-wide">Testbetrieb</p>
              <StatusIcon type="environment" />
            </div>
            <p className={`mt-3 text-lg font-bold ${environmentStatus?.ready ? 'text-emerald-700' : 'text-gray-900'}`}>
              {environmentStatus?.ready ? 'Einsatzbereit' : environmentStatus?.configured ? 'Guard ausstehend' : 'Nicht verbunden'}
            </p>
            <p className="mt-1 text-xs text-gray-500">{environmentStatus?.message ?? 'Status wird geprüft …'}</p>
          </div>
        </section>

        <section className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-4 sm:px-6">
            <div className="flex gap-6 overflow-x-auto" role="tablist" aria-label="Testdashboard Bereiche">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  data-testid={`testdashboard-tab-${tab.id}`}
                  aria-selected={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex shrink-0 items-center gap-2 py-4 text-sm font-semibold transition-colors ${
                    activeTab === tab.id ? 'text-gray-950' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {tab.label}
                  {tab.count !== undefined && (
                    <span className={`rounded-full px-2 py-0.5 text-[11px] ${activeTab === tab.id ? 'bg-[#FFC300]/20 text-[#705600]' : 'bg-gray-100 text-gray-500'}`}>
                      {tab.count}
                    </span>
                  )}
                  {activeTab === tab.id && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[#FFC300]" />}
                </button>
              ))}
            </div>
          </div>

          {activeTab === 'testfaelle' && (
            <div>
              <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="relative w-full sm:max-w-sm">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                  </svg>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Testfälle durchsuchen …"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-900 outline-none transition focus:border-[#FFC300] focus:bg-white focus:ring-2 focus:ring-[#FFC300]/20"
                  />
                </div>
                <select
                  value={priority}
                  onChange={(event) => setPriority(event.target.value as 'Alle' | TestPriority)}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 outline-none focus:border-[#FFC300] focus:ring-2 focus:ring-[#FFC300]/20"
                  aria-label="Nach Priorität filtern"
                >
                  <option value="Alle">Alle Prioritäten</option>
                  <option value="Kritisch">Kritisch</option>
                  <option value="Hoch">Hoch</option>
                  <option value="Mittel">Mittel</option>
                </select>
              </div>

              <div className={`border-b px-4 py-4 sm:px-6 ${testCaseControl.configured ? 'border-gray-100 bg-gray-50/60' : 'border-amber-200 bg-amber-50'}`}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-semibold text-gray-900">Ausführung steuern</h2>
                      {!controlLoading && testCaseControl.configured && (
                        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-600 ring-1 ring-inset ring-gray-200">
                          {enabledCaseCount} von {executableCaseCount} aktiv
                        </span>
                      )}
                      {controlUnlocked && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">Entsperrt</span>}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-gray-500">
                      Deaktivierte automatisierte Testfälle werden im nächsten GitHub-Actions-Lauf als übersprungen protokolliert.
                    </p>
                  </div>

                  {testCaseControl.configured && !controlUnlocked && !showControlLogin && (
                    <button
                      type="button"
                      data-testid="test-control-unlock"
                      onClick={() => setShowControlLogin(true)}
                      className="self-start rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 lg:self-auto"
                    >
                      Steuerung entsperren
                    </button>
                  )}

                  {testCaseControl.configured && !controlUnlocked && showControlLogin && (
                    <form onSubmit={unlockTestCaseControl} className="flex w-full max-w-md flex-col gap-2 sm:flex-row">
                      <label className="sr-only" htmlFor="test-control-token">Teststeuerungs-Token</label>
                      <input
                        id="test-control-token"
                        type="password"
                        autoComplete="off"
                        value={controlToken}
                        onChange={(event) => setControlToken(event.target.value)}
                        placeholder="Teststeuerungs-Token"
                        className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#FFC300] focus:ring-2 focus:ring-[#FFC300]/20"
                      />
                      <button type="submit" className="rounded-lg bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-gray-800">Entsperren</button>
                    </form>
                  )}
                </div>

                {!controlLoading && !testCaseControl.configured && (
                  <p className="mt-2 text-xs font-medium text-amber-800">{testCaseControl.message}</p>
                )}
                {controlError && <p role="alert" className="mt-2 text-xs font-medium text-red-700">{controlError}</p>}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[1280px] text-left text-sm">
                  <thead className="bg-gray-50/70 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-6 py-3">ID</th>
                      <th className="px-6 py-3">Testfall</th>
                      <th className="px-6 py-3">Bereich</th>
                      <th className="px-6 py-3">Priorität</th>
                      <th className="px-6 py-3">Automatisierung</th>
                      <th className="px-6 py-3">Ausführung</th>
                      <th className="px-6 py-3">Durchführungen</th>
                      <th className="px-6 py-3 text-right">Testschritte</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredCases.map((testCase) => {
                      const isExpanded = expandedCaseIds.has(testCase.id)
                      const executions = executionsByCase.get(testCase.id) ?? []
                      const latestExecution = executions[0]
                      const detailsId = `test-case-details-${testCase.id}`
                      const control = controlByCase.get(testCase.id)

                      return (
                        <Fragment key={testCase.id}>
                          <tr data-testid={`testcase-${testCase.id}-row`} className="align-top transition-colors hover:bg-gray-50/70">
                            <td className="whitespace-nowrap px-6 py-4 font-mono text-xs text-gray-500">{testCase.id}</td>
                            <td className="max-w-md px-6 py-4">
                              <p className="font-semibold text-gray-900">{testCase.name}</p>
                              <p className="mt-1 text-xs leading-5 text-gray-500">{testCase.description}</p>
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-gray-600">{testCase.area}</td>
                            <td className="px-6 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${PRIORITY_STYLES[testCase.priority]}`}>{testCase.priority}</span></td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${testCase.state === 'Bereit' ? 'text-emerald-700' : 'text-gray-500'}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${testCase.state === 'Bereit' ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                                {testCase.state} · {testCase.kind}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              {controlLoading || !control ? (
                                <span className="text-xs text-gray-400">Wird geladen …</span>
                              ) : control.executable ? (
                                <button
                                  type="button"
                                  role="switch"
                                  data-testid={`testcase-${testCase.id}-enabled`}
                                  aria-checked={control.enabled}
                                  aria-label={`${testCase.id} für Testläufe ${control.enabled ? 'deaktivieren' : 'aktivieren'}`}
                                  disabled={!testCaseControl.configured || !controlUnlocked || controlSavingId !== null}
                                  onClick={() => setTestCaseEnabled(testCase.id, !control.enabled)}
                                  className="group inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  <span className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${control.enabled ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${control.enabled ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                                  </span>
                                  <span className={`text-xs font-semibold ${control.enabled ? 'text-emerald-700' : 'text-gray-500'}`}>
                                    {controlSavingId === testCase.id ? 'Speichert …' : control.enabled ? 'Aktiv' : 'Deaktiviert'}
                                  </span>
                                </button>
                              ) : (
                                <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">Noch nicht automatisiert</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              {latestExecution ? (
                                <div className="min-w-[150px]">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-gray-900">{executions.length} {executions.length === 1 ? 'Lauf' : 'Läufe'}</span>
                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${RUN_STATUS_STYLES[latestExecution.status]}`}>
                                      {RUN_STATUS_LABELS[latestExecution.status]}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-[11px] text-gray-500">Zuletzt {formatDate(latestExecution.run.completedAt)}</p>
                                </div>
                              ) : (
                                <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">Noch nie durchgeführt</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                type="button"
                                data-testid={`testcase-${testCase.id}-toggle`}
                                aria-expanded={isExpanded}
                                aria-controls={detailsId}
                                onClick={() => toggleTestCase(testCase.id)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
                              >
                                {isExpanded ? 'Schließen' : `${testCase.steps.length} Schritte`}
                                <svg className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                  <path d="m6 9 6 6 6-6" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan={8} className="bg-gray-50/80 px-6 py-5">
                                <div id={detailsId} className="grid gap-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm lg:grid-cols-[1fr_360px]">
                                  <div>
                                    <h3 className="text-sm font-semibold text-gray-900">Testschritte</h3>
                                    <ol className="mt-4 space-y-3">
                                      {testCase.steps.map((step, index) => (
                                        <li key={step} className="flex gap-3 text-sm leading-6 text-gray-600">
                                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FFC300]/20 text-xs font-bold text-[#705600]">{index + 1}</span>
                                          <span>{step}</span>
                                        </li>
                                      ))}
                                    </ol>
                                  </div>
                                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                                    <h3 className="text-sm font-semibold text-gray-900">Bisherige Durchführungen</h3>
                                    {executions.length > 0 ? (
                                      <ul data-testid="testcase-execution-history" className="mt-3 space-y-2">
                                        {executions.slice(0, 5).map((execution) => (
                                          <li key={execution.run.id} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-xs">
                                            <div className="min-w-0">
                                              {execution.run.sourceUrl ? (
                                                <a href={execution.run.sourceUrl} target="_blank" rel="noreferrer" className="font-mono font-semibold text-blue-700 hover:underline">{execution.run.runId}</a>
                                              ) : <span className="font-mono font-semibold text-gray-700">{execution.run.runId}</span>}
                                              <p className="mt-0.5 text-[11px] text-gray-400">{formatDate(execution.run.completedAt)}</p>
                                            </div>
                                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${RUN_STATUS_STYLES[execution.status]}`}>
                                              {RUN_STATUS_LABELS[execution.status]}
                                            </span>
                                          </li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <p className="mt-3 text-xs leading-5 text-gray-500">Für diesen Testfall wurde noch keine automatische Durchführung gespeichert.</p>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                    {filteredCases.length === 0 && (
                      <tr><td colSpan={8} className="px-6 py-12 text-center text-sm text-gray-500">Keine passenden Testfälle gefunden.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-gray-100 px-6 py-3 text-xs text-gray-500">
                {filteredCases.length} von {TEST_CASES.length} Testfällen
              </div>
            </div>
          )}

          {activeTab === 'durchfuehrungen' && <RunsView runs={testRuns.runs} loading={runsLoading} error={runsError} />}

          {activeTab === 'umgebung' && (
            <div className="p-4 sm:p-6">
              <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Ablauf eines Live-sicheren Testlaufs</h2>
                  <p className="mt-1 text-sm leading-6 text-gray-500">Reguläre Live-Daten bleiben unangetastet. Nur eindeutig markierte Testdaten werden vor dem nächsten Lauf entfernt.</p>
                  <ol className="mt-5 grid gap-3 sm:grid-cols-2">
                    {[
                      { step: '01', title: 'Testdaten bereinigen', text: 'Ausschließlich technisch markierte Daten früherer Testläufe entfernen.' },
                      { step: '02', title: 'Testdaten anlegen', text: 'Sichtbar gekennzeichnete Kontakte mit Lauf-ID erzeugen.' },
                      { step: '03', title: 'Tests ausführen', text: 'Playwright-Szenarien kontrolliert in der Live-Anwendung starten.' },
                      { step: '04', title: 'Zustand einfrieren', text: 'Daten, Screenshots und Traces zur Fehleranalyse erhalten.' },
                    ].map((item) => (
                      <li key={item.step} className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FFC300] text-xs font-bold text-[#1A1A1A]">{item.step}</span>
                          <h3 className="text-sm font-semibold text-gray-900">{item.title}</h3>
                        </div>
                        <p className="mt-3 text-xs leading-5 text-gray-500">{item.text}</p>
                      </li>
                    ))}
                  </ol>
                </div>
                <aside className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                  <div className="flex items-center gap-2 text-amber-800">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 9v4m0 4h.01" /><path d="M10.3 3.7 2.4 17.4A2 2 0 0 0 4.1 20h15.8a2 2 0 0 0 1.7-2.6L13.7 3.7a2 2 0 0 0-3.4 0Z" /></svg>
                    <h3 className="text-sm font-semibold">Sicherheitsregel</h3>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-amber-900/70">
                    Die Bereinigung verwendet niemals TRUNCATE. Gelöscht werden ausschließlich Kontakte mit technischem Marker, gültiger Lauf-ID und den sichtbaren Kennzeichen <strong>[TEST]</strong>, <strong>[TESTDATEN]</strong> und <strong>example.invalid</strong>.
                  </p>
                  <dl className="mt-5 space-y-3 border-t border-amber-200 pt-4 text-xs">
                    <div className="flex justify-between gap-3"><dt className="text-amber-900/60">Datenbank</dt><dd className="font-semibold text-amber-900">Live</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-amber-900/60">Bereinigungs-Guard</dt><dd className="font-semibold text-amber-900">{environmentStatus?.cleanupEnabled ? 'Aktiv' : 'Gesperrt'}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-amber-900/60">Aufbewahrung</dt><dd className="font-semibold text-amber-900">Bis zum nächsten Lauf</dd></div>
                    {environmentStatus?.lastRunId && (
                      <div className="flex justify-between gap-3"><dt className="text-amber-900/60">Letzter Lauf</dt><dd className="max-w-[170px] truncate font-mono font-semibold text-amber-900" title={environmentStatus.lastRunId}>{environmentStatus.lastRunId}</dd></div>
                    )}
                  </dl>
                </aside>
              </div>
            </div>
          )}
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_340px]">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Letzte Testaktivität</h2>
                <p className="mt-1 text-xs text-gray-500">Änderungen und Durchführungen werden hier chronologisch protokolliert.</p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${testRuns.runs[0]?.status === 'passed' ? 'bg-emerald-50 text-emerald-700' : testRuns.runs[0] ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                {testRuns.runs[0] ? RUN_STATUS_LABELS[testRuns.runs[0].status] : 'Keine Aktivität'}
              </span>
            </div>
            {testRuns.runs[0] ? (
              <div className="mt-5 flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-mono text-xs font-semibold text-gray-700">{testRuns.runs[0].runId}</p>
                  <p className="mt-1 text-xs text-gray-500">{formatDate(testRuns.runs[0].completedAt)} · Commit {testRuns.runs[0].commitSha?.slice(0, 7) ?? '—'}</p>
                </div>
                <p className="text-xs text-gray-600">{testRuns.runs[0].passedCount} von {testRuns.runs[0].totalCount} Tests erfolgreich</p>
              </div>
            ) : (
              <div className="mt-5 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-xs text-gray-500">
                Die Aktivitätshistorie startet mit der nächsten Playwright-Durchführung.
              </div>
            )}
          </div>
          <div className="rounded-xl bg-[#1A1A1A] p-5 text-white shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Nächster Schritt</h2>
              <span className="rounded bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/60">Betrieb</span>
            </div>
            <p className="mt-3 text-sm font-medium">{testRuns.summary.totalRuns > 0 ? 'Testkatalog erweitern' : environmentStatus?.ready ? 'Ergebnisübertragung aktivieren' : 'Testdaten-Guard aktivieren'}</p>
            <p className="mt-1 text-xs leading-5 text-white/55">
              {testRuns.summary.totalRuns > 0
                ? 'Der technische Testbetrieb ist vollständig verbunden. Neue Features erhalten ab jetzt gezielte Regressionstests.'
                : environmentStatus?.ready
                ? 'Marker und Bereinigungs-Guard sind bereit. Der nächste Lauf überträgt sein Ergebnis automatisch.'
                : 'Migration in Supabase ausführen, Guard freigeben und technischen Testbenutzer anlegen.'}
            </p>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full bg-[#FFC300] ${testRuns.summary.totalRuns > 0 ? 'w-full' : environmentStatus?.ready ? 'w-4/5' : 'w-2/5'}`} /></div>
            <p className="mt-2 text-[11px] text-white/40">{testRuns.summary.totalRuns > 0 ? '5 von 5 Einrichtungsschritten abgeschlossen' : environmentStatus?.ready ? '4 von 5 Einrichtungsschritten abgeschlossen' : '2 von 5 Einrichtungsschritten vorbereitet'}</p>
          </div>
        </section>
      </div>
    </div>
  )
}
