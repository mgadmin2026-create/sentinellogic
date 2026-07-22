// POST /api/kontakte/[id]/email — E-Mail an einen Kontakt senden (Resend)
// Unterstützt Cc/Bcc und Datei-Anhänge; Anhänge werden zusätzlich zum
// Versand automatisch im Kontakt unter Dokumente abgelegt (Google Drive).
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { sendContactEmail, type ContactEmailAttachment } from '@/lib/contact-email'
import { uploadDocumentToGoogleDrive } from '@/lib/google-drive-oauth'
import { logActivity, logFileUploaded } from '@/lib/activities-logger'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Resend erlaubt max. 40MB pro E-Mail — Puffer für Body/Headers/Base64-Overhead einkalkuliert
const MAX_TOTAL_ATTACHMENT_BYTES = 35 * 1024 * 1024

function parseEmailList(raw: FormDataEntryValue | null): { valid: string[]; invalid: string[] } {
  const str = typeof raw === 'string' ? raw : ''
  if (!str.trim()) return { valid: [], invalid: [] }
  const parts = str.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
  const valid: string[] = []
  const invalid: string[] = []
  for (const p of parts) {
    if (EMAIL_RE.test(p)) valid.push(p)
    else invalid.push(p)
  }
  return { valid, invalid }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const formData = await request.formData()

    const to = String(formData.get('to') || '').trim()
    const subject = String(formData.get('subject') || '').trim()
    const text = String(formData.get('body') || '').trim()

    if (!EMAIL_RE.test(to)) {
      return Response.json({ success: false, error: 'Ungültige Empfänger-Adresse' }, { status: 400 })
    }
    if (!subject) {
      return Response.json({ success: false, error: 'Betreff fehlt' }, { status: 400 })
    }
    if (!text) {
      return Response.json({ success: false, error: 'Nachricht fehlt' }, { status: 400 })
    }

    const cc = parseEmailList(formData.get('cc'))
    if (cc.invalid.length > 0) {
      return Response.json({ success: false, error: `Ungültige Cc-Adresse(n): ${cc.invalid.join(', ')}` }, { status: 400 })
    }
    const bcc = parseEmailList(formData.get('bcc'))
    if (bcc.invalid.length > 0) {
      return Response.json({ success: false, error: `Ungültige Bcc-Adresse(n): ${bcc.invalid.join(', ')}` }, { status: 400 })
    }

    const files = formData.getAll('attachments').filter((f): f is File => f instanceof File && f.size > 0)
    const totalSize = files.reduce((sum, f) => sum + f.size, 0)
    if (totalSize > MAX_TOTAL_ATTACHMENT_BYTES) {
      return Response.json(
        { success: false, error: `Anhänge zu groß (${(totalSize / 1024 / 1024).toFixed(1)} MB, max. ${MAX_TOTAL_ATTACHMENT_BYTES / 1024 / 1024} MB)` },
        { status: 400 }
      )
    }

    // Kontakt prüfen
    const supabase = createServerClient()
    const { data: contact, error: fetchError } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, google_drive_ordner_id')
      .eq('id', id)
      .single()

    if (fetchError || !contact) {
      return Response.json({ success: false, error: 'Kontakt nicht gefunden' }, { status: 404 })
    }

    // Anhänge einmal puffern — werden für Versand UND Dokumenten-Ablage gebraucht
    const buffered = await Promise.all(
      files.map(async (f) => ({
        filename: f.name,
        content: Buffer.from(await f.arrayBuffer()),
        contentType: f.type || 'application/octet-stream',
      }))
    )

    const attachments: ContactEmailAttachment[] = buffered.map((b) => ({
      filename: b.filename,
      content: b.content,
      contentType: b.contentType,
    }))

    const result = await sendContactEmail({ to, cc: cc.valid, bcc: bcc.valid, subject, body: text, attachments })

    if (!result.ok) {
      await logActivity(null, id, 'email_failed', `E-Mail an ${to} fehlgeschlagen: ${result.error || 'Unbekannter Fehler'}`, {
        to,
        cc: cc.valid,
        bcc: bcc.valid,
        subject,
      })
      return Response.json({ success: false, error: result.error || 'Versand fehlgeschlagen' }, { status: 500 })
    }

    // Anhänge in Dokumente ablegen — erst NACH erfolgreichem Versand, damit ein
    // Drive-Fehler die E-Mail nicht blockiert. Ablage-Fehler geben nur eine Warnung zurück.
    const kontaktName = `${contact.first_name} ${contact.last_name}`.trim()
    const currentUser = await getCurrentUser()
    let filingWarning: string | null = null

    for (const b of buffered) {
      try {
        const uploadResult = await uploadDocumentToGoogleDrive(
          b.content,
          b.filename,
          b.contentType,
          id,
          contact.first_name || '',
          contact.last_name || '',
          'Sonstiges'
        )

        if (contact.google_drive_ordner_id !== uploadResult.kontaktOrdnerId) {
          await supabase.from('contacts').update({ google_drive_ordner_id: uploadResult.kontaktOrdnerId }).eq('id', id)
        }

        await supabase.from('dokumente_metadata').insert({
          kontakt_id: id,
          ordner_id: uploadResult.ordnerId,
          ordner_name: uploadResult.ordnerName,
          kategorie: uploadResult.kategorie,
          file_id: uploadResult.fileId,
          file_name: uploadResult.fileName,
          file_type: b.contentType,
          original_size: uploadResult.originalSize,
          compressed_size: uploadResult.compressedSize,
          compression_ratio: uploadResult.compressionRatio,
          created_by: 'email',
        })

        await supabase.rpc('update_kontakt_dokumente_stats', { p_kontakt_id: id })
        await logFileUploaded(id, kontaktName, b.filename, 'als E-Mail-Anhang gesendet', currentUser?.id)
      } catch (err) {
        console.error('[POST /api/kontakte/[id]/email] Anhang-Ablage fehlgeschlagen:', err)
        filingWarning = `Anhang „${b.filename}" konnte nicht in Dokumente abgelegt werden (E-Mail wurde trotzdem versendet).`
      }
    }

    await logActivity(
      null,
      id,
      'email_sent',
      `E-Mail gesendet an ${to}${cc.valid.length ? `, Cc: ${cc.valid.join(', ')}` : ''}: ${subject}`,
      { to, cc: cc.valid, bcc: bcc.valid, subject, attachments: buffered.map((b) => b.filename) }
    )

    return Response.json({ success: true, filingWarning })
  } catch (err) {
    console.error('[POST /api/kontakte/[id]/email] Fehler:', err)
    return Response.json(
      { success: false, error: err instanceof Error ? err.message : 'Unbekannter Fehler' },
      { status: 500 }
    )
  }
}
