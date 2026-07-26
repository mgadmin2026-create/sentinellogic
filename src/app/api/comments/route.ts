// API Route: Kommentare mit @-Erwähnungen für Aufgaben und Kontakte
// GET  /api/comments?entity_type=task|contact&entity_id=... — Verlauf laden
// POST /api/comments — Kommentar anlegen (FormData: entity_type, entity_id,
//      body, mentioned_user_ids (JSON-Array), mention_all ('true'|'false'),
//      attachments (Dateien, optional))
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { uploadDocumentToGoogleDrive } from '@/lib/google-drive-oauth'
import { notifyMention } from '@/lib/mention-notify'

const VALID_ENTITY_TYPES = ['task', 'contact']
const MAX_TOTAL_ATTACHMENT_BYTES = 35 * 1024 * 1024
const isValidUUID = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

export async function GET(request: NextRequest) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return Response.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 })
  }

  const url = new URL(request.url)
  const entityType = url.searchParams.get('entity_type')
  const entityId = url.searchParams.get('entity_id')

  if (!entityType || !VALID_ENTITY_TYPES.includes(entityType) || !entityId || !isValidUUID(entityId)) {
    return Response.json({ success: false, error: 'entity_type und entity_id (gültige UUID) erforderlich' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data: comments, error } = await supabase
    .from('comments')
    .select('*, author:author_user_id(name)')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[GET /api/comments] Fehler:', error)
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }

  const commentIds = (comments ?? []).map((c) => c.id)
  let mentionsByComment: Record<string, { name: string }[]> = {}
  let attachmentsByComment: Record<string, { id: string; file_name: string; file_size: number | null; dokument_id: string | null; file_id: string | null }[]> = {}

  if (commentIds.length > 0) {
    const { data: mentions } = await supabase
      .from('comment_mentions')
      .select('comment_id, mentioned_user:mentioned_user_id(name)')
      .in('comment_id', commentIds)
    for (const m of mentions ?? []) {
      const list = mentionsByComment[(m as any).comment_id] ?? []
      list.push({ name: (m as any).mentioned_user?.name ?? 'Unbekannt' })
      mentionsByComment[(m as any).comment_id] = list
    }

    const { data: attachments } = await supabase
      .from('comment_attachments')
      .select('id, comment_id, file_name, file_size, dokument_id, dokument:dokument_id(file_id)')
      .in('comment_id', commentIds)
    for (const a of attachments ?? []) {
      const list = attachmentsByComment[a.comment_id] ?? []
      list.push({
        id: a.id,
        file_name: a.file_name,
        file_size: a.file_size,
        dokument_id: a.dokument_id,
        file_id: (a as any).dokument?.file_id ?? null,
      })
      attachmentsByComment[a.comment_id] = list
    }
  }

  const data = (comments ?? []).map((c) => ({
    ...c,
    mentions: mentionsByComment[c.id] ?? [],
    attachments: attachmentsByComment[c.id] ?? [],
  }))

  return Response.json({ success: true, data })
}

export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return Response.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 })
  }

  const formData = await request.formData()
  const entityType = String(formData.get('entity_type') || '')
  const entityId = String(formData.get('entity_id') || '')
  const body = String(formData.get('body') || '').trim()
  const mentionAll = formData.get('mention_all') === 'true'
  let mentionedUserIds: string[] = []
  try {
    mentionedUserIds = JSON.parse(String(formData.get('mentioned_user_ids') || '[]'))
  } catch {
    mentionedUserIds = []
  }

  if (!entityType || !VALID_ENTITY_TYPES.includes(entityType) || !entityId || !isValidUUID(entityId)) {
    return Response.json({ success: false, error: 'entity_type und entity_id (gültige UUID) erforderlich' }, { status: 400 })
  }
  if (!body) {
    return Response.json({ success: false, error: 'Kommentartext fehlt' }, { status: 400 })
  }

  const files = formData.getAll('attachments').filter((f): f is File => f instanceof File && f.size > 0)
  const totalSize = files.reduce((sum, f) => sum + f.size, 0)
  if (totalSize > MAX_TOTAL_ATTACHMENT_BYTES) {
    return Response.json(
      { success: false, error: `Anhänge zu groß (${(totalSize / 1024 / 1024).toFixed(1)} MB, max. ${MAX_TOTAL_ATTACHMENT_BYTES / 1024 / 1024} MB)` },
      { status: 400 }
    )
  }

  const supabase = createServerClient()

  // Entität auflösen: Label für Benachrichtigungen + Kontakt-Bezug für Datei-Anhänge
  let entityLabel = ''
  let entityUrl = ''
  let contactIdForAttachments: string | null = null
  let contactFirstName = ''
  let contactLastName = ''

  if (entityType === 'contact') {
    const { data: contact, error: contactErr } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, google_drive_ordner_id')
      .eq('id', entityId)
      .single()
    if (contactErr || !contact) {
      return Response.json({ success: false, error: 'Kontakt nicht gefunden' }, { status: 404 })
    }
    entityLabel = `${contact.first_name} ${contact.last_name}`.trim()
    entityUrl = `/kontakte/${entityId}`
    contactIdForAttachments = contact.id
    contactFirstName = contact.first_name || ''
    contactLastName = contact.last_name || ''
  } else {
    const { data: task, error: taskErr } = await supabase
      .from('tasks')
      .select('id, titel, contact_id, contact:contact_id(first_name, last_name)')
      .eq('id', entityId)
      .single()
    if (taskErr || !task) {
      return Response.json({ success: false, error: 'Aufgabe nicht gefunden' }, { status: 404 })
    }
    entityLabel = `Aufgabe: ${task.titel}`
    entityUrl = task.contact_id ? `/kontakte/${task.contact_id}` : '/aufgaben'
    contactIdForAttachments = task.contact_id
    contactFirstName = (task.contact as any)?.first_name || ''
    contactLastName = (task.contact as any)?.last_name || ''
  }

  if (files.length > 0 && !contactIdForAttachments) {
    return Response.json(
      { success: false, error: 'Datei-Anhänge sind nur möglich, wenn die Aufgabe einem Kontakt zugeordnet ist.' },
      { status: 400 }
    )
  }

  // Kommentar anlegen
  const { data: comment, error: insertError } = await supabase
    .from('comments')
    .insert({ entity_type: entityType, entity_id: entityId, author_user_id: currentUser.id, body })
    .select()
    .single()

  if (insertError) {
    console.error('[POST /api/comments] Fehler:', insertError)
    return Response.json({ success: false, error: insertError.message }, { status: 500 })
  }

  // Mentions auflösen — "Alle" wird zu Einzel-Erwähnungen pro aktivem User (außer Autor)
  let resolvedMentionIds: string[] = []
  if (mentionAll) {
    const { data: activeUsers } = await supabase.from('users').select('id').eq('active', true)
    resolvedMentionIds = (activeUsers ?? []).map((u) => u.id).filter((id) => id !== currentUser.id)
  } else {
    resolvedMentionIds = Array.from(new Set(mentionedUserIds)).filter((id) => isValidUUID(id) && id !== currentUser.id)
  }

  if (resolvedMentionIds.length > 0) {
    await supabase.from('comment_mentions').insert(
      resolvedMentionIds.map((mentioned_user_id) => ({ comment_id: comment.id, mentioned_user_id }))
    )
  }

  // Datei-Anhänge: hochladen + als Dokument beim Kontakt ablegen
  let attachmentWarning: string | null = null
  if (files.length > 0 && contactIdForAttachments) {
    const { data: contactRow } = await supabase
      .from('contacts')
      .select('google_drive_ordner_id')
      .eq('id', contactIdForAttachments)
      .single()

    for (const file of files) {
      try {
        const buffer = Buffer.from(await file.arrayBuffer())
        const uploadResult = await uploadDocumentToGoogleDrive(
          buffer,
          file.name,
          file.type || 'application/octet-stream',
          contactIdForAttachments,
          contactFirstName,
          contactLastName,
          'Sonstiges'
        )

        if (contactRow && contactRow.google_drive_ordner_id !== uploadResult.kontaktOrdnerId) {
          await supabase.from('contacts').update({ google_drive_ordner_id: uploadResult.kontaktOrdnerId }).eq('id', contactIdForAttachments)
        }

        const { data: dokument } = await supabase
          .from('dokumente_metadata')
          .insert({
            kontakt_id: contactIdForAttachments,
            ordner_id: uploadResult.ordnerId,
            ordner_name: uploadResult.ordnerName,
            kategorie: uploadResult.kategorie,
            file_id: uploadResult.fileId,
            file_name: uploadResult.fileName,
            file_type: file.type,
            original_size: uploadResult.originalSize,
            compressed_size: uploadResult.compressedSize,
            compression_ratio: uploadResult.compressionRatio,
            created_by: 'comment',
          })
          .select()
          .single()

        await supabase.rpc('update_kontakt_dokumente_stats', { p_kontakt_id: contactIdForAttachments })

        await supabase.from('comment_attachments').insert({
          comment_id: comment.id,
          dokument_id: dokument?.id ?? null,
          file_name: file.name,
          file_size: file.size,
        })
      } catch (err) {
        console.error('[POST /api/comments] Anhang fehlgeschlagen:', err)
        attachmentWarning = `Anhang „${file.name}" konnte nicht abgelegt werden.`
      }
    }
  }

  // Benachrichtigung: eine Mail pro erwähnter Person
  if (resolvedMentionIds.length > 0) {
    const { data: mentionedUsers } = await supabase
      .from('users')
      .select('id, email')
      .in('id', resolvedMentionIds)

    const excerpt = body.length > 240 ? `${body.slice(0, 240)}…` : body
    await Promise.all(
      (mentionedUsers ?? []).map((u) =>
        notifyMention({
          to: u.email,
          mentionedByName: currentUser.name,
          entityLabel,
          entityUrl,
          commentExcerpt: excerpt,
        })
      )
    )
  }

  return Response.json({ success: true, data: comment, attachmentWarning }, { status: 201 })
}
