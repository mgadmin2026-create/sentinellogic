import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

type Params = { params: { id: string } }
type AmisTaskType = 'person_create' | 'person_create_quote'

const VALID_TASK_TYPES = new Set<AmisTaskType>(['person_create', 'person_create_quote'])

function formatGermanDate(value: unknown) {
  if (!value || typeof value !== 'string') return null
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[3]}.${iso[2]}.${iso[1]}`
  const german = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  return german ? value : null
}

function genderFromContact(contact: Record<string, any>) {
  const anrede = String(contact.anrede ?? '').toLowerCase()
  return {
    gender_male: anrede.includes('herr') || anrede === 'm',
    gender_female: anrede.includes('frau') || anrede === 'w',
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const supabase = createServerClient()
    const body = await request.json().catch(() => ({})) as { taskType?: AmisTaskType }
    const taskType = VALID_TASK_TYPES.has(body.taskType as AmisTaskType)
      ? body.taskType as AmisTaskType
      : 'person_create_quote'

    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', params.id)
      .single()

    if (contactError || !contact) {
      return Response.json({ success: false, error: 'Kontakt nicht gefunden' }, { status: 404 })
    }

    const gender = genderFromContact(contact)
    const birthDate = formatGermanDate(contact.geburtstag ?? contact.geburtstag_gf_inhaber ?? contact.birth_date)
    const phone = contact.phone_mobile ?? contact.phone_office ?? null
    const amisUsage = contact.amis_usage ?? 'privat'

    const missing: string[] = []
    if (!gender.gender_male && !gender.gender_female) missing.push('Anrede/Geschlecht')
    if (!contact.first_name) missing.push('Vorname')
    if (!contact.last_name) missing.push('Nachname')
    if (!birthDate) missing.push('Geburtsdatum')
    if (!contact.amis_identity_document_checked) missing.push('Identitätsprüfung per Dokument')
    if (!contact.street) missing.push('Straße')
    if (!contact.hausnummer) missing.push('Hausnummer')
    if (!contact.postal_code) missing.push('PLZ')
    if (!contact.city) missing.push('Stadt')
    if (!phone) missing.push('Telefonnummer')
    if (!contact.email) missing.push('E-Mail')
    if (amisUsage !== 'privat') missing.push('AMIS Verwendung privat')

    if (missing.length > 0) {
      return Response.json({
        success: false,
        error: `AMIS Pflichtdaten fehlen: ${missing.join(', ')}`,
        missing,
      }, { status: 400 })
    }

    const amisInput = {
      ...gender,
      birth_date: birthDate,
      street: contact.street,
      house_number: contact.hausnummer,
      postal_code: contact.postal_code,
      city: contact.city,
      country: contact.country ?? 'Deutschland',
      identity_document_checked: true,
      usage: amisUsage,
    }

    const title = taskType === 'person_create'
      ? 'AMIS NOW: Person anlegen'
      : 'AMIS NOW: Person anlegen + Angebot berechnen'

    const today = new Date().toISOString().split('T')[0]
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .insert({
        contact_id: params.id,
        titel: title,
        beschreibung: 'Automatisch erzeugte AMIS.NOW Aufgabe aus der Kontaktseite.',
        status: 'offen',
        priorität: 'hoch',
        fällig: today,
        triggered_by_process_step: 'amis_now',
        amis_task_type: taskType,
        amis_input: amisInput,
      })
      .select()
      .single()

    if (taskError) {
      console.error('[POST /api/kontakte/:id/amis-now] Task-Fehler:', taskError)
      return Response.json({ success: false, error: taskError.message }, { status: 500 })
    }

    await supabase.from('activities').insert({
      lead_id: params.id,
      type: 'task_created',
      description: `${title} erstellt`,
      data: {
        task_id: task.id,
        amis_task_type: taskType,
      },
    })

    return Response.json({ success: true, data: task }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/kontakte/:id/amis-now] Fehler:', err)
    return Response.json({ success: false, error: 'AMIS-Aufgabe konnte nicht erstellt werden' }, { status: 500 })
  }
}
