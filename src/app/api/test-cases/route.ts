import { NextRequest, NextResponse } from 'next/server'
import { TEST_CASES } from '@/data/test-cases'
import { createServerClient } from '@/lib/supabase/server'
import { getTestEnvironmentConfiguration, isValidCleanupToken } from '@/lib/test-environment'

export const dynamic = 'force-dynamic'

interface TestCaseControlRow {
  disabled_test_cases: string[] | null
}

function buildCases(disabledIds: string[]) {
  const disabled = new Set(disabledIds)
  return TEST_CASES.map((testCase) => {
    const executable = testCase.state === 'Bereit' && testCase.resultTitles.length > 0
    return {
      id: testCase.id,
      executable,
      enabled: executable && !disabled.has(testCase.id),
    }
  })
}

async function loadDisabledTestCases(): Promise<{ disabledIds: string[]; configured: boolean }> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('test_data_guard')
    .select('disabled_test_cases')
    .eq('singleton', true)
    .single()

  if (error || !data) {
    return { disabledIds: [], configured: false }
  }

  const row = data as TestCaseControlRow
  return {
    disabledIds: Array.isArray(row.disabled_test_cases) ? row.disabled_test_cases : [],
    configured: true,
  }
}

function authorize(request: NextRequest): NextResponse | null {
  const configuration = getTestEnvironmentConfiguration()
  if (!configuration.ready || !configuration.config) {
    return NextResponse.json({ success: false, error: 'Testbetrieb ist nicht freigegeben.' }, { status: 403 })
  }

  if (!isValidCleanupToken(request.headers.get('x-test-control-token'), configuration.config.cleanupToken)) {
    return NextResponse.json({ success: false, error: 'Teststeuerungs-Token ist ungültig.' }, { status: 401 })
  }

  return null
}

/** Liefert nur IDs und Schaltzustände, niemals das Steuerungs-Token. */
export async function GET() {
  try {
    const { disabledIds, configured } = await loadDisabledTestCases()
    return NextResponse.json({
      configured,
      cases: buildCases(disabledIds),
      message: configured
        ? 'Testfallsteuerung ist bereit.'
        : 'Die Datenbankmigration für die Testfallsteuerung wurde noch nicht angewendet.',
    })
  } catch {
    console.error('[Testfallsteuerung] Schaltzustände konnten nicht geladen werden')
    return NextResponse.json({ error: 'Testfallsteuerung konnte nicht geladen werden.' }, { status: 500 })
  }
}

/** Prüft das Token, ohne eine Einstellung zu verändern. */
export async function POST(request: NextRequest) {
  const unauthorized = authorize(request)
  if (unauthorized) return unauthorized

  const { configured } = await loadDisabledTestCases()
  if (!configured) {
    return NextResponse.json({ success: false, error: 'Testfallsteuerung ist noch nicht eingerichtet.' }, { status: 503 })
  }

  return NextResponse.json({ success: true })
}

/** Aktiviert oder deaktiviert einen bereits automatisierten Testfall. */
export async function PATCH(request: NextRequest) {
  const unauthorized = authorize(request)
  if (unauthorized) return unauthorized

  try {
    const body = await request.json() as { caseId?: unknown; enabled?: unknown }
    const caseId = typeof body.caseId === 'string' ? body.caseId : ''
    const testCase = TEST_CASES.find((item) => item.id === caseId)
    const executable = testCase?.state === 'Bereit' && Boolean(testCase.resultTitles.length)

    if (!testCase || !executable || typeof body.enabled !== 'boolean') {
      return NextResponse.json({ success: false, error: 'Testfall ist ungültig oder noch nicht automatisiert.' }, { status: 400 })
    }

    const current = await loadDisabledTestCases()
    if (!current.configured) {
      return NextResponse.json({ success: false, error: 'Testfallsteuerung ist noch nicht eingerichtet.' }, { status: 503 })
    }

    const disabled = new Set(current.disabledIds)
    if (body.enabled) disabled.delete(caseId)
    else disabled.add(caseId)

    const validExecutableIds = new Set(TEST_CASES
      .filter((item) => item.state === 'Bereit' && item.resultTitles.length > 0)
      .map((item) => item.id))
    const disabledIds = Array.from(disabled).filter((id) => validExecutableIds.has(id)).sort()

    const supabase = createServerClient()
    const { error } = await supabase
      .from('test_data_guard')
      .update({ disabled_test_cases: disabledIds, updated_at: new Date().toISOString() })
      .eq('singleton', true)

    if (error) {
      console.error('[Testfallsteuerung] Schaltzustand konnte nicht gespeichert werden')
      return NextResponse.json({ success: false, error: 'Schaltzustand konnte nicht gespeichert werden.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, cases: buildCases(disabledIds) })
  } catch {
    console.error('[Testfallsteuerung] Schaltzustand konnte nicht verarbeitet werden')
    return NextResponse.json({ success: false, error: 'Schaltzustand konnte nicht verarbeitet werden.' }, { status: 500 })
  }
}
