// Pipeline-Verwaltung: Typen, Helfer, Status-Derivation
import { LeadStatus } from '@/types'

export interface PipelineStage {
  id: string
  position: number
  key: string
  label: string
  is_optional: boolean
  maps_to_status: LeadStatus
  active: boolean
  created_at?: string
}

export interface PipelineStep {
  key: string
  done: boolean
  completed_at?: string  // ISO date-time
  due_date?: string      // ISO date
}

// 12 Default-Schritte (Fallback wenn Supabase offline oder before migration)
export const DEFAULT_STAGES: PipelineStage[] = [
  { id: '1', position: 1, key: 'lead_in', label: 'Lead kommt rein', is_optional: false, maps_to_status: 'new', active: true },
  { id: '2', position: 2, key: 'contacted', label: 'Lead wird kontaktiert', is_optional: false, maps_to_status: 'contacted', active: true },
  { id: '3', position: 3, key: 'data_gathering', label: 'Daten werden eingeholt', is_optional: false, maps_to_status: 'contacted', active: true },
  { id: '4', position: 4, key: 'wait_policies', label: 'Warten auf Policen', is_optional: true, maps_to_status: 'contacted', active: true },
  { id: '5', position: 5, key: 'calc_offers', label: 'Angebote berechnen', is_optional: false, maps_to_status: 'qualified', active: true },
  { id: '6', position: 6, key: 'download_offers', label: 'Angebote herunterladen & ablegen', is_optional: false, maps_to_status: 'qualified', active: true },
  { id: '7', position: 7, key: 'contract_overview', label: 'Vertragsübersicht erstellen', is_optional: false, maps_to_status: 'qualified', active: true },
  { id: '8', position: 8, key: 'send_offers', label: 'Angebote senden', is_optional: false, maps_to_status: 'qualified', active: true },
  { id: '9', position: 9, key: 'offer_meeting', label: 'Angebotsbesprechung (Termin)', is_optional: false, maps_to_status: 'qualified', active: true },
  { id: '10', position: 10, key: 'sales_talk', label: 'Verkaufsgespräch', is_optional: false, maps_to_status: 'qualified', active: true },
  { id: '11', position: 11, key: 'contracts_store', label: 'Verträge ablegen', is_optional: false, maps_to_status: 'customer', active: true },
  { id: '12', position: 12, key: 'aftercare', label: 'Nachbereitung', is_optional: false, maps_to_status: 'customer', active: true }
]

/**
 * Leitet den Status eines Leads aus dem aktuellen Pipeline-Schritt ab.
 * @param stageKey - Aktueller Schritt-Key (z.B. 'calc_offers')
 * @param stages - Alle verfügbaren Pipeline-Stages
 * @returns Abgeleiteter Status (new|contacted|qualified|customer)
 */
export function deriveStatusFromStage(stageKey: string | null | undefined, stages: PipelineStage[] = DEFAULT_STAGES): LeadStatus {
  if (!stageKey) return 'new'

  const stage = stages.find(s => s.key === stageKey && s.active)
  return stage ? stage.maps_to_status : 'new'
}

/**
 * Merged aktive Pipeline-Stages (Config) mit Lead-spezifischen Schritt-States.
 * Effektive Liste = Config-Reihenfolge + Lead-Zustand (done/due_date).
 * @param stages - Alle aktiven Pipeline-Stages (sortiert nach position)
 * @param steps - Lead-spezifische Schritt-States aus pipeline_steps JSONB
 * @returns Gemergte Liste mit Label + State kombiniert
 */
export interface MergedStep extends PipelineStage {
  done: boolean
  completed_at?: string
  due_date?: string
}

export function mergeSteps(stages: PipelineStage[], steps: PipelineStep[] = []): MergedStep[] {
  return stages
    .filter(s => s.active)
    .sort((a, b) => a.position - b.position)
    .map(stage => {
      const step = steps.find(s => s.key === stage.key)
      return {
        ...stage,
        done: step?.done ?? false,
        completed_at: step?.completed_at,
        due_date: step?.due_date
      }
    })
}

/**
 * Findet den aktuellen Schritt-Key für einen neuen Lead (erster Schritt).
 */
export function getFirstStageKey(stages: PipelineStage[] = DEFAULT_STAGES): string {
  const sorted = [...stages].sort((a, b) => a.position - b.position)
  return sorted[0]?.key ?? 'lead_in'
}

/**
 * Findet den nächsten Schritt-Key (für "Nächster Schritt"-Button).
 */
export function getNextStageKey(currentStageKey: string, stages: PipelineStage[] = DEFAULT_STAGES): string | null {
  const sorted = stages.filter(s => s.active).sort((a, b) => a.position - b.position)
  const currentIdx = sorted.findIndex(s => s.key === currentStageKey)

  if (currentIdx === -1 || currentIdx === sorted.length - 1) return null
  return sorted[currentIdx + 1].key
}

/**
 * Findet den vorherigen Schritt-Key.
 */
export function getPreviousStageKey(currentStageKey: string, stages: PipelineStage[] = DEFAULT_STAGES): string | null {
  const sorted = stages.filter(s => s.active).sort((a, b) => a.position - b.position)
  const currentIdx = sorted.findIndex(s => s.key === currentStageKey)

  if (currentIdx <= 0) return null
  return sorted[currentIdx - 1].key
}

/**
 * Findet ein Stage-Label per Key.
 */
export function getStageLabelByKey(stageKey: string, stages: PipelineStage[] = DEFAULT_STAGES): string {
  return stages.find(s => s.key === stageKey)?.label ?? stageKey
}

/**
 * Heutiges Kalenderdatum als YYYY-MM-DD, über die explizite Zeitzone
 * Europe/Berlin -- NICHT über new Date().toISOString() (UTC) oder lokale
 * Date-Getter. Server-Code (API-Routen, Edge Functions) läuft auf
 * Vercel/Supabase in UTC, unabhängig vom deutschen Nutzer; diese Funktion
 * liefert daher unabhängig vom Aufrufer (Browser oder Server) denselben,
 * korrekten deutschen Kalendertag.
 */
export function heutigesDatumBerlin(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' })
}

/**
 * Hilfsfunktion: Ist ein Fälligkeitsdatum überfällig? (vor heute)
 * Vergleich rein über den Kalendertag (YYYY-MM-DD-Anteil), damit ein
 * heute fälliger Eintrag den ganzen Tag über nicht als überfällig gilt --
 * einzige, gemeinsam genutzte Implementierung (vorher gab es 4 vonein-
 * ander abweichende Versionen in dashboard/opportunities/aufgaben/pipeline).
 */
export function isOverdue(dueDate: string | null | undefined): boolean {
  if (!dueDate) return false
  return dueDate.slice(0, 10) < heutigesDatumBerlin()
}

/**
 * Hilfsfunktion: Ist ein Fälligkeitsdatum heute fällig?
 */
export function isDueToday(dueDate: string | null | undefined): boolean {
  if (!dueDate) return false
  return dueDate.slice(0, 10) === heutigesDatumBerlin()
}

/**
 * Formatiert einen Fortschrittsbalken-Text: "Schritt X/12 · Label"
 */
export function formatProgressText(currentPosition: number | null, totalStages: number = 12, currentLabel: string = '—'): string {
  if (!currentPosition) return '— · —'
  return `Schritt ${currentPosition}/12 · ${currentLabel}`
}

/**
 * Berechnet die Anzahl erledigter Schritte.
 */
export function countCompletedSteps(mergedSteps: MergedStep[]): number {
  return mergedSteps.filter(s => s.done).length
}
