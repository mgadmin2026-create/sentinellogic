import { appendFile } from 'node:fs/promises'

interface TestCaseControlResponse {
  configured?: boolean
  cases?: Array<{ id?: string; executable?: boolean; enabled?: boolean }>
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} fehlt.`)
  return value
}

async function main() {
  const baseUrl = new URL(requiredEnvironment('PLAYWRIGHT_BASE_URL')).origin
  const githubEnv = requiredEnvironment('GITHUB_ENV')
  const response = await fetch(`${baseUrl}/api/test-cases`, { cache: 'no-store' })

  if (!response.ok) {
    throw new Error(`Testfallsteuerung ist nicht erreichbar (HTTP ${response.status}).`)
  }

  const payload = await response.json() as TestCaseControlResponse
  if (!payload.configured || !Array.isArray(payload.cases)) {
    throw new Error('Testfallsteuerung ist noch nicht vollständig eingerichtet.')
  }

  const disabledIds = payload.cases
    .filter((testCase) => testCase.executable === true && testCase.enabled === false)
    .map((testCase) => String(testCase.id ?? ''))
    .filter((id) => /^E2E-\d{3}$/.test(id))

  await appendFile(githubEnv, `PLAYWRIGHT_DISABLED_TEST_CASES=${disabledIds.join(',')}\n`, 'utf8')
  console.log(`[Testfallsteuerung] ${disabledIds.length} Testfall/Testfälle werden übersprungen.`)
}

main().catch((error: unknown) => {
  console.error('[Testfallsteuerung] Laden fehlgeschlagen:', error instanceof Error ? error.message : 'Unbekannter Fehler')
  process.exitCode = 1
})
