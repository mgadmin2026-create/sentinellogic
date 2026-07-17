import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { uploadDocumentToGoogleDrive, getOrdnerstruktur, renameFileInGoogleDrive, deleteFileFromGoogleDrive, type OrdnerstrukturNode } from '@/lib/google-drive-oauth'
import { logFileUploaded } from '@/lib/activities-logger'
import { analysiereVersicherungsdokument } from '@/lib/ki-upload'

function flatten(nodes: OrdnerstrukturNode[]): string[] {
  const paths: string[] = []
  for (const node of nodes) {
    paths.push(node.name)
    for (const child of node.children ?? []) {
      paths.push(`${node.name}/${child.name}`)
    }
  }
  return paths
}

export const dynamic = 'force-dynamic'

// GET: Dokumente eines Kontakts auflisten
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const kontaktId = params.id

  try {
    const supabase = createServerClient()

    const { data: kontakt, error: kontaktError } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, kontakt_typ, google_drive_ordner_id, dokumente_count, dokumente_total_size')
      .eq('id', kontaktId)
      .single()

    if (kontaktError || !kontakt) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    const { data: dokumente, error: dokumenteError } = await supabase
      .from('dokumente_metadata')
      .select('*')
      .eq('kontakt_id', kontaktId)
      .eq('ordner_archived', false)
      .order('created_at', { ascending: false })

    if (dokumenteError) {
      console.error('[Dokumente] Error fetching documents:', dokumenteError)
      return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      kontakt: {
        id: kontakt.id,
        name: `${kontakt.first_name} ${kontakt.last_name}`,
        kontakt_typ: kontakt.kontakt_typ || 'gewerbe',
        ordner_id: kontakt.google_drive_ordner_id,
        ordner_url: kontakt.google_drive_ordner_id
          ? `https://drive.google.com/drive/folders/${kontakt.google_drive_ordner_id}`
          : null,
        dokumente_count: kontakt.dokumente_count || 0,
        dokumente_total_size: kontakt.dokumente_total_size || 0,
      },
      dokumente: dokumente || [],
    })
  } catch (err) {
    console.error('[Dokumente] GET error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// POST: Dokument hochladen (zentrales System-Konto)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const kontaktId = params.id

  try {
    const supabase = createServerClient()

    const { data: kontakt, error: kontaktError } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, google_drive_ordner_id')
      .eq('id', kontaktId)
      .single()

    if (kontaktError || !kontakt) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const kategorie = String(formData.get('kategorie') || 'Sonstiges').trim() || 'Sonstiges'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const kontaktName = `${kontakt.first_name} ${kontakt.last_name}`.trim()

    console.log(`[Dokumente] Upload ${file.name} für Kontakt ${kontaktId} (Kategorie: ${kategorie})`)

    // Upload ins zentrale System-Konto
    let uploadResult
    try {
      uploadResult = await uploadDocumentToGoogleDrive(
        buffer,
        file.name,
        file.type || 'application/octet-stream',
        kontaktId,
        kontakt.first_name || '',
        kontakt.last_name || '',
        kategorie
      )
    } catch (uploadErr) {
      const msg = uploadErr instanceof Error ? uploadErr.message : String(uploadErr)
      console.error('[Dokumente] Upload fehlgeschlagen:', msg)
      // "nicht verbunden" -> 409, damit die UI eine klare Meldung zeigen kann
      const notConnected = msg.includes('nicht verbunden') || msg.includes('Refresh-Token')
      return NextResponse.json(
        { error: msg },
        { status: notConnected ? 409 : 502 }
      )
    }

    // Kontakt-Ordner-ID am Kontakt merken (erster Upload) — NICHT den Kategorie-Unterordner
    if (kontakt.google_drive_ordner_id !== uploadResult.kontaktOrdnerId) {
      await supabase
        .from('contacts')
        .update({ google_drive_ordner_id: uploadResult.kontaktOrdnerId })
        .eq('id', kontaktId)
    }

    // Metadaten speichern
    const { data: dokument, error: insertError } = await supabase
      .from('dokumente_metadata')
      .insert({
        kontakt_id: kontaktId,
        ordner_id: uploadResult.ordnerId,
        ordner_name: uploadResult.ordnerName,
        kategorie: uploadResult.kategorie,
        file_id: uploadResult.fileId,
        file_name: uploadResult.fileName,
        file_type: file.type,
        original_size: uploadResult.originalSize,
        compressed_size: uploadResult.compressedSize,
        compression_ratio: uploadResult.compressionRatio,
        created_by: 'upload',
      })
      .select()
      .single()

    if (insertError) {
      console.error('[Dokumente] Failed to save metadata:', insertError)
      return NextResponse.json({ error: 'Failed to save document metadata' }, { status: 500 })
    }

    // Kontakt-Statistik aktualisieren
    await supabase.rpc('update_kontakt_dokumente_stats', { p_kontakt_id: kontaktId })

    // KI-Analyse: Vertragsdetails extrahieren (async, nicht blockierend)
    let contractDuplicate = null
    try {
      const struktur = await getOrdnerstruktur()
      const extraktion = await analysiereVersicherungsdokument(
        buffer,
        file.type || 'application/octet-stream',
        flatten(struktur.privat),
        flatten(struktur.gewerbe)
      )

      // Wenn Vertrag erkannt → Duplikat prüfen und speichern
      if (extraktion.is_contract && extraktion.benefits) {
        try {
          // Duplikat-Prüfung: Suche nach ähnlichem Vertrag
          const searchCriteria: Record<string, unknown> = { contact_id: kontaktId }

          // Priorisiert: Vertragsnummer (eindeutig)
          if (extraktion.vertragsnummer) {
            const { data: byNumber } = await supabase
              .from('contracts')
              .select('id, insurance_type, contract_number')
              .eq('contact_id', kontaktId)
              .eq('contract_number', extraktion.vertragsnummer)
              .maybeSingle()
            if (byNumber) contractDuplicate = byNumber
          }

          // Fallback: Versicherer + Kategorie
          if (!contractDuplicate && extraktion.versicherungsgesellschaft && extraktion.versicherungstyp) {
            const { data: byInsurer } = await supabase
              .from('contracts')
              .select('id, insurance_type, contract_number')
              .eq('contact_id', kontaktId)
              .eq('insurance_type', extraktion.versicherungsgesellschaft)
              .eq('insurance_category', extraktion.versicherungstyp)
              .maybeSingle()
            if (byInsurer) contractDuplicate = byInsurer
          }

          // Vertrag speichern (auch wenn Duplikat gefunden, um Upload nicht zu blockieren)
          await supabase.from('contracts').insert({
            contact_id: kontaktId,
            contract_number: extraktion.vertragsnummer || null,
            insurance_type: extraktion.versicherungsgesellschaft || null,
            contract_type: extraktion.contract_type || 'unknown',
            insurance_category: extraktion.versicherungstyp || null,
            monthly_premium: extraktion.beitrag || null,
            duration_start: extraktion.vertragsbeginn ? new Date(extraktion.vertragsbeginn).toISOString().split('T')[0] : null,
            duration_end: extraktion.vertragsende ? new Date(extraktion.vertragsende).toISOString().split('T')[0] : null,
            benefits: extraktion.benefits,
            created_by: 'dokument_upload',
          })
          console.log(`[Dokumente] Vertrag erkannt und gespeichert für Kontakt ${kontaktId}`)
          if (contractDuplicate) {
            console.log(`[Dokumente] ⚠️ Ähnlicher Vertrag existiert bereits: ${contractDuplicate.contract_number || contractDuplicate.insurance_type}`)
          }
        } catch (err) {
          console.warn('[Dokumente] Vertrags-Speicherung fehlgeschlagen (nicht blockierend):', err)
        }
      }
    } catch (err) {
      console.warn('[Dokumente] KI-Analyse fehlgeschlagen (nicht blockierend):', err)
    }

    // Aktivität loggen
    try {
      await logFileUploaded(
        kontaktId,
        kontaktName,
        file.name,
        `${uploadResult.compressionRatio}% komprimiert`
      )
    } catch (logErr) {
      console.warn('[Dokumente] Activity-Log fehlgeschlagen:', logErr)
    }

    return NextResponse.json({
      success: true,
      dokument: {
        id: dokument.id,
        file_id: uploadResult.fileId,
        file_name: uploadResult.fileName,
        web_view_link: uploadResult.webViewLink,
        original_size: uploadResult.originalSize,
        compressed_size: uploadResult.compressedSize,
        compression_ratio: uploadResult.compressionRatio,
        created_at: dokument.created_at,
      },
      contractDuplicate: contractDuplicate ? {
        id: contractDuplicate.id,
        contract_number: contractDuplicate.contract_number,
        insurance_type: contractDuplicate.insurance_type,
      } : null,
    })
  } catch (err) {
    console.error('[Dokumente] POST error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// PATCH: Dokument umbenennen
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const kontaktId = params.id

  try {
    const supabase = createServerClient()
    const body = await request.json()
    const { dokumentId, newFileName } = body

    if (!dokumentId || !newFileName) {
      return NextResponse.json(
        { error: 'dokumentId und newFileName erforderlich' },
        { status: 400 }
      )
    }

    // Dokument-Metadaten laden
    const { data: dokument, error: dokumentError } = await supabase
      .from('dokumente_metadata')
      .select('*')
      .eq('id', dokumentId)
      .eq('kontakt_id', kontaktId)
      .single()

    if (dokumentError || !dokument) {
      return NextResponse.json({ error: 'Dokument nicht gefunden' }, { status: 404 })
    }

    // In Google Drive umbenennen
    await renameFileInGoogleDrive(dokument.file_id, newFileName)

    // Metadaten aktualisieren
    const { data: updated, error: updateError } = await supabase
      .from('dokumente_metadata')
      .update({ file_name: newFileName })
      .eq('id', dokumentId)
      .select()
      .single()

    if (updateError) {
      console.error('[Dokumente] Fehler beim Aktualisieren:', updateError)
      return NextResponse.json({ error: 'Fehler beim Speichern' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      dokument: updated,
    })
  } catch (err) {
    console.error('[Dokumente] PATCH error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Fehler' },
      { status: 500 }
    )
  }
}

// DELETE: Dokument löschen
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const kontaktId = params.id

  try {
    const supabase = createServerClient()
    const body = await request.json()
    const { dokumentId } = body

    if (!dokumentId) {
      return NextResponse.json(
        { error: 'dokumentId erforderlich' },
        { status: 400 }
      )
    }

    // Dokument-Metadaten laden
    const { data: dokument, error: dokumentError } = await supabase
      .from('dokumente_metadata')
      .select('*')
      .eq('id', dokumentId)
      .eq('kontakt_id', kontaktId)
      .single()

    if (dokumentError || !dokument) {
      return NextResponse.json({ error: 'Dokument nicht gefunden' }, { status: 404 })
    }

    // Aus Google Drive löschen
    await deleteFileFromGoogleDrive(dokument.file_id)

    // Aus Datenbank löschen (soft-delete via ordner_archived)
    const { error: deleteError } = await supabase
      .from('dokumente_metadata')
      .update({ ordner_archived: true, kontakt_deleted_at: new Date().toISOString() })
      .eq('id', dokumentId)

    if (deleteError) {
      console.error('[Dokumente] Fehler beim Löschen:', deleteError)
      return NextResponse.json({ error: 'Fehler beim Löschen' }, { status: 500 })
    }

    // Kontakt-Statistik aktualisieren
    await supabase.rpc('update_kontakt_dokumente_stats', { p_kontakt_id: kontaktId })

    return NextResponse.json({
      success: true,
      message: 'Dokument gelöscht',
    })
  } catch (err) {
    console.error('[Dokumente] DELETE error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Fehler' },
      { status: 500 }
    )
  }
}
