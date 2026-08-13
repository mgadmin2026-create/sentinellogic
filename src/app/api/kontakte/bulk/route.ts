import { getCurrentUser } from '@/lib/auth'
import { executeStatusAutomations } from '@/lib/automation-engine'
import { syncStoredContactToKlickTipp } from '@/lib/klicktipp-sync'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const maxDuration = 300

const MAX_CONTACTS = 500
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const VALID_STATUSES = ['new', 'contacted', 'qualified', 'customer', 'not_interested']
const VALID_CONTACT_TYPES = ['privat', 'gewerbe']
const VALID_FIELDS = ['status', 'assigned_user_id', 'kontakt_typ', 'tags', 'sparten', 'archive'] as const
const VALID_MODES = ['set', 'add', 'remove'] as const

type BulkField = typeof VALID_FIELDS[number]
type BulkMode = typeof VALID_MODES[number]

interface BulkRequest {
  contactIds?: unknown
  field?: unknown
  mode?: unknown
  value?: unknown
  archiveTasks?: unknown
  requestId?: unknown
}

export async function PATCH(request: Request) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return Response.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 })
  }

  const body = await request.json().catch(() => null) as BulkRequest | null
  const contactIds = Array.from(new Set(
    Array.isArray(body?.contactIds)
      ? body.contactIds.filter((id): id is string => typeof id === 'string' && UUID_PATTERN.test(id))
      : []
  ))
  const field = VALID_FIELDS.includes(body?.field as BulkField) ? body?.field as BulkField : null
  const mode = VALID_MODES.includes(body?.mode as BulkMode) ? body?.mode as BulkMode : null

  if (contactIds.length === 0 || contactIds.length > MAX_CONTACTS) {
    return Response.json({ success: false, error: `Bitte 1 bis ${MAX_CONTACTS} gültige Kontakte auswählen` }, { status: 400 })
  }
  if (!field || !mode) {
    return Response.json({ success: false, error: 'Ungültige Sammelaktion' }, { status: 400 })
  }

  const validationError = validateAction(field, mode, body?.value)
  if (validationError) {
    return Response.json({ success: false, error: validationError }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data: contacts, error: contactsError } = await supabase
    .from('contacts')
    .select('*')
    .in('id', contactIds)

  if (contactsError) {
    console.error('[Kontakte Sammelbearbeitung] Kontakte konnten nicht geladen werden')
    return Response.json({ success: false, error: 'Kontakte konnten nicht geladen werden' }, { status: 500 })
  }

  const contactsById = new Map((contacts ?? []).map((contact) => [contact.id, contact]))
  const result = { requested: contactIds.length, updated: 0, unchanged: 0, skipped: 0, failed: 0 }
  const errors: Array<{ contactId: string; error: string }> = []

  for (const contactId of contactIds) {
    const contact = contactsById.get(contactId)
    if (!contact) {
      result.skipped += 1
      errors.push({ contactId, error: 'Kontakt nicht gefunden' })
      continue
    }

    try {
      const outcome = await applyAction({
        supabase,
        contact,
        field,
        mode,
        value: body?.value,
        archiveTasks: body?.archiveTasks === true,
        userId: currentUser.id,
        requestId: typeof body?.requestId === 'string' ? body.requestId.slice(0, 100) : null,
      })
      if (outcome === 'updated') result.updated += 1
      else result.unchanged += 1
    } catch (error) {
      result.failed += 1
      errors.push({
        contactId,
        error: error instanceof Error ? error.message : 'Unbekannter Fehler',
      })
      console.error('[Kontakte Sammelbearbeitung] Einzelkontakt konnte nicht aktualisiert werden', {
        field,
      })
    }
  }

  return Response.json({ success: result.failed === 0, data: result, errors })
}

function validateAction(field: BulkField, mode: BulkMode, value: unknown): string | null {
  if (field === 'status') {
    if (mode !== 'set' || typeof value !== 'string' || !VALID_STATUSES.includes(value)) return 'Ungültiger Status'
  } else if (field === 'assigned_user_id') {
    if (!['set', 'remove'].includes(mode)) return 'Ungültige Verantwortlichkeits-Aktion'
    if (mode === 'set' && (typeof value !== 'string' || !UUID_PATTERN.test(value))) return 'Ungültiges Teammitglied'
  } else if (field === 'kontakt_typ') {
    if (mode !== 'set' || typeof value !== 'string' || !VALID_CONTACT_TYPES.includes(value)) return 'Ungültiger Kontakttyp'
  } else if (field === 'tags' || field === 'sparten') {
    if (!['add', 'remove'].includes(mode)) return 'Bitte Hinzufügen oder Entfernen wählen'
    if (typeof value !== 'string' || !UUID_PATTERN.test(value)) return 'Ungültiger Wert'
  } else if (field === 'archive' && mode !== 'set') {
    return 'Ungültige Archivierungsaktion'
  }
  return null
}

async function applyAction({
  supabase,
  contact,
  field,
  mode,
  value,
  archiveTasks,
  userId,
  requestId,
}: {
  supabase: ReturnType<typeof createServerClient>
  contact: Record<string, any>
  field: BulkField
  mode: BulkMode
  value: unknown
  archiveTasks: boolean
  userId: string
  requestId: string | null
}): Promise<'updated' | 'unchanged'> {
  if (field !== 'archive' && contact.archived_at) return 'unchanged'

  if (field === 'tags' || field === 'sparten') {
    const relationTable = field === 'tags' ? 'contact_tag_map' : 'contact_sparte_map'
    const relationColumn = field === 'tags' ? 'tag_id' : 'sparte_id'
    const { data: existingRelation, error: relationError } = await supabase
      .from(relationTable)
      .select('contact_id')
      .eq('contact_id', contact.id)
      .eq(relationColumn, value)
      .maybeSingle()
    if (relationError) throw new Error(`${field === 'tags' ? 'Tag' : 'Sparte'} konnte nicht geprüft werden`)
    if ((mode === 'add' && existingRelation) || (mode === 'remove' && !existingRelation)) return 'unchanged'

    if (mode === 'add') {
      const { error } = field === 'tags'
        ? await supabase.from('contact_tag_map').upsert(
            { contact_id: contact.id, tag_id: value },
            { onConflict: 'contact_id,tag_id', ignoreDuplicates: true }
          )
        : await supabase.from('contact_sparte_map').upsert(
            { contact_id: contact.id, sparte_id: value, is_primary: false },
            { onConflict: 'contact_id,sparte_id', ignoreDuplicates: true }
          )
      if (error) throw new Error(`${field === 'tags' ? 'Tag' : 'Sparte'} konnte nicht hinzugefügt werden`)
    } else {
      const { error } = field === 'tags'
        ? await supabase.from('contact_tag_map').delete().eq('contact_id', contact.id).eq('tag_id', value)
        : await supabase.from('contact_sparte_map').delete().eq('contact_id', contact.id).eq('sparte_id', value)
      if (error) throw new Error(`${field === 'tags' ? 'Tag' : 'Sparte'} konnte nicht entfernt werden`)
    }
    await logBulkActivity(supabase, contact.id, userId, field, mode, requestId)
    return 'updated'
  }

  if (field === 'archive') {
    if (contact.archived_at) return 'unchanged'
    const { error } = await supabase.from('contacts').update({ archived_at: new Date().toISOString() }).eq('id', contact.id)
    if (error) throw new Error('Kontakt konnte nicht archiviert werden')
    if (archiveTasks) {
      const { error: taskError } = await supabase
        .from('tasks')
        .update({ archived_at: new Date().toISOString() })
        .eq('contact_id', contact.id)
        .is('archived_at', null)
      if (taskError) throw new Error('Kontakt wurde archiviert, Aufgaben jedoch nicht')
    }
    await logBulkActivity(supabase, contact.id, userId, field, mode, requestId, { archive_tasks: archiveTasks })
    return 'updated'
  }

  const nextValue = field === 'assigned_user_id' && mode === 'remove' ? null : value
  if (contact[field] === nextValue) return 'unchanged'
  const { data: updatedContact, error } = await supabase
    .from('contacts')
    .update({ [field]: nextValue })
    .eq('id', contact.id)
    .select('*')
    .single()
  if (error) throw new Error('Kontakt konnte nicht aktualisiert werden')

  await logBulkActivity(supabase, contact.id, userId, field, mode, requestId)
  if (field === 'status') {
    await executeStatusAutomations(contact.id, String(nextValue))
  }
  if ((field === 'status' || field === 'kontakt_typ') && updatedContact.email) {
    const syncResult = await syncStoredContactToKlickTipp(supabase, updatedContact)
    if (syncResult.status === 'failed') {
      // Die fachliche Änderung ist bereits gespeichert. Ein externer Fehler darf
      // sie im Ergebnis nicht fälschlich als fehlgeschlagen darstellen; der
      // KlickTipp-Sync protokolliert seinen eigenen Fehler für einen späteren Retry.
      console.warn('[Kontakte Sammelbearbeitung] KlickTipp-Synchronisation nach Änderung fehlgeschlagen', {
        field,
      })
    }
  }
  return 'updated'
}

async function logBulkActivity(
  supabase: ReturnType<typeof createServerClient>,
  contactId: string,
  userId: string,
  field: BulkField,
  mode: BulkMode,
  requestId: string | null,
  extra: Record<string, unknown> = {}
) {
  const labels: Record<BulkField, string> = {
    status: 'Status',
    assigned_user_id: 'Verantwortlichkeit',
    kontakt_typ: 'Kontakttyp',
    tags: 'Tags',
    sparten: 'Sparten',
    archive: 'Archivierung',
  }
  const { error } = await supabase.from('activities').insert({
    lead_id: contactId,
    type: 'bulk_edit',
    description: `Sammelbearbeitung: ${labels[field]} geändert`,
    user_id: userId,
    data: { field, mode, request_id: requestId, ...extra },
  })
  if (error) console.warn('[Kontakte Sammelbearbeitung] Aktivität konnte nicht protokolliert werden')
}
