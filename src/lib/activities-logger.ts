// Activities Logger — Protokolliert alle Kontakt-Änderungen
import { createServerClient } from '@/lib/supabase/server'

export type ActivityType =
  | 'contact_created'
  | 'contact_updated'
  | 'contact_deleted'
  | 'pipeline_stage_changed'
  | 'pipeline_step_completed'
  | 'task_created'
  | 'file_uploaded'
  | 'note_updated'
  | 'status_changed'
  | 'klicktipp_synced'
  | 'klicktipp_sync_failed'
  | 'dialfire_synced'
  | 'dialfire_sync_failed'
  | 'facebook_imported'
  | 'facebook_linked'
  | 'facebook_skipped_duplicate'
  | 'automation_executed'
  | 'automation_skipped'

interface ActivityData {
  [key: string]: any
}

/**
 * Loggt eine Aktivität für einen Kontakt
 */
export async function logActivity(
  leadId: string | null,
  contactId: string | null,
  type: ActivityType,
  description: string,
  data?: ActivityData
) {
  try {
    const supabase = createServerClient()

    // Nutze lead_id wenn vorhanden, sonst contact_id
    const id = leadId || contactId
    if (!id) {
      console.warn('[logActivity] Keine lead_id oder contact_id übergeben')
      return
    }

    await supabase.from('activities').insert([
      {
        lead_id: leadId || contactId, // Always use lead_id Column
        type,
        description,
        data: data || {},
        created_at: new Date().toISOString(),
      },
    ])
  } catch (error) {
    console.error('[logActivity] Fehler beim Loggen:', error)
    // Fehler nicht werfen — Logging soll die Main-Operation nicht blockieren
  }
}

/**
 * Kontakt erstellt
 */
export async function logContactCreated(contactId: string, contactName: string) {
  await logActivity(
    null,
    contactId,
    'contact_created',
    `Kontakt erstellt: ${contactName}`,
    { name: contactName }
  )
}

/**
 * Kontakt bearbeitet — nur geänderte Felder loggen
 */
export async function logContactUpdated(
  contactId: string,
  contactName: string,
  changes: Record<string, { old: any; new: any }>
) {
  const changeDescriptions = Object.entries(changes)
    .map(([field, { old: oldVal, new: newVal }]) => `${field}: ${oldVal} → ${newVal}`)
    .join(', ')

  await logActivity(
    null,
    contactId,
    'contact_updated',
    `Kontakt aktualisiert: ${contactName}. Änderungen: ${changeDescriptions}`,
    { changes }
  )
}

/**
 * Kontakt gelöscht
 */
export async function logContactDeleted(contactId: string, contactName: string) {
  await logActivity(
    null,
    contactId,
    'contact_deleted',
    `Kontakt gelöscht: ${contactName}`,
    { name: contactName }
  )
}

/**
 * Pipeline-Schritt geändert
 */
export async function logPipelineStageChanged(
  contactId: string,
  contactName: string,
  oldStage: string,
  newStage: string,
  stageLabel: string
) {
  await logActivity(
    null,
    contactId,
    'pipeline_stage_changed',
    `Prozessschritt geändert: ${contactName} → ${stageLabel}`,
    { oldStage, newStage, stageLabel }
  )
}

/**
 * Pipeline-Schritt als erledigt markiert
 */
export async function logPipelineStepCompleted(
  contactId: string,
  contactName: string,
  stepLabel: string,
  completedAt: string
) {
  await logActivity(
    null,
    contactId,
    'pipeline_step_completed',
    `Schritt erledigt: ${contactName} — ${stepLabel}`,
    { stepLabel, completedAt }
  )
}

/**
 * Task erstellt
 */
export async function logTaskCreated(
  contactId: string,
  contactName: string,
  taskTitle: string
) {
  await logActivity(
    null,
    contactId,
    'task_created',
    `Aufgabe erstellt für ${contactName}: ${taskTitle}`,
    { taskTitle }
  )
}

/**
 * Datei hochgeladen / abgelegt
 */
export async function logFileUploaded(
  contactId: string,
  contactName: string,
  fileName: string,
  category?: string
) {
  await logActivity(
    null,
    contactId,
    'file_uploaded',
    `Datei abgelegt für ${contactName}: ${fileName}${category ? ` (${category})` : ''}`,
    { fileName, category }
  )
}

/**
 * Notiz aktualisiert
 */
export async function logNoteUpdated(
  contactId: string,
  contactName: string
) {
  await logActivity(
    null,
    contactId,
    'note_updated',
    `Notiz aktualisiert für ${contactName}`,
    {}
  )
}

/**
 * Status geändert
 */
export async function logStatusChanged(
  contactId: string,
  contactName: string,
  oldStatus: string,
  newStatus: string
) {
  await logActivity(
    null,
    contactId,
    'status_changed',
    `Status geändert für ${contactName}: ${oldStatus} → ${newStatus}`,
    { oldStatus, newStatus }
  )
}
