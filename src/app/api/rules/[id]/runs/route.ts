// API Route: Lauf-Historie einer Automatisierungsregel
// GET /api/rules/[id]/runs
//
// Beantwortet die Frage "Was hat diese Regel bewirkt?" pro betroffenem Kontakt:
// wurde er neu angelegt, wurden die Felder gesetzt, hat die Synchronisation
// nach Dialfire bzw. KlickTipp geklappt.
//
// Datenquelle ist das bestehende Aktivitätsprotokoll. Zwei Besonderheiten:
//  1. Ältere Batch-Läufe tragen die Regel-ID nur im Beschreibungstext. Deshalb
//     wird zusätzlich darauf gefiltert (die ID ist eine UUID, also eindeutig).
//  2. Die Sync-Aktivitäten kennen die auslösende Regel nicht. Sie werden über
//     den Kontakt zugeordnet und zeitlich dem Lauf zugerechnet — sichtbar
//     gemacht wird der Sync-Stand des Kontakts, nicht eine erfundene Kausalkette.
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_RUNS = 200

type SyncStatus = 'ok' | 'failed' | 'offen'

interface SyncInfo {
  status: SyncStatus
  detail: string | null
  at: string | null
}

/** Neuester Sync-Eintrag gewinnt — ein späterer Erfolg hebt einen früheren Fehler auf. */
function bewerteSync(
  eintraege: Array<{ type: string; description: string | null; created_at: string }>,
  erfolgTypen: string[],
  fehlerTypen: string[]
): SyncInfo {
  const relevant = eintraege
    .filter((a) => erfolgTypen.includes(a.type) || fehlerTypen.includes(a.type))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))

  if (relevant.length === 0) return { status: 'offen', detail: null, at: null }

  const neuester = relevant[0]
  return {
    status: erfolgTypen.includes(neuester.type) ? 'ok' : 'failed',
    detail: neuester.description ?? null,
    at: neuester.created_at,
  }
}

/**
 * Wie bewerteSync(), aber aus sync_runs statt activities — präziser, weil
 * direkt an diese Regel gebunden (rule_id) statt nur zeitlich/über den
 * Kontakt zugeordnet. `pending`/`running`/`retrying` gelten hier bewusst
 * noch als 'offen' (kein 4. UI-Zustand in dieser Phase, das ist Phase-4-
 * Control-Center-Scope); `failed`/`dead_letter` gelten als 'failed'.
 */
function bewerteSyncFromRuns(
  runs: Array<{ status: string; error_detail: string | null; started_at: string }>
): SyncInfo | null {
  if (runs.length === 0) return null
  const neuester = [...runs].sort((a, b) => b.started_at.localeCompare(a.started_at))[0]

  if (neuester.status === 'success') {
    return { status: 'ok', detail: null, at: neuester.started_at }
  }
  if (neuester.status === 'failed' || neuester.status === 'dead_letter') {
    return { status: 'failed', detail: neuester.error_detail, at: neuester.started_at }
  }
  return { status: 'offen', detail: null, at: neuester.started_at }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return Response.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 })
  }
  if (!UUID_PATTERN.test(params.id)) {
    return Response.json({ success: false, error: 'Ungültige Regel' }, { status: 400 })
  }

  const supabase = createServerClient()
  const limit = Math.min(
    Number.parseInt(new URL(request.url).searchParams.get('limit') || '50', 10) || 50,
    MAX_RUNS
  )

  try {
    // Läufe dieser Regel: neue Einträge über data->>rule_id, ältere über den Text.
    const { data: laeufe, error } = await supabase
      .from('activities')
      .select('id, lead_id, description, data, created_at')
      .eq('type', 'automation_executed')
      .or(`data->>rule_id.eq.${params.id},description.ilike.%${params.id}%`)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw new Error(error.message)
    if (!laeufe?.length) {
      return Response.json({ success: true, data: { runs: [], gesamt: 0 } })
    }

    const kontaktIds = Array.from(new Set(laeufe.map((l) => l.lead_id).filter(Boolean))) as string[]

    // Kontakte und deren Sync-/Anlage-Aktivitäten nachladen. Dialfire- und
    // KlickTipp-Aktivitäten werden in getrennten Abfragen geholt: ein anderer
    // Hintergrundprozess erzeugt pro Kontakt sehr viele dialfire_synced-Einträge
    // (mehrfach täglich), die in einer gemeinsamen Abfrage das implizite
    // 1000-Zeilen-Limit von PostgREST auffressen und die viel selteneren
    // klicktipp_synced-Einträge verdrängen würden — mit der Folge, dass die
    // Historie fälschlich "KlickTipp nicht erfolgt" anzeigt, obwohl der Kontakt
    // tatsächlich synchronisiert wurde. Je Typ absteigend sortiert, damit im
    // Zweifel die neuesten (relevantesten) Einträge erhalten bleiben.
    const [{ data: kontakte }, { data: dialfireActs }, { data: klicktippActs }, { data: syncRuns }] = await Promise.all([
      supabase
        .from('contacts')
        .select('id, first_name, last_name, company_name, created_at, dialfire_id, archived_at')
        .in('id', kontaktIds),
      supabase
        .from('activities')
        .select('lead_id, type, description, created_at')
        .in('lead_id', kontaktIds)
        .in('type', ['dialfire_synced', 'dialfire_sync', 'dialfire_sync_failed'])
        .order('created_at', { ascending: false })
        .limit(1000),
      supabase
        .from('activities')
        .select('lead_id, type, description, created_at')
        .in('lead_id', kontaktIds)
        .in('type', ['contact_created', 'klicktipp_sync', 'klicktipp_synced', 'klicktipp_sync_failed'])
        .order('created_at', { ascending: false })
        .limit(1000),
      // Präzisere, an diese Regel gebundene Sync-Historie (seit Phase 2 der
      // Sync-Architektur-Vereinheitlichung). Läufe von vor der Umstellung
      // haben kein rule_id gesetzt — für die fällt die Anzeige unten auf die
      // activities-Abfragen oben zurück, damit alte Historie nicht plötzlich
      // "offen" zeigt.
      supabase
        .from('sync_runs')
        .select('contact_id, integration, status, error_detail, started_at')
        .eq('rule_id', params.id)
        .eq('run_kind', 'item')
        .in('integration', ['klicktipp', 'dialfire'])
        .order('started_at', { ascending: false })
        .limit(1000),
    ])

    const kontaktById = new Map((kontakte ?? []).map((k) => [k.id, k]))
    const proKontakt = new Map<string, Array<{ type: string; description: string | null; created_at: string }>>()
    for (const a of [...(dialfireActs ?? []), ...(klicktippActs ?? [])]) {
      if (!a.lead_id) continue
      const liste = proKontakt.get(a.lead_id) ?? []
      liste.push({ type: a.type, description: a.description, created_at: a.created_at })
      proKontakt.set(a.lead_id, liste)
    }

    // sync_runs gruppiert nach Kontakt + Integration.
    const syncRunsByContact = new Map<string, Array<{ status: string; error_detail: string | null; started_at: string }>>()
    for (const r of syncRuns ?? []) {
      if (!r.contact_id) continue
      const key = `${r.contact_id}:${r.integration}`
      const liste = syncRunsByContact.get(key) ?? []
      liste.push({ status: r.status, error_detail: r.error_detail, started_at: r.started_at })
      syncRunsByContact.set(key, liste)
    }

    const runs = laeufe.map((lauf) => {
      const kontakt = lauf.lead_id ? kontaktById.get(lauf.lead_id) : null
      const eintraege = lauf.lead_id ? proKontakt.get(lauf.lead_id) ?? [] : []
      const daten = (lauf.data ?? {}) as Record<string, unknown>

      const gesetzteFelder: string[] = []
      if (daten.dialfire_campaign_id) gesetzteFelder.push('Dialfire-Kampagne')
      if (daten.dialfire_task_name) gesetzteFelder.push('Dialfire-Task')
      if (Array.isArray(daten.klicktipp_tags) && daten.klicktipp_tags.length) gesetzteFelder.push('KlickTipp-Tag')
      if (daten.status) gesetzteFelder.push('Status')

      const auslöser = daten.trigger === 'batch' || String(lauf.description || '').startsWith('Batch:')
        ? 'batch'
        : 'auto'

      return {
        id: lauf.id,
        zeitpunkt: lauf.created_at,
        auslöser,
        kontakt: kontakt
          ? {
              id: kontakt.id,
              name: [kontakt.first_name, kontakt.last_name].filter(Boolean).join(' ').trim() || 'Ohne Namen',
              firma: kontakt.company_name,
              archiviert: Boolean(kontakt.archived_at),
            }
          : null,
        // „Neu angelegt“ heißt: Die Anlage ist protokolliert, unabhängig davon,
        // ob sie diesem Lauf zeitlich unmittelbar vorausging.
        kontakt_neu_angelegt: eintraege.some((a) => a.type === 'contact_created'),
        gesetzte_felder: gesetzteFelder,
        dialfire:
          bewerteSyncFromRuns(syncRunsByContact.get(`${lauf.lead_id}:dialfire`) ?? []) ??
          bewerteSync(eintraege, ['dialfire_synced', 'dialfire_sync'], ['dialfire_sync_failed']),
        klicktipp:
          bewerteSyncFromRuns(syncRunsByContact.get(`${lauf.lead_id}:klicktipp`) ?? []) ??
          bewerteSync(eintraege, ['klicktipp_sync', 'klicktipp_synced'], ['klicktipp_sync_failed']),
        dialfire_id_vorhanden: Boolean(kontakt?.dialfire_id),
      }
    })

    return Response.json({
      success: true,
      data: {
        runs,
        gesamt: runs.length,
        begrenzt: runs.length === limit,
      },
    })
  } catch (err) {
    console.error('[GET /api/rules/[id]/runs]', err)
    return Response.json({ success: false, error: 'Lauf-Historie konnte nicht geladen werden' }, { status: 500 })
  }
}
