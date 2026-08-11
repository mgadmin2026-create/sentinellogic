import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import {
  getTestEnvironmentConfiguration,
  isValidCleanupToken,
  isValidTestRunId,
} from '@/lib/test-environment'

export const dynamic = 'force-dynamic'

interface DatabaseGuardStatus {
  ready: boolean
  reset_allowed: boolean
  last_reset_at: string | null
  last_run_id: string | null
}

/**
 * Entfernt polymorphe Kommentare markierter Testkontakte vor dem eigentlichen
 * Kontakt-Cascade. Kommentare besitzen bewusst keinen Foreign Key auf Kontakte
 * oder Aufgaben; ihre Dokument-Anhänge würden sonst das Löschen blockieren.
 */
async function cleanupTestCommentDependencies(supabase: ReturnType<typeof createServerClient>) {
  const { data: testContacts, error: contactError } = await supabase
    .from('contacts')
    .select('id')
    .eq('is_test_data', true)
    .not('test_run_id', 'is', null)

  if (contactError) throw contactError
  const contactIds = (testContacts ?? []).map((contact) => contact.id)
  if (contactIds.length === 0) return

  const { data: testTasks, error: taskError } = await supabase
    .from('tasks')
    .select('id')
    .in('contact_id', contactIds)

  if (taskError) throw taskError
  const taskIds = (testTasks ?? []).map((task) => task.id)

  const commentIds = new Set<string>()
  const { data: contactComments, error: contactCommentError } = await supabase
    .from('comments')
    .select('id')
    .eq('entity_type', 'contact')
    .in('entity_id', contactIds)

  if (contactCommentError) throw contactCommentError
  for (const comment of contactComments ?? []) commentIds.add(comment.id)

  if (taskIds.length > 0) {
    const { data: taskComments, error: taskCommentError } = await supabase
      .from('comments')
      .select('id')
      .eq('entity_type', 'task')
      .in('entity_id', taskIds)

    if (taskCommentError) throw taskCommentError
    for (const comment of taskComments ?? []) commentIds.add(comment.id)
  }

  if (commentIds.size > 0) {
    const { error: deleteError } = await supabase
      .from('comments')
      .delete()
      .in('id', Array.from(commentIds))

    if (deleteError) throw deleteError
  }
}

/** Liefert nur nicht-sensible Statusinformationen für das Testdashboard. */
export async function GET() {
  const configuration = getTestEnvironmentConfiguration()

  if (!configuration.ready || !configuration.config) {
    return NextResponse.json({
      configured: false,
      ready: false,
      cleanupEnabled: false,
      message: 'Die Live-sichere Testdaten-Bereinigung ist noch nicht vollständig konfiguriert.',
    })
  }

  try {
    const supabase = createServerClient()
    const { data, error } = await supabase.rpc('get_test_data_cleanup_status', {
      p_expected_guard_id: configuration.config.guardId,
    })

    if (error) {
      console.error('[Testdaten Status] Datenbank-Guard nicht verfügbar')
      return NextResponse.json({
        configured: true,
        ready: false,
        cleanupEnabled: true,
        message: 'Der Testdaten-Guard ist noch nicht eingerichtet oder nicht freigegeben.',
      })
    }

    const status = data as DatabaseGuardStatus
    return NextResponse.json({
      configured: true,
      ready: status.ready,
      cleanupEnabled: status.reset_allowed,
      lastResetAt: status.last_reset_at,
      lastRunId: status.last_run_id,
      message: status.ready
        ? 'Die Live-sichere Testdaten-Bereinigung ist einsatzbereit.'
        : 'Der Datenbank-Guard hat die Testdaten-Bereinigung nicht freigegeben.',
    })
  } catch {
    console.error('[Testdaten Status] Statusprüfung fehlgeschlagen')
    return NextResponse.json({
      configured: true,
      ready: false,
      cleanupEnabled: true,
      message: 'Der Testdaten-Guard ist derzeit nicht erreichbar.',
    })
  }
}

/**
 * Entfernt ausschließlich mehrfach bestätigte und technisch markierte Testdaten.
 * Dieser Endpunkt ist für Playwright globalSetup bzw. CI vorgesehen.
 */
export async function POST(request: NextRequest) {
  const configuration = getTestEnvironmentConfiguration()

  if (!configuration.ready || !configuration.config) {
    return NextResponse.json(
      { success: false, error: 'Testdaten-Bereinigung ist nicht freigegeben.' },
      { status: 403 }
    )
  }

  const cleanupToken = request.headers.get('x-test-cleanup-token')
  if (!isValidCleanupToken(cleanupToken, configuration.config.cleanupToken)) {
    return NextResponse.json(
      { success: false, error: 'Bereinigungs-Autorisierung ungültig.' },
      { status: 401 }
    )
  }

  const runId = request.headers.get('x-test-run-id')
  if (!isValidTestRunId(runId)) {
    return NextResponse.json(
      { success: false, error: 'Eine gültige Testlauf-ID ist erforderlich.' },
      { status: 400 }
    )
  }

  try {
    const supabase = createServerClient()
    await cleanupTestCommentDependencies(supabase)
    const { data, error } = await supabase.rpc('prepare_test_run', {
      p_expected_guard_id: configuration.config.guardId,
      p_run_id: runId,
    })

    if (error) {
      console.error('[Testdaten Bereinigung] Datenbank-Guard hat die Bereinigung abgelehnt')
      return NextResponse.json(
        { success: false, error: 'Der Datenbank-Guard hat die Bereinigung abgelehnt.' },
        { status: 409 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch {
    console.error('[Testdaten Bereinigung] Bereinigung fehlgeschlagen')
    return NextResponse.json(
      { success: false, error: 'Die markierten Testdaten konnten nicht bereinigt werden.' },
      { status: 500 }
    )
  }
}
