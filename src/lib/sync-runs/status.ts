// Geteilte Status-Klassifikation für sync_runs-Zeilen. Bewusst die volle
// Zustandsvielfalt (anders als RegelLaufHistorie/bewerteSyncFromRuns, die
// bei 3 vereinfachten Zuständen bleibt — die Feindifferenzierung hier ist
// explizit Control-Center-Scope, siehe src/app/api/rules/[id]/runs/route.ts).
export type SyncRunStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'failed'
  | 'retrying'
  | 'dead_letter'
  | 'skipped'

export type SyncRunTone = 'success' | 'error' | 'warning' | 'neutral'

export interface SyncRunStatusInfo {
  label: string
  tone: SyncRunTone
}

/**
 * `skipped` wird von keinem Sync-Code-Pfad automatisch gesetzt — der Status
 * ist reserviert für "Nutzer hat den Retry manuell pausiert" (siehe
 * POST /api/sync-runs/[id]/pause), unterscheidbar von `dead_letter` (System
 * hat den Fehler als nicht-retrybar klassifiziert).
 */
export function classifyRunStatus(status: string): SyncRunStatusInfo {
  switch (status as SyncRunStatus) {
    case 'success':
      return { label: 'Erfolgreich', tone: 'success' }
    case 'failed':
      return { label: 'Fehlgeschlagen', tone: 'error' }
    case 'dead_letter':
      return { label: 'Fehlgeschlagen (kein Retry)', tone: 'error' }
    case 'retrying':
      return { label: 'Wird wiederholt', tone: 'warning' }
    case 'pending':
    case 'running':
      return { label: 'Läuft', tone: 'neutral' }
    case 'skipped':
      return { label: 'Pausiert', tone: 'neutral' }
    default:
      return { label: status, tone: 'neutral' }
  }
}
