// API Route: Angebote (angebote-Tabelle)
// GET  /api/angebote — Angebote auflisten (optional gefiltert)
// POST /api/angebote — neues Angebot anlegen
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { logAngebotCreated, logStatusChanged } from '@/lib/activities-logger'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const VALID_STATUSES = ['in_erstellung', 'versendet', 'in_verhandlung', 'gewonnen', 'verloren']
const VALID_ZYKLEN = ['monatlich', 'vierteljaehrlich', 'halbjaehrlich', 'jaehrlich']
const CONTACT_STATUS_RANG: Record<string, number> = {
  new: 0,
  contacted: 1,
  qualified: 2,
  customer: 3,
  not_interested: 3,
}

// Kontakt inkl. Verantwortlichem (für "Wer betreut das?") und verknüpftes
// Quelldokument (für den Direkt-Link zur Drive-Datei) — analog zur
// Kontaktübersicht bzw. den Dokumentenlisten.
const ANGEBOT_SELECT =
  '*, contact:contact_id(id, first_name, last_name, is_test_data, assigned_user_id, assigned_user:assigned_user_id(id, name)), dokument:dokument_id(id, file_id, file_name)'

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return Response.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 })
    }

    const supabase = createServerClient()
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') ?? '500', 10)
    const status = url.searchParams.get('status')
    const contactId = url.searchParams.get('contact_id')
    const search = url.searchParams.get('search')
    const includeArchived = url.searchParams.get('includeArchived') === 'true'

    let query = supabase
      .from('angebote')
      .select(ANGEBOT_SELECT)
      .order('created_at', { ascending: false })

    if (!includeArchived) {
      query = query.is('archived_at', null)
    }
    if (status && VALID_STATUSES.includes(status)) {
      query = query.eq('status', status)
    }
    if (contactId) {
      query = query.eq('contact_id', contactId)
    }
    if (search) {
      query = query.ilike('name', `%${search}%`)
    }

    const { data, error } = await query.limit(limit)

    if (error) {
      console.error('[GET /api/angebote] Fehler:', error)
      return Response.json({ success: false, error: error.message }, { status: 500 })
    }

    const visible = currentUser.showTestData
      ? data ?? []
      : (data ?? []).filter((a: any) => a.contact?.is_test_data !== true)

    return Response.json({ success: true, data: visible })
  } catch (err) {
    console.error('[GET /api/angebote] Fehler:', err)
    return Response.json({ success: false, error: 'Angebote konnten nicht geladen werden' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return Response.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 })
    }

    const supabase = createServerClient()
    const body = await request.json()

    if (!body.contact_id || !String(body.name || '').trim()) {
      return Response.json(
        { success: false, error: 'Felder erforderlich: contact_id, name' },
        { status: 400 }
      )
    }

    const status = VALID_STATUSES.includes(String(body.status)) ? body.status : 'in_erstellung'
    const zyklus = VALID_ZYKLEN.includes(String(body.zyklus)) ? body.zyklus : null

    const angebotData = {
      contact_id: body.contact_id,
      name: String(body.name).trim(),
      status,
      betrag: body.betrag !== undefined && body.betrag !== '' ? Number(body.betrag) : null,
      zyklus,
      sparte: body.sparte ? String(body.sparte).trim() : null,
      leistungsumfang: body.leistungsumfang ? String(body.leistungsumfang).trim() : null,
      dokument_id: body.dokument_id || null,
      created_by: body.created_by && ['manuell', 'ki_upload', 'dokument_upload'].includes(body.created_by)
        ? body.created_by
        : 'manuell',
    }

    const { data, error } = await supabase
      .from('angebote')
      .insert([angebotData])
      .select(ANGEBOT_SELECT)
      .single()

    if (error) {
      console.error('[POST /api/angebote] Fehler:', error)
      return Response.json({ success: false, error: error.message }, { status: 500 })
    }

    const kontaktName = data.contact ? `${data.contact.first_name} ${data.contact.last_name}`.trim() : 'Kontakt'

    try {
      await logAngebotCreated(body.contact_id, kontaktName, angebotData.name, currentUser.id)

      // Neues Angebot hebt den Kontakt-Status mindestens auf "qualified" —
      // nie herabstufen (z.B. bestehender Kunde bleibt Kunde).
      const { data: kontakt } = await supabase
        .from('contacts')
        .select('status')
        .eq('id', body.contact_id)
        .single()
      const aktuellerRang = CONTACT_STATUS_RANG[kontakt?.status ?? 'new'] ?? 0
      if (aktuellerRang < CONTACT_STATUS_RANG.qualified) {
        await supabase.from('contacts').update({ status: 'qualified' }).eq('id', body.contact_id)
        await logStatusChanged(body.contact_id, kontaktName, kontakt?.status ?? 'new', 'qualified', currentUser.id)
      }
    } catch (logErr) {
      console.warn('[POST /api/angebote] Aktivität/Status-Automatik fehlgeschlagen:', logErr)
    }

    return Response.json({ success: true, data }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/angebote] Fehler:', err)
    return Response.json({ success: false, error: 'Angebot konnte nicht erstellt werden' }, { status: 500 })
  }
}
