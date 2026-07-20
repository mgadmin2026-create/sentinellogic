import { test } from '@playwright/test'

export function isTestCaseDisabled(testCaseId: string): boolean {
  const disabledIds = (process.env.PLAYWRIGHT_DISABLED_TEST_CASES ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)

  return disabledIds.includes(testCaseId)
}

/** Überspringt alle Tests im aktuellen describe-Block, wenn der Testfall deaktiviert wurde. */
export function applyTestCaseControl(testCaseId: string) {
  test.skip(isTestCaseDisabled(testCaseId), `${testCaseId} wurde im Testdashboard deaktiviert.`)
}
