// API Route: Einzelnes Angebot
// GET    /api/angebote/[id] — Angebot laden
// PATCH  /api/angebote/[id] — Angebot aktualisieren (inkl. Statuswechsel -> Kontakt-Automatik)
// DELETE /api/angebote/[id] — Angebot archivieren (Soft-Delete)
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { logAngebotStatusChanged, logStatusChanged } from '@/lib/activities-logger'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const VALID_STATUSES = ['in_erstellung', 'versendet', 'in_verhandlung', 'gewonnen', 'verloren']
const VALID_ZYKLEN = ['monatlich', 'vierteljaehrlich', 'halbjaehrlich', 'jaehrlich']
const ANGEBOT_SELECT =
  '*, contact:contact_id(id, first_name, last_name, is_test_data, assigned_user_id, assigned_user:assigned_user_id(id, name)), dokument:dokument_id(id, file_id, file_name)'

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return Response.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 })
    }
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('angebote')
      .select(ANGEBOT_SELECT)
      .eq('id', params.id)
      .single()

    if (error || !data) {
      return Response.json({ success: false, error: 'Angebot nicht gefunden' }, { status: 404 })
    }
    return Response.json({ success: true, data })
  } catch (err) {
    console.error('[GET /api/angebote/[id]] Fehler:', err)
    return Response.json({ success: false, error: 'Angebot konnte nicht geladen werden' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return Response.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 })
    }
    const supabase = createServerClient()
    const body = await request.json()

    const { data: bestehend, error: loadError } = await supabase
      .from('angebote')
      .select('*, contact:contact_id(id, first_name, last_name, status)')
      .eq('id', params.id)
      .single()

    if (loadError || !bestehend) {
      return Response.json({ success: false, error: 'Angebot nicht gefunden' }, { status: 404 })
    }

    const updates: Record<string, unknown> = {}
    if (body.name !== undefined) updates.name = String(body.name).trim()
    if (body.status !== undefined && VALID_STATUSES.includes(body.status)) updates.status = body.status
    if (body.betrag !== undefined) updates.betrag = body.betrag === '' ? null : Number(body.betrag)
    if (body.zyklus !== undefined) updates.zyklus = VALID_ZYKLEN.includes(body.zyklus) ? body.zyklus : null
    if (body.sparte !== undefined) updates.sparte = body.sparte ? String(body.sparte).trim() : null
    if (body.leistungsumfang !== undefined) {
      updates.leistungsumfang = body.leistungsumfang ? String(body.leistungsumfang).trim() : null
    }
    updates.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('angebote')
      .update(updates)
      .eq('id', params.id)
      .select(ANGEBOT_SELECT)
      .single()

    if (error) {
      console.error('[PATCH /api/angebote/[id]] Fehler:', error)
      return Response.json({ success: false, error: error.message }, { status: 500 })
    }

    // Status-Automatik: Statuswechsel loggen + Kontakt-Status synchronisieren
    if (updates.status && updates.status !== bestehend.status) {
      const kontaktName = bestehend.contact
        ? `${bestehend.contact.first_name} ${bestehend.contact.last_name}`.trim()
        : 'Kontakt'
      try {
        await logAngebotStatusChanged(
          bestehend.contact_id,
          kontaktName,
          data.name,
          bestehend.status,
          updates.status as string,
          currentUser.id
        )

        let neuerKontaktStatus: string | null = null
        if (updates.status === 'gewonnen') neuerKontaktStatus = 'customer'
        else if (updates.status === 'verloren') neuerKontaktStatus = 'not_interested'

        if (neuerKontaktStatus && bestehend.contact?.status !== neuerKontaktStatus) {
          await supabase.from('contacts').update({ status: neuerKontaktStatus }).eq('id', bestehend.contact_id)
          await logStatusChanged(
            bestehend.contact_id,
            kontaktName,
            bestehend.contact?.status ?? 'unbekannt',
            neuerKontaktStatus,
            currentUser.id
          )
        }
      } catch (logErr) {
        console.warn('[PATCH /api/angebote/[id]] Aktivität/Status-Automatik fehlgeschlagen:', logErr)
      }
    }

    return Response.json({ success: true, data })
  } catch (err) {
    console.error('[PATCH /api/angebote/[id]] Fehler:', err)
    return Response.json({ success: false, error: 'Angebot konnte nicht aktualisiert werden' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return Response.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 })
    }
    const supabase = createServerClient()
    const { error } = await supabase
      .from('angebote')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', params.id)

    if (error) {
      console.error('[DELETE /api/angebote/[id]] Fehler:', error)
      return Response.json({ success: false, error: error.message }, { status: 500 })
    }
    return Response.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/angebote/[id]] Fehler:', err)
    return Response.json({ success: false, error: 'Angebot konnte nicht archiviert werden' }, { status: 500 })
  }
}
