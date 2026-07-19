'use client'

import { useEffect, useMemo, useState } from 'react'

type DashboardTab = 'testfaelle' | 'durchfuehrungen' | 'umgebung'
type TestPriority = 'Kritisch' | 'Hoch' | 'Mittel'
type TestState = 'Geplant' | 'Bereit'

interface TestCase {
  id: string
  name: string
  area: string
  priority: TestPriority
  state: TestState
  kind: string
}

interface TestEnvironmentStatus {
  configured: boolean
  ready: boolean
  cleanupEnabled: boolean
  lastResetAt?: string | null
  lastRunId?: string | null
  message: string
}

const TEST_CASES: TestCase[] = [
  { id: 'E2E-001', name: 'Anmeldung und Dashboard-Aufruf', area: 'Authentifizierung', priority: 'Kritisch', state: 'Geplant', kind: 'E2E' },
  { id: 'E2E-002', name: 'Lead anlegen und wiederfinden', area: 'Kontakte', priority: 'Kritisch', state: 'Geplant', kind: 'E2E' },
  { id: 'E2E-003', name: 'Lead bearbeiten und Status ändern', area: 'Kontakte', priority: 'Kritisch', state: 'Geplant', kind: 'E2E' },
  { id: 'E2E-004', name: 'Geschützte Seite ohne Anmeldung blockieren', area: 'Berechtigungen', priority: 'Hoch', state: 'Geplant', kind: 'E2E' },
  { id: 'E2E-005', name: 'Fehlerfall einer Integration behandeln', area: 'Integrationen', priority: 'Hoch', state: 'Geplant', kind: 'E2E' },
]

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

export default function TestdashboardPage() {
  const [activeTab, setActiveTab] = useState<DashboardTab>('testfaelle')
  const [search, setSearch] = useState('')
  const [priority, setPriority] = useState<'Alle' | TestPriority>('Alle')
  const [environmentStatus, setEnvironmentStatus] = useState<TestEnvironmentStatus | null>(null)

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

    loadEnvironmentStatus()
    return () => { active = false }
  }, [])

  const filteredCases = useMemo(() => {
    const query = search.trim().toLowerCase()
    return TEST_CASES.filter((testCase) => {
      const matchesSearch = !query || `${testCase.id} ${testCase.name} ${testCase.area}`.toLowerCase().includes(query)
      const matchesPriority = priority === 'Alle' || testCase.priority === priority
      return matchesSearch && matchesPriority
    })
  }, [priority, search])

  const tabs: Array<{ id: DashboardTab; label: string; count?: number }> = [
    { id: 'testfaelle', label: 'Testfälle', count: TEST_CASES.length },
    { id: 'durchfuehrungen', label: 'Durchführungen', count: 0 },
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
            <p className="mt-3 text-2xl font-bold text-gray-900">0</p>
            <p className="mt-1 text-xs text-gray-500">noch keine Durchführung</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between text-gray-400">
              <p className="text-xs font-semibold uppercase tracking-wide">Erfolgsquote</p>
              <StatusIcon type="empty" />
            </div>
            <p className="mt-3 text-2xl font-bold text-gray-400">—</p>
            <p className="mt-1 text-xs text-gray-500">nach erstem Lauf verfügbar</p>
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

              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-gray-50/70 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-6 py-3">ID</th>
                      <th className="px-6 py-3">Testfall</th>
                      <th className="px-6 py-3">Bereich</th>
                      <th className="px-6 py-3">Typ</th>
                      <th className="px-6 py-3">Priorität</th>
                      <th className="px-6 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredCases.map((testCase) => (
                      <tr key={testCase.id} className="transition-colors hover:bg-gray-50/70">
                        <td className="whitespace-nowrap px-6 py-4 font-mono text-xs text-gray-500">{testCase.id}</td>
                        <td className="px-6 py-4 font-semibold text-gray-900">{testCase.name}</td>
                        <td className="whitespace-nowrap px-6 py-4 text-gray-600">{testCase.area}</td>
                        <td className="px-6 py-4"><span className="rounded bg-gray-100 px-2 py-1 font-mono text-[11px] font-semibold text-gray-600">{testCase.kind}</span></td>
                        <td className="px-6 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${PRIORITY_STYLES[testCase.priority]}`}>{testCase.priority}</span></td>
                        <td className="px-6 py-4"><span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500"><span className="h-1.5 w-1.5 rounded-full bg-gray-300" />{testCase.state}</span></td>
                      </tr>
                    ))}
                    {filteredCases.length === 0 && (
                      <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500">Keine passenden Testfälle gefunden.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-gray-100 px-6 py-3 text-xs text-gray-500">
                {filteredCases.length} von {TEST_CASES.length} Testfällen
              </div>
            </div>
          )}

          {activeTab === 'durchfuehrungen' && <EmptyRuns />}

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
              <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-500">Keine Aktivität</span>
            </div>
            <div className="mt-5 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-xs text-gray-500">
              Die Aktivitätshistorie startet mit der Playwright-Anbindung.
            </div>
          </div>
          <div className="rounded-xl bg-[#1A1A1A] p-5 text-white shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Nächster Schritt</h2>
              <span className="rounded bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/60">Setup</span>
            </div>
            <p className="mt-3 text-sm font-medium">{environmentStatus?.ready ? 'Playwright anbinden' : 'Testdaten-Guard aktivieren'}</p>
            <p className="mt-1 text-xs leading-5 text-white/55">
              {environmentStatus?.ready
                ? 'Marker und Bereinigungs-Guard sind bereit. Als Nächstes folgt der erste automatisierte Testlauf.'
                : 'Migration in Supabase ausführen, Guard freigeben und technischen Testbenutzer anlegen.'}
            </p>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full bg-[#FFC300] ${environmentStatus?.ready ? 'w-3/5' : 'w-2/5'}`} /></div>
            <p className="mt-2 text-[11px] text-white/40">{environmentStatus?.ready ? '3 von 5 Einrichtungsschritten abgeschlossen' : '2 von 5 Einrichtungsschritten vorbereitet'}</p>
          </div>
        </section>
      </div>
    </div>
  )
}
