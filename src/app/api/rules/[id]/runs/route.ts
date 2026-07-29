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

    // Kontakte und deren Sync-/Anlage-Aktivitäten in je einer Abfrage nachladen.
    const [{ data: kontakte }, { data: begleitend }] = await Promise.all([
      supabase
        .from('contacts')
        .select('id, first_name, last_name, company_name, created_at, dialfire_id, archived_at')
        .in('id', kontaktIds),
      supabase
        .from('activities')
        .select('lead_id, type, description, created_at')
        .in('lead_id', kontaktIds)
        .in('type', [
          'contact_created',
          'dialfire_synced', 'dialfire_sync', 'dialfire_sync_failed',
          'klicktipp_sync', 'klicktipp_synced', 'klicktipp_sync_failed',
        ]),
    ])

    const kontaktById = new Map((kontakte ?? []).map((k) => [k.id, k]))
    const proKontakt = new Map<string, Array<{ type: string; description: string | null; created_at: string }>>()
    for (const a of begleitend ?? []) {
      if (!a.lead_id) continue
      const liste = proKontakt.get(a.lead_id) ?? []
      liste.push({ type: a.type, description: a.description, created_at: a.created_at })
      proKontakt.set(a.lead_id, liste)
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
        dialfire: bewerteSync(eintraege, ['dialfire_synced', 'dialfire_sync'], ['dialfire_sync_failed']),
        klicktipp: bewerteSync(eintraege, ['klicktipp_sync', 'klicktipp_synced'], ['klicktipp_sync_failed']),
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
