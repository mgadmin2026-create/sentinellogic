// Manuelles sync_runs-Tracking für STRATO-Mail-Versand -- bewusst KEIN
// runWithTracking(), damit ein Fehlschlag IMMER dead_letter wird, nie
// retrying: ein automatischer Retry könnte eine bereits zugestellte Mail ein
// zweites Mal an einen echten Menschen schicken (anders als ein erneuter
// CalDAV-PUT oder Kontakt-Sync, die idempotent sind). Dient ausschließlich
// der Sichtbarkeit im Control Center ("X von Y STRATO-Mails fehlgeschlagen"),
// nie einem automatischen erneuten Versand -- es gibt bewusst keinen
// RETRY_HANDLERS-Eintrag für integration:'strato_mail'.
import { createServerClient } from '@/lib/supabase/server'
import { recordRunStart, recordRunOutcome } from '@/lib/sync-runs/retry-runner'
import { classifyError } from '@/lib/sync-runs/error-classification'

type SupabaseClient = ReturnType<typeof createServerClient>

export interface StratoMailTrackMeta {
  contactId?: string | null
  triggerType?: 'auto' | 'manual'
  data?: Record<string, unknown>
}

export async function trackStratoMailSend<T>(
  supabase: SupabaseClient,
  meta: StratoMailTrackMeta,
  fn: () => Promise<T>
): Promise<T> {
  const run = await recordRunStart(supabase, {
    runKind: 'item',
    integration: 'strato_mail',
    triggerType: meta.triggerType ?? 'auto',
    contactId: meta.contactId ?? null,
    data: meta.data,
  })

  try {
    const result = await fn()
    if (run) {
      try {
        await recordRunOutcome(supabase, run, {
          success: true,
          data: result !== undefined ? { result } : undefined,
        })
      } catch (trackErr) {
        console.error('[sync-runs] recordRunOutcome (strato_mail success) fehlgeschlagen:', trackErr)
      }
    }
    return result
  } catch (err) {
    if (run) {
      const classification = classifyError(err)
      try {
        await recordRunOutcome(supabase, run, {
          success: false,
          errorClass: classification.errorClass,
          retryable: false,
          errorDetail: classification.detail,
        })
      } catch (trackErr) {
        console.error('[sync-runs] recordRunOutcome (strato_mail failure) fehlgeschlagen:', trackErr)
      }
    }
    throw err
  }
}
