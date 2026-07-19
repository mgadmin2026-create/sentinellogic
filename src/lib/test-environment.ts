import { timingSafeEqual } from 'crypto'

export interface TestEnvironmentConfig {
  guardId: string
  projectRef: string
  cleanupToken: string
}

export interface TestEnvironmentConfiguration {
  ready: boolean
  issues: string[]
  config?: TestEnvironmentConfig
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/

/**
 * Liest die Bereinigungskonfiguration und prüft alle serverseitigen Schutzschalter.
 * Eine einzelne falsch gesetzte Variable reicht dadurch nicht zum Löschen von Testdaten aus.
 */
export function getTestEnvironmentConfiguration(): TestEnvironmentConfiguration {
  const issues: string[] = []
  const cleanupEnabled = process.env.TEST_DATA_CLEANUP_ENABLED
  const guardId = process.env.TEST_DATA_GUARD_ID ?? ''
  const projectRef = process.env.TEST_SUPABASE_PROJECT_REF ?? ''
  const cleanupToken = process.env.TEST_DATA_CLEANUP_TOKEN ?? ''
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

  if (cleanupEnabled !== 'true') {
    issues.push('Die Testdaten-Bereinigung ist serverseitig nicht freigegeben.')
  }

  if (!UUID_PATTERN.test(guardId)) {
    issues.push('Die Guard-Kennung für Testdaten fehlt oder ist ungültig.')
  }

  if (!PROJECT_REF_PATTERN.test(projectRef)) {
    issues.push('Die Supabase-Projektreferenz der Live-Datenbank fehlt oder ist ungültig.')
  }

  if (cleanupToken.length < 32) {
    issues.push('Das Bereinigungs-Token fehlt oder ist zu kurz.')
  }

  try {
    const hostname = new URL(supabaseUrl).hostname
    if (hostname !== `${projectRef}.supabase.co`) {
      issues.push('Die aktive Supabase-URL gehört nicht zum freigegebenen Testprojekt.')
    }
  } catch {
    issues.push('Die aktive Supabase-URL ist ungültig.')
  }

  if (issues.length > 0) {
    return { ready: false, issues }
  }

  return {
    ready: true,
    issues: [],
    config: { guardId, projectRef, cleanupToken },
  }
}

/** Vergleicht das Bereinigungs-Token ohne zeitabhängige String-Vergleiche. */
export function isValidCleanupToken(receivedToken: string | null, expectedToken: string): boolean {
  if (!receivedToken) return false

  const received = Buffer.from(receivedToken)
  const expected = Buffer.from(expectedToken)

  if (received.length !== expected.length) return false
  return timingSafeEqual(received, expected)
}

/** Verhindert, dass frei formatierte Lauf-IDs in Protokolle oder SQL gelangen. */
export function isValidTestRunId(runId: string | null): runId is string {
  return Boolean(runId && /^[a-zA-Z0-9._:-]{1,100}$/.test(runId))
}
