// API Route: Einmalige Bereinigung — Dokumente, deren Datei in Google Drive
// nicht mehr existiert (z.B. weil eine frühere Löschung am inzwischen
// behobenen Fehler in DELETE /api/kontakte/[id]/dokumente hängen blieb: der
// Drive-Aufruf lief bereits durch, aber der DB-Soft-Delete kam nie an).
// GET  — Trockenlauf: zeigt, welche Zeilen betroffen wären
// POST — führt die Bereinigung aus (ordner_archived=true für betroffene Zeilen)
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { isAdmin } from '@/lib/roles'
import { fileExistsInGoogleDrive } from '@/lib/google-drive-oauth'

async function findOrphaned() {
  const supabase = createServerClient()

  const { data: dokumente, error } = await supabase
    .from('dokumente_metadata')
    .select('id, file_id, file_name, kontakt_id')
    .eq('ordner_archived', false)

  if (error) throw new Error(error.message)

  const kontaktIds = Array.from(new Set((dokumente ?? []).map((d) => d.kontakt_id).filter(Boolean)))
  const { data: contacts } = kontaktIds.length
    ? await supabase.from('contacts').select('id, first_name, last_name').in('id', kontaktIds)
    : { data: [] as Array<{ id: string; first_name: string; last_name: string }> }
  const nameById = new Map((contacts ?? []).map((c) => [c.id, `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim()]))

  const orphaned: Array<{ id: string; file_name: string; kontakt_name: string; error?: string }> = []

  for (const dok of dokumente ?? []) {
    const kontaktName = nameById.get(dok.kontakt_id) || '(gelöschter Kontakt)'
    try {
      const exists = await fileExistsInGoogleDrive(dok.file_id)
      if (!exists) {
        orphaned.push({ id: dok.id, file_name: dok.file_name, kontakt_name: kontaktName })
      }
    } catch (err) {
      // Existenzprüfung selbst fehlgeschlagen (z.B. Drive kurzzeitig nicht
      // erreichbar) — nicht als "nicht vorhanden" werten, nur melden.
      orphaned.push({
        id: dok.id,
        file_name: dok.file_name,
        kontakt_name: kontaktName,
        error: err instanceof Error ? err.message : 'Prüfung fehlgeschlagen',
      })
    }
  }

  return { totalChecked: dokumente?.length ?? 0, orphaned }
}

export async function GET() {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || !isAdmin(currentUser.role)) {
      return NextResponse.json({ success: false, error: 'Nur für Admins' }, { status: 403 })
    }

    const { totalChecked, orphaned } = await findOrphaned()
    return NextResponse.json({
      success: true,
      totalChecked,
      orphanedCount: orphaned.filter((o) => !o.error).length,
      checkErrors: orphaned.filter((o) => o.error).length,
      orphaned,
    })
  } catch (err) {
    console.error('[GET /api/dokumente/reconcile]', err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}

export async function POST() {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || !isAdmin(currentUser.role)) {
      return NextResponse.json({ success: false, error: 'Nur für Admins' }, { status: 403 })
    }

    const supabase = createServerClient()
    const { totalChecked, orphaned } = await findOrphaned()

    const toArchive = orphaned.filter((o) => !o.error)
    const failed = orphaned.filter((o) => o.error)

    if (toArchive.length > 0) {
      const { error } = await supabase
        .from('dokumente_metadata')
        .update({ ordner_archived: true, kontakt_deleted_at: new Date().toISOString() })
        .in('id', toArchive.map((o) => o.id))

      if (error) throw new Error(error.message)

      // Kontakt-Statistiken für betroffene Kontakte aktualisieren
      const { data: rows } = await supabase
        .from('dokumente_metadata')
        .select('kontakt_id')
        .in('id', toArchive.map((o) => o.id))
      const kontaktIds = Array.from(new Set((rows ?? []).map((r) => r.kontakt_id)))
      await Promise.all(
        kontaktIds.map((id) => supabase.rpc('update_kontakt_dokumente_stats', { p_kontakt_id: id }))
      )
    }

    return NextResponse.json({
      success: true,
      totalChecked,
      archivedCount: toArchive.length,
      archived: toArchive,
      checkErrors: failed,
    })
  } catch (err) {
    console.error('[POST /api/dokumente/reconcile]', err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
