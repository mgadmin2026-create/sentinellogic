// Gemeinsamer Tracking-/Retry-Wrapper für sync_runs. Ziel: EIN Helper, den
// migrierte Integrationen adoptieren, statt dass jede ihr eigenes
// try/catch+logActivity-Muster mitbringt (siehe automation-engine.ts,
// klicktipp-sync.ts, apply-batch/route.ts — alle bisher unabhängig).
// Tracking darf den eigentlichen Sync-Vorgang nie blockieren: schlägt das
// Schreiben nach sync_runs selbst fehl, wird nur geloggt, nie geworfen.
import { createServerClient } from '@/lib/supabase/server'
import { classifyError, type ErrorClass } from './error-classification'

type SupabaseClient = ReturnType<typeof createServerClient>

export interface RunMeta {
  runKind: 'batch' | 'item'
  integration: string
  triggerType: 'auto' | 'manual' | 'cron' | 'webhook'
  contactId?: string | null
  ruleId?: string | null
  parentRunId?: string | null
  data?: Record<string, unknown>
}

interface StartedRun {
  id: string
  attempt_count: number
  max_attempts: number
}

// Backoff-Stufen in Minuten, indiziert nach attempt_count (1-basiert); letzter
// Wert wiederholt sich für weitere Versuche, falls max_attempts höher gesetzt wird.
const BACKOFF_MINUTES = [2, 10, 60]

function computeNextRetryAt(attemptCount: number): string {
  const idx = Math.min(Math.max(attemptCount - 1, 0), BACKOFF_MINUTES.length - 1)
  return new Date(Date.now() + BACKOFF_MINUTES[idx] * 60_000).toISOString()
}

export async function recordRunStart(supabase: SupabaseClient, meta: RunMeta): Promise<StartedRun | null> {
  const { data, error } = await supabase
    .from('sync_runs')
    .insert({
      run_kind: meta.runKind,
      parent_run_id: meta.parentRunId ?? null,
      contact_id: meta.contactId ?? null,
      rule_id: meta.ruleId ?? null,
      integration: meta.integration,
      trigger_type: meta.triggerType,
      status: 'running',
      attempt_count: 1,
      data: meta.data ?? {},
    })
    .select('id, attempt_count, max_attempts')
    .single()

  if (error) {
    console.error('[sync-runs] recordRunStart fehlgeschlagen:', error)
    return null
  }
  return data
}

type Outcome =
  | { success: true; data?: Record<string, unknown> }
  | { success: false; errorClass: ErrorClass; retryable: boolean; errorDetail: string; data?: Record<string, unknown> }

export async function recordRunOutcome(supabase: SupabaseClient, run: StartedRun, outcome: Outcome): Promise<void> {
  if (outcome.success) {
    await supabase
      .from('sync_runs')
      .update({
        status: 'success',
        finished_at: new Date().toISOString(),
        ...(outcome.data ? { data: outcome.data } : {}),
      })
      .eq('id', run.id)
    return
  }

  const exhausted = !outcome.retryable || run.attempt_count >= run.max_attempts

  await supabase
    .from('sync_runs')
    .update({
      status: exhausted ? 'dead_letter' : 'retrying',
      error_class: outcome.errorClass,
      error_detail: outcome.errorDetail.slice(0, 2000),
      next_retry_at: exhausted ? null : computeNextRetryAt(run.attempt_count),
      finished_at: exhausted ? new Date().toISOString() : null,
      ...(outcome.data ? { data: outcome.data } : {}),
    })
    .eq('id', run.id)
}

/**
 * Führt fn() aus und protokolliert Start/Ergebnis als sync_runs-Zeile.
 * Tracking-Fehler werden nur geloggt, nie geworfen — der eigentliche
 * Rückgabewert bzw. geworfene Fehler von fn() bleibt unverändert erhalten.
 */
export async function runWithTracking<T>(
  supabase: SupabaseClient,
  meta: RunMeta,
  fn: () => Promise<T>
): Promise<T> {
  const run = await recordRunStart(supabase, meta)

  try {
    const result = await fn()
    if (run) {
      try {
        await recordRunOutcome(supabase, run, { success: true })
      } catch (trackErr) {
        console.error('[sync-runs] recordRunOutcome (success) fehlgeschlagen:', trackErr)
      }
    }
    return result
  } catch (err) {
    const classification = classifyError(err)
    if (run) {
      try {
        await recordRunOutcome(supabase, run, {
          success: false,
          errorClass: classification.errorClass,
          retryable: classification.retryable,
          errorDetail: classification.detail,
        })
      } catch (trackErr) {
        console.error('[sync-runs] recordRunOutcome (failure) fehlgeschlagen:', trackErr)
      }
    }
    throw err
  }
}
