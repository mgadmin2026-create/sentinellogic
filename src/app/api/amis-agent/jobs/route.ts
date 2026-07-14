import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

function authorize(req: NextRequest) {
  const expected = process.env.AMIS_AGENT_TOKEN
  const header = req.headers.get('authorization') ?? ''
  return Boolean(expected) && header === `Bearer ${expected}`
}

function agentId(req: NextRequest) {
  return req.headers.get('x-agent-id')?.slice(0, 120) || 'amis-now-agent'
}

async function logActivity(supabase: ReturnType<typeof createServerClient>, contactId: string | null, description: string, data: Record<string, unknown> = {}) {
  if (!contactId) return
  await supabase.from('activities').insert({
    lead_id: contactId,
    type: 'status_change',
    description,
    data,
  })
}

export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createServerClient()

    const { data: candidate, error: selectError } = await supabase
      .from('tasks')
      .select(`
        *,
        contact:contact_id(id, first_name, last_name, email, phone_mobile, phone_office, city, postal_code)
      `)
      .eq('status', 'offen')
      .eq('triggered_by_process_step', 'amis_now')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (selectError) {
      console.error('[POST /api/amis-agent/jobs] Auswahlfehler:', selectError)
      return Response.json({ success: false, error: selectError.message }, { status: 500 })
    }

    if (!candidate) {
      return Response.json({ success: true, job: null })
    }

    const now = new Date().toISOString()
    const { data: claimed, error: claimError } = await supabase
      .from('tasks')
      .update({
        status: 'in_bearbeitung',
        amis_agent_id: agentId(req),
        amis_claimed_at: now,
        amis_error: null,
      })
      .eq('id', candidate.id)
      .eq('status', 'offen')
      .select(`
        *,
        contact:contact_id(id, first_name, last_name, email, phone_mobile, phone_office, city, postal_code)
      `)
      .maybeSingle()

    if (claimError) {
      console.error('[POST /api/amis-agent/jobs] Claim-Fehler:', claimError)
      return Response.json({ success: false, error: claimError.message }, { status: 500 })
    }

    if (!claimed) {
      return Response.json({ success: false, error: 'Job already claimed' }, { status: 409 })
    }

    const metadata = (claimed.amis_input ?? {}) as Record<string, unknown>
    const taskType = claimed.amis_task_type ?? 'person_create_quote'
    const contact = claimed.contact ?? {}

    const job = {
      id: claimed.id,
      title: claimed.titel,
      description: claimed.beschreibung,
      amis_task_type: taskType,
      amis_input: metadata,
      customer: {
        id: contact.id,
        first_name: contact.first_name,
        last_name: contact.last_name,
        email: contact.email,
        phone: contact.phone_mobile ?? contact.phone_office,
        city: contact.city,
        postal_code: contact.postal_code,
      },
    }

    await logActivity(supabase, claimed.contact_id, `AMIS-Agent hat Aufgabe übernommen: ${claimed.titel}`, {
      task_id: claimed.id,
      agent_id: agentId(req),
      amis_task_type: taskType,
    })

    return Response.json({ success: true, job })
  } catch (err) {
    console.error('[POST /api/amis-agent/jobs] Fehler:', err)
    return Response.json({ success: false, error: 'AMIS-Job konnte nicht übernommen werden' }, { status: 500 })
  }
}
