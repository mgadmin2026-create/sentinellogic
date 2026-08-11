// Gemeinsamer Scheduler-Konfig-Helper für alle Integrationen mit Cron-Sync
// (Facebook, Dialfire-Pull) — kapselt das vorher in zwei Cron-Routen und
// zwei CRUD-Routen fast identisch duplizierte Due-Check-/Update-Muster
// gegen die gemeinsame sync_config-Tabelle (Phase 3 der
// Sync-Architektur-Vereinheitlichung, ersetzt facebook_sync_config /
// dialfire_sync_config als Datenquelle).
import { createServerClient } from '@/lib/supabase/server'
import { berechneNaechstenSync, type IntervalType } from '@/lib/sync-schedule'

type SupabaseClient = ReturnType<typeof createServerClient>

export type SyncConfigIntegration = 'facebook' | 'dialfire_pull'

export interface SyncConfig {
  id: string | null
  integration: SyncConfigIntegration
  enabled: boolean
  interval_type: IntervalType
  daily_hour: number
  weekly_day: number
  weekly_hour: number
  last_sync_at: string | null
  next_sync_at: string | null
}

function defaultConfig(integration: SyncConfigIntegration): SyncConfig {
  return {
    id: null,
    integration,
    enabled: false,
    interval_type: integration === 'dialfire_pull' ? '30min' : '15min',
    daily_hour: 8,
    weekly_day: 1,
    weekly_hour: 8,
    last_sync_at: null,
    next_sync_at: null,
  }
}

export async function getSyncConfig(
  supabase: SupabaseClient,
  integration: SyncConfigIntegration
): Promise<SyncConfig> {
  const { data, error } = await supabase
    .from('sync_config')
    .select('*')
    .eq('integration', integration)
    .maybeSingle()

  if (error) {
    console.error(`[sync-config] getSyncConfig(${integration}) fehlgeschlagen:`, error)
    return defaultConfig(integration)
  }
  return data ? (data as SyncConfig) : defaultConfig(integration)
}

export function isSyncDue(config: SyncConfig, now: Date = new Date()): boolean {
  if (!config.enabled) return false
  if (config.next_sync_at && new Date(config.next_sync_at) > now) return false
  return true
}

/** Setzt enabled/interval_type und berechnet next_sync_at neu — genutzt von den CRUD-Routen. */
export async function updateSyncConfig(
  supabase: SupabaseClient,
  integration: SyncConfigIntegration,
  updates: { enabled: boolean; interval_type: IntervalType }
): Promise<SyncConfig> {
  const now = new Date()
  const nextSyncAt = updates.enabled ? berechneNaechstenSync(updates.interval_type, now) : null

  const { data, error } = await supabase
    .from('sync_config')
    .upsert(
      {
        integration,
        enabled: updates.enabled,
        interval_type: updates.interval_type,
        next_sync_at: nextSyncAt?.toISOString() ?? null,
        updated_at: now.toISOString(),
      },
      { onConflict: 'integration' }
    )
    .select()
    .single()

  if (error) throw new Error(`sync_config Update fehlgeschlagen (${integration}): ${error.message}`)
  return data as SyncConfig
}

/** Nach einem abgeschlossenen Sync-Lauf: last_sync_at/next_sync_at fortschreiben — genutzt von den Cron-Routen. */
export async function markSyncCompleted(
  supabase: SupabaseClient,
  integration: SyncConfigIntegration,
  intervalType: IntervalType,
  now: Date = new Date()
): Promise<Date> {
  const nextSyncAt = berechneNaechstenSync(intervalType, now)
  const { error } = await supabase
    .from('sync_config')
    .update({
      last_sync_at: now.toISOString(),
      next_sync_at: nextSyncAt.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('integration', integration)

  if (error) console.error(`[sync-config] markSyncCompleted(${integration}) fehlgeschlagen:`, error)
  return nextSyncAt
}
