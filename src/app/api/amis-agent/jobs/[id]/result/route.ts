import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

type Params = { params: { id: string } }

function authorize(req: NextRequest) {
  const expected = process.env.AMIS_AGENT_TOKEN
  const header = req.headers.get('authorization') ?? ''
  return Boolean(expected) && header === `Bearer ${expected}`
}

function cleanString(value: unknown, max = 2000) {
  return typeof value === 'string' ? value.slice(0, max) : null
}

export async function POST(req: NextRequest, { params }: Params) {
  if (!authorize(req)) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null) as {
    status?: 'person_created' | 'quoted' | 'error'
    premium?: unknown
    quoteNumber?: unknown
    screenshotPath?: unknown
    error?: unknown
  } | null

  if (!body || !['person_created', 'quoted', 'error'].includes(body.status ?? '')) {
    return Response.json({ success: false, error: 'status must be person_created, quoted or error' }, { status: 400 })
  }

  try {
    const supabase = createServerClient()
    const taskStatus = body.status === 'error' ? 'offen' : 'erledigt'
    const update = {
      status: taskStatus,
      amis_status: body.status,
      amis_premium: cleanString(body.premium, 200),
      amis_quote_number: cleanString(body.quoteNumber, 200),
      amis_screenshot_path: cleanString(body.screenshotPath, 1000),
      amis_error: body.status === 'error' ? cleanString(body.error, 2000) : null,
      amis_processed_at: new Date().toISOString(),
      erledigt_am: body.status === 'error' ? null : new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('tasks')
      .update(update)
      .eq('id', params.id)
      .eq('status', 'in_bearbeitung')
      .select('id, contact_id, titel')
      .maybeSingle()

    if (error) {
      console.error('[POST /api/amis-agent/jobs/:id/result] Update-Fehler:', error)
      return Response.json({ success: false, error: error.message }, { status: 500 })
    }

    if (!data) {
      return Response.json({ success: false, error: 'No processing job found for this id' }, { status: 409 })
    }

    const description = body.status === 'quoted'
      ? `AMIS-Angebot berechnet. Angebotsnummer: ${update.amis_quote_number ?? 'unbekannt'}, Beitrag: ${update.amis_premium ?? 'unbekannt'}.`
      : body.status === 'person_created'
      ? 'AMIS-Person angelegt.'
      : `AMIS-Agent Fehler: ${update.amis_error ?? 'Unbekannter Fehler'}.`

    await supabase.from('activities').insert({
      lead_id: data.contact_id,
      type: body.status === 'error' ? 'status_change' : 'task_completed',
      description,
      data: {
        task_id: data.id,
        amis_status: body.status,
        screenshot_path: update.amis_screenshot_path,
      },
    })

    return Response.json({ success: true })
  } catch (err) {
    console.error('[POST /api/amis-agent/jobs/:id/result] Fehler:', err)
    return Response.json({ success: false, error: 'AMIS-Ergebnis konnte nicht gespeichert werden' }, { status: 500 })
  }
}
