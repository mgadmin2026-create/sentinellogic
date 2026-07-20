// API Route: Einzelner Kontakt
// GET    /api/kontakte/[id] — Kontakt mit Aktivitäten laden
// PATCH  /api/kontakte/[id] — Kontakt-Felder aktualisieren
// DELETE /api/kontakte/[id] — Kontakt löschen
import { NextRequest } from 'next/server'
import { logContactUpdated, logContactArchived, logPipelineStageChanged, logStatusChanged } from '@/lib/activities-logger'
import { createServerClient } from '@/lib/supabase/server'

const ALLOWED_UPDATE_FIELDS = new Set([
  'first_name', 'last_name', 'email', 'phone_mobile', 'phone_office',
  'company_name', 'industry', 'position',
  'street', 'postal_code', 'city', 'country', 'website',
  'source', 'status', 'notes',
  'assigned_user_id', 'qualität', 'bestandskunde',
  'pipeline_stage', 'pipeline_steps',
  'qualität', 'bestandskunde', 'jahresumsatz', 'mitarbeitanzahl', 'versicherungstyp', 'assigned_user_name',
  'klicktipp_id', 'klicktipp_tags', 'klicktipp_tag_ids', 'klicktipp_last_sync',
  'dialfire_id', 'dialfire_updated_at',
  'automation_disabled', 'dialfire_campaign_auto', 'dialfire_campaign_id', 'dialfire_task_auto', 'dialfire_task_name_field', 'klicktipp_tags_auto', 'klicktipp_tags_field',
  'kontakt_typ',
  'versicherungsgesellschaft', 'zahlweise', 'sparte', 'rechtsform', 'anrede', 'bemerkung',
  'sparte', 'kontoinhaber', 'iban', 'inhaltssumme', 'beitrag_vorsorge',
  'geburtstag_gf_inhaber', 'geschaeftsfuehrer_anzahl', 'seit_wann_gewerbe',
  // PKV-Felder (Kampagne 6X42NJWGH4YA6HC7)
  'hausnummer', 'prüfung_grund', 'krankenversicherung_status', 'situation',
  'geburtstag', 'geschlecht', 'jahreseinkommen', 'groesse', 'gewicht', 'gesundheitszustand',
  'seit_wann_selbststaendig', 'dienstverhaltnis', 'notizen_2',
  'versicherungsgesellschaft_1', 'leistungen_1', 'aktueller_beitrag_1', 'kontoinhaber_1', 'iban_1',
  'versicherungsgesellschaft_2', 'leistungen_2', 'aktueller_beitrag_2', 'kontoinhaber_2', 'iban_2',
  'versicherungsgesellschaft_3', 'leistungen_3', 'aktueller_beitrag_3', 'kontoinhaber_3', 'iban_3',
  'versicherungsgesellschaft_4', 'leistungen_4', 'aktueller_beitrag_4', 'kontoinhaber_4', 'iban_4',
  'versicherungsgesellschaft_5', 'leistungen_5', 'aktueller_beitrag_5', 'kontoinhaber_5', 'iban_5',
])

const VALID_STATUSES = ['new', 'contacted', 'qualified', 'customer']
const VALID_SOURCES = ['facebook', 'tiktok', 'calendly', 'csv', 'email', 'manuell', 'ki_upload']

// Pipeline-Schritte und ihre Status-Ableitung
const PIPELINE_STEPS_DEF = [
  { key: 'lead_in', label: 'Lead kommt rein', maps_to: 'new' },
  { key: 'contacted', label: 'Lead wird kontaktiert', maps_to: 'contacted' },
  { key: 'data_gathering', label: 'Daten werden eingeholt', maps_to: 'contacted' },
  { key: 'wait_policies', label: 'Warten auf Policen', maps_to: 'contacted' },
  { key: 'calc_offers', label: 'Angebote berechnen', maps_to: 'qualified' },
  { key: 'download_offers', label: 'Angebote herunterladen & ablegen', maps_to: 'qualified' },
  { key: 'contract_overview', label: 'Vertragsübersicht erstellen', maps_to: 'qualified' },
  { key: 'send_offers', label: 'Angebote senden', maps_to: 'qualified' },
  { key: 'offer_meeting', label: 'Angebotsbesprechung (Termin)', maps_to: 'qualified' },
  { key: 'sales_talk', label: 'Verkaufsgespräch', maps_to: 'qualified' },
  { key: 'contracts_store', label: 'Verträge ablegen', maps_to: 'customer' },
  { key: 'aftercare', label: 'Nachbereitung', maps_to: 'customer' },
]

function getStatusFromPipelineStage(stageKey: string): string {
  const stage = PIPELINE_STEPS_DEF.find(s => s.key === stageKey)
  return stage ? stage.maps_to : 'new'
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient()
    const { id } = params

    // Kontakt laden
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', id)
      .single()

    if (contactError || !contact) {
      return Response.json({ success: false, error: 'Kontakt nicht gefunden' }, { status: 404 })
    }

    // Aktivitäten laden
    const { data: activities } = await supabase
      .from('activities')
      .select('*')
      .eq('lead_id', id)
      .order('created_at', { ascending: false })

    // Aufgaben laden
    const { data: tasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('contact_id', id)
      .order('created_at', { ascending: false })

    const { data: opportunities } = await supabase
      .from('opportunities')
      .select('*')
      .eq('contact_id', id)
      .order('created_at', { ascending: false })

    const { data: tagRows } = await supabase
      .from('contact_tag_map')
      .select('tag:tag_id(id, name)')
      .eq('contact_id', id)

    return Response.json({
      success: true,
      data: {
        ...contact,
        activities: activities ?? [],
        tasks: tasks ?? [],
        tags: (tagRows ?? []).map((r: any) => r.tag),
      },
    })
  } catch (error) {
    console.error('[GET /api/kontakte/[id]] Fehler:', error)
    return Response.json({ success: false, error: 'Kontakt konnte nicht geladen werden' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient()
    const body = await request.json()
    const { id } = params

    // Nur erlaubte Felder durchlassen
    const raw: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(body)) {
      if (ALLOWED_UPDATE_FIELDS.has(key)) raw[key] = value
    }

    // Leere Strings → null
    for (const key of Object.keys(raw)) {
      if (raw[key] === '') raw[key] = null
    }

    // E-Mail normalisieren
    if (raw.email && typeof raw.email === 'string') {
      raw.email = raw.email.trim().toLowerCase()
    }

    // Enum-Validierung
    if (raw.source != null && !VALID_SOURCES.includes(String(raw.source))) {
      raw.source = 'manuell'
    }
    if (raw.status != null && !VALID_STATUSES.includes(String(raw.status))) {
      delete raw.status
    }
    if (raw.kontakt_typ != null && !['privat', 'gewerbe'].includes(String(raw.kontakt_typ))) {
      delete raw.kontakt_typ
    }

    // Pipeline-Stage Validierung & Auto-Status
    if (raw.pipeline_stage) {
      const validStage = PIPELINE_STEPS_DEF.find(s => s.key === String(raw.pipeline_stage))
      if (validStage) {
        // Auto-derive status from pipeline stage
        raw.status = validStage.maps_to
      } else {
        delete raw.pipeline_stage
      }
    }

    // Boolean-Konversion für bestandskunde
    if (raw.bestandskunde !== undefined) {
      raw.bestandskunde = raw.bestandskunde === true || raw.bestandskunde === 'true'
    }

    if (Object.keys(raw).length === 0) {
      return Response.json(
        { success: false, error: 'Keine gültigen Felder zum Aktualisieren' },
        { status: 400 }
      )
    }

    // Kontakt aktualisieren
    const { data, error } = await supabase
      .from('contacts')
      .update(raw)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[PATCH /api/kontakte/[id]] Fehler:', error)
      return Response.json({ success: false, error: error.message }, { status: 500 })
    }

    // Aktivität loggen (optional)
    try {
      if (raw.pipeline_stage) {
        const stage = PIPELINE_STEPS_DEF.find(s => s.key === raw.pipeline_stage)
        await supabase.from('activities').insert({
          lead_id: id,
          type: 'pipeline_change',
          description: `Prozessschritt: ${stage?.label || String(raw.pipeline_stage)}`,
        })
      } else if (raw.status) {
        await supabase.from('activities').insert({
          lead_id: id,
          type: 'status_change',
          description: `Status geändert zu: ${raw.status}`,
        })
      }
    } catch (e) {
      // Fehler beim Aktivitätsloggen ignorieren
    }

    // Log activity — wichtigste Änderungen tracken
    if (data) {
      const kontaktName = `${data.first_name} ${data.last_name}`
      
      // Pipeline-Stage-Wechsel loggen
      if (raw.pipeline_stage && body.pipeline_stage !== undefined) {
        const stage = PIPELINE_STEPS_DEF.find((s: any) => s.key === raw.pipeline_stage)
        if (stage) {
          await logPipelineStageChanged(id, kontaktName, "", String(raw.pipeline_stage), stage.label)
        }
      }
    }
    return Response.json({ success: true, data })
  } catch (err) {
    console.error('[PATCH /api/kontakte/[id]] Fehler:', err)
    return Response.json({ success: false, error: 'Kontakt konnte nicht aktualisiert werden' }, { status: 500 })
  }
}

// Archiviert den Kontakt (Soft-Delete). Echtes Löschen ist nur noch über
// direkten Supabase-Zugriff (Tests/Admin) vorgesehen, nicht mehr über die App.
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient()
    const { id } = params
    const { archiveTasks = false } = await request.json().catch(() => ({ archiveTasks: false }))

    // Get contact before archiving (for logging)
    const { data: kontakt } = await supabase
      .from('contacts')
      .select('first_name, last_name')
      .eq('id', id)
      .single()

    if (!kontakt) {
      return Response.json({ success: false, error: 'Kontakt nicht gefunden' }, { status: 404 })
    }

    // Dokumente archivieren (wie bisher)
    const { error: archiveError } = await supabase
      .from('dokumente_metadata')
      .update({
        ordner_archived: true,
        kontakt_deleted_at: new Date().toISOString(),
      })
      .eq('kontakt_id', id)

    if (archiveError) {
      console.warn('[DELETE /api/kontakte/[id]] Dokumente-Archivierung fehlgeschlagen:', archiveError)
    }

    // Kontakt archivieren statt löschen
    const { error } = await supabase
      .from('contacts')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      console.error('[DELETE /api/kontakte/[id]] Fehler:', error)
      return Response.json({ success: false, error: error.message }, { status: 500 })
    }

    // Optional: zugehörige, noch nicht archivierte Aufgaben mitarchivieren
    if (archiveTasks === true) {
      const { error: taskError } = await supabase
        .from('tasks')
        .update({ archived_at: new Date().toISOString() })
        .eq('contact_id', id)
        .is('archived_at', null)

      if (taskError) {
        console.warn('[DELETE /api/kontakte/[id]] Aufgaben-Archivierung fehlgeschlagen:', taskError)
      }
    }

    await logContactArchived(id, `${kontakt.first_name} ${kontakt.last_name}`, archiveTasks === true)

    return Response.json({ success: true, data: { archived: true, tasksArchived: archiveTasks === true } })
  } catch (err) {
    console.error('[DELETE /api/kontakte/[id]] Fehler:', err)
    return Response.json({ success: false, error: 'Kontakt konnte nicht archiviert werden' }, { status: 500 })
  }
}
