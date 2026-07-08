import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { uploadDocumentToGoogleDrive, getOrdnerstruktur, type OrdnerstrukturNode } from '@/lib/google-drive-oauth'
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
    try {
      const struktur = await getOrdnerstruktur()
      const extraktion = await analysiereVersicherungsdokument(
        buffer,
        file.type || 'application/octet-stream',
        flatten(struktur.privat),
        flatten(struktur.gewerbe)
      )

      // Wenn Vertrag erkannt → in contracts Tabelle speichern
      if (extraktion.is_contract && extraktion.benefits) {
        try {
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
    })
  } catch (err) {
    console.error('[Dokumente] POST error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
