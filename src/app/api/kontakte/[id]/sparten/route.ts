// API Route: Sparten eines Kontakts
// GET /api/kontakte/[id]/sparten — zugeordnete Sparten inkl. Leitfaden + Primär-Kennzeichnung
// PUT /api/kontakte/[id]/sparten — kompletten Sparten-Satz ersetzen
//     Body: { sparteIds: string[], primarySparteId?: string }
//
// Hält contacts.sparte (die bisherige einzelne Text-Spalte) automatisch mit der
// primären Sparte synchron -- das ist der einzige Ort, der diese Spalte noch
// schreibt, und sorgt dafür, dass die bestehende Automatisierung (Dialfire,
// Facebook, Regeln), die weiterhin auf contacts.sparte basiert, unverändert
// funktioniert.
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('contact_sparte_map')
      .select('is_primary, sparte:sparte_id(id, name, leitfaden_titel, leitfaden_fragen, leitfaden_abschluss)')
      .eq('contact_id', params.id)

    if (error) {
      console.error('[GET /api/kontakte/[id]/sparten] Fehler:', error)
      return Response.json({ success: false, error: error.message }, { status: 500 })
    }

    return Response.json({ success: true, data: data ?? [] })
  } catch (err) {
    console.error('[GET /api/kontakte/[id]/sparten] Fehler:', err)
    return Response.json({ success: false, error: 'Sparten konnten nicht geladen werden' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient()
    const { id } = params
    const body = await request.json()
    const sparteIds: string[] = Array.isArray(body.sparteIds) ? body.sparteIds : []
    const primarySparteId: string | null = body.primarySparteId && sparteIds.includes(body.primarySparteId)
      ? body.primarySparteId
      : (sparteIds[0] ?? null)

    const { error: deleteError } = await supabase
      .from('contact_sparte_map')
      .delete()
      .eq('contact_id', id)

    if (deleteError) {
      console.error('[PUT /api/kontakte/[id]/sparten] Fehler beim Zurücksetzen:', deleteError)
      return Response.json({ success: false, error: deleteError.message }, { status: 500 })
    }

    if (sparteIds.length > 0) {
      const rows = sparteIds.map((sparteId) => ({
        contact_id: id,
        sparte_id: sparteId,
        is_primary: sparteId === primarySparteId,
      }))
      const { error: insertError } = await supabase.from('contact_sparte_map').insert(rows)

      if (insertError) {
        console.error('[PUT /api/kontakte/[id]/sparten] Fehler beim Setzen:', insertError)
        return Response.json({ success: false, error: insertError.message }, { status: 500 })
      }
    }

    // contacts.sparte mit der primären Sparte synchron halten (oder leeren,
    // falls keine Sparte mehr zugeordnet ist).
    let primarySparteName: string | null = null
    if (primarySparteId) {
      const { data: primarySparte } = await supabase
        .from('sparten')
        .select('name')
        .eq('id', primarySparteId)
        .single()
      primarySparteName = primarySparte?.name ?? null
    }

    const { error: syncError } = await supabase
      .from('contacts')
      .update({ sparte: primarySparteName })
      .eq('id', id)

    if (syncError) {
      console.error('[PUT /api/kontakte/[id]/sparten] Fehler beim Sync von contacts.sparte:', syncError)
    }

    const { data: sparteRows } = await supabase
      .from('contact_sparte_map')
      .select('is_primary, sparte:sparte_id(id, name, leitfaden_titel, leitfaden_fragen, leitfaden_abschluss)')
      .eq('contact_id', id)

    return Response.json({ success: true, data: sparteRows ?? [] })
  } catch (err) {
    console.error('[PUT /api/kontakte/[id]/sparten] Fehler:', err)
    return Response.json({ success: false, error: 'Sparten konnten nicht gespeichert werden' }, { status: 500 })
  }
}
