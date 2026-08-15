import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { uploadDocumentToGoogleDrive, getOrdnerstruktur, renameFileInGoogleDrive, deleteFileFromGoogleDrive, type OrdnerstrukturNode } from '@/lib/google-drive-oauth'
import { logFileUploaded } from '@/lib/activities-logger'
import { getCurrentUser } from '@/lib/auth'
import { analysiereVersicherungsdokument } from '@/lib/ki-upload'
import { erkenneZyklus, defaultSpalte } from '@/lib/beitragsuebersicht-zyklus'

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
// Siehe /api/dokumente/route.ts: dynamic='force-dynamic' allein reicht nicht,
// um den Next.js Data Cache für die darunterliegenden Supabase-Requests zu
// deaktivieren — ohne dieses Flag konnte die Liste über mehrere Deploys
// hinweg veraltet bleiben.
export const fetchCache = 'force-no-store'
export const maxDuration = 120 // Claude-Analyse kann bei gescannten PDFs dauern

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
    // Wird gesetzt, wenn der User im Duplikat-Modal bestätigt hat (mit gleichem oder geändertem Namen)
    const overrideFirstName = String(formData.get('overrideFirstName') || '').trim() || null
    const overrideLastName = String(formData.get('overrideLastName') || '').trim() || null
    const confirmed = overrideFirstName !== null && overrideLastName !== null
    // Der KI-Upload-Commit-Flow hat Duplikat-Prüfung und Vertrags-Extraktion
    // bereits selbst (mit vom User geprüften/korrigierten Daten) erledigt —
    // ohne dieses Flag würde hier ein zweiter, unabhängiger KI-Durchlauf
    // denselben Vertrag nochmal anlegen (doppelte contracts-/Beitragsübersicht-Zeilen).
    const skipVertragsanalyse = formData.get('skipVertragsanalyse') === 'true'
    // Der KI-Upload-Commit-Flow kennt den Dokumenttyp bereits (vom Nutzer in
    // der Prüfmaske bestätigt) — bei skipVertragsanalyse läuft hier keine
    // eigene Analyse mehr, ohne diesen Override würde der Typ sonst nie
    // gespeichert (extraktion bleibt null).
    const dokumenttypOverrideRaw = String(formData.get('dokumenttyp') || '').trim()
    const dokumenttypOverride = VALID_DOKUMENTTYPEN.has(dokumenttypOverrideRaw) ? dokumenttypOverrideRaw : null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const kontaktName = `${kontakt.first_name} ${kontakt.last_name}`.trim()

    console.log(`[Dokumente] Upload ${file.name} für Kontakt ${kontaktId} (Kategorie: ${kategorie})`)

    // KI-Analyse VOR dem Upload: Wenn ein Namens-Duplikat gefunden wird, wird NICHTS
    // hochgeladen/gespeichert, bevor der User das im Modal bestätigt hat.
    let extraktion: any = null
    let analyseFehler: string | null = null

    if (!confirmed && !skipVertragsanalyse) {
      try {
        const struktur = await getOrdnerstruktur()
        extraktion = await analysiereVersicherungsdokument(
          buffer,
          file.type || 'application/octet-stream',
          flatten(struktur.privat),
          flatten(struktur.gewerbe)
        )

        if (extraktion.first_name && extraktion.last_name) {
          const { data: byName, error: dupError } = await supabase
            .from('contacts')
            .select('id, first_name, last_name, email')
            .ilike('first_name', extraktion.first_name.trim())
            .ilike('last_name', extraktion.last_name.trim())
            .neq('id', kontaktId)
            .maybeSingle()

          if (dupError) {
            console.error('[Dokumente] Duplikat-Query fehlgeschlagen:', dupError)
          } else if (byName) {
            console.log(`[Dokumente] ⚠️ Kontakt-Duplikat gefunden, Upload gestoppt: ${byName.first_name} ${byName.last_name}`)
            return NextResponse.json({
              success: false,
              needsConfirmation: true,
              nameDuplicate: {
                id: byName.id,
                first_name: byName.first_name,
                last_name: byName.last_name,
                email: byName.email,
              },
              extractedData: {
                first_name: extraktion.first_name || null,
                last_name: extraktion.last_name || null,
                email: extraktion.email || null,
                company_name: extraktion.company_name || null,
              },
            })
          }
        }
      } catch (err) {
        analyseFehler = err instanceof Error ? err.message : String(err)
        console.error('[Dokumente] KI-Analyse fehlgeschlagen (Upload läuft trotzdem weiter):', analyseFehler)
      }
    }

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
        dokumenttyp: dokumenttypOverride ?? extraktion?.dokumenttyp ?? null,
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

    // Falls der User im Duplikat-Modal bestätigt hat: KI-Analyse wurde oben übersprungen,
    // jetzt nachholen (für Vertrags-Erkennung), aber ohne erneute Duplikat-Prüfung/Blockierung.
    if (confirmed && !extraktion && !skipVertragsanalyse) {
      try {
        const struktur = await getOrdnerstruktur()
        extraktion = await analysiereVersicherungsdokument(
          buffer,
          file.type || 'application/octet-stream',
          flatten(struktur.privat),
          flatten(struktur.gewerbe)
        )
        // Insert oben lief bereits ohne Dokumenttyp (Analyse war zu diesem
        // Zeitpunkt noch nicht da) — jetzt nachtragen.
        if (extraktion?.dokumenttyp) {
          await supabase
            .from('dokumente_metadata')
            .update({ dokumenttyp: extraktion.dokumenttyp })
            .eq('id', dokument.id)
          dokument.dokumenttyp = extraktion.dokumenttyp
        }
      } catch (err) {
        analyseFehler = err instanceof Error ? err.message : String(err)
        console.error('[Dokumente] KI-Analyse (nach Bestätigung) fehlgeschlagen:', analyseFehler)
      }
    }

    // Wenn Vertrag erkannt → speichern
    let beitragsuebersichtVorschlag: {
      sparte: string
      beitrag: string
      erkannterZyklus: ReturnType<typeof erkenneZyklus>
      vorschlagSpalte: 'alt' | 'neu'
      versicherungsgesellschaft: string
      vertragsbeginn: string
      vertragsende: string
    } | null = null

    if (extraktion?.is_contract && extraktion?.benefits) {
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
        console.error('[Dokumente] Vertrags-Speicherung fehlgeschlagen:', err)
      }

      // Beitragsübersicht wird hier NICHT mehr automatisch geschrieben — nur
      // bei Vertrag/Angebot (nicht Nachtrag/Rechnung/Sonstiges) liefern wir
      // einen Vorschlag zurück, den der Nutzer im UI bestätigen muss.
      if (extraktion.sparte && extraktion.beitrag && ['police', 'angebot'].includes(extraktion.dokumenttyp)) {
        beitragsuebersichtVorschlag = {
          sparte: extraktion.sparte,
          beitrag: extraktion.beitrag,
          erkannterZyklus: erkenneZyklus(extraktion.zahlweise || extraktion.beitrag),
          vorschlagSpalte: defaultSpalte(extraktion.contract_type),
          versicherungsgesellschaft: extraktion.versicherungsgesellschaft || '',
          vertragsbeginn: extraktion.vertragsbeginn || '',
          vertragsende: extraktion.vertragsende || '',
        }
      }
    }

    // Sparte erkannt? → Vorschlag zurückgeben, wenn dem Kontakt noch nicht
    // zugeordnet (weder als Haupt- noch als Zusatzsparte) — der Nutzer
    // entscheidet im UI, ob und in welcher Rolle sie übernommen wird.
    let sparteVorschlag: { name: string; sparteId: string | null; hatBereitsSparten: boolean } | null = null
    if (extraktion?.sparte?.trim()) {
      try {
        const sparteName = extraktion.sparte.trim()
        const [{ data: alleSparten }, { data: zugeordnet }] = await Promise.all([
          supabase.from('sparten').select('id, name'),
          supabase.from('contact_sparte_map').select('is_primary, sparte:sparte_id(id, name)').eq('contact_id', kontaktId),
        ])
        const zugeordnetListe = (zugeordnet ?? []) as unknown as { is_primary: boolean; sparte: { id: string; name: string } }[]
        const bereitsZugeordnet = zugeordnetListe.some(
          (z) => z.sparte.name.trim().toLowerCase() === sparteName.toLowerCase()
        )
        if (!bereitsZugeordnet) {
          const match = (alleSparten ?? []).find((s) => s.name.trim().toLowerCase() === sparteName.toLowerCase())
          sparteVorschlag = {
            name: sparteName,
            sparteId: match?.id ?? null,
            hatBereitsSparten: zugeordnetListe.length > 0,
          }
        }
      } catch (err) {
        console.error('[Dokumente] Sparten-Abgleich fehlgeschlagen:', err)
      }
    }

    // Aktivität loggen
    try {
      const currentUser = await getCurrentUser()
      await logFileUploaded(
        kontaktId,
        kontaktName,
        file.name,
        `${uploadResult.compressionRatio}% komprimiert`,
        currentUser?.id
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
        dokumenttyp: dokument.dokumenttyp,
        created_at: dokument.created_at,
      },
      // Sichtbar machen, falls die KI-Analyse fehlgeschlagen ist (kein Vertrag erkannt/gespeichert)
      analyseWarnung: analyseFehler,
      // Vorschlag für die Beitragsübersicht-Übernahme — muss vom Nutzer im UI bestätigt werden
      beitragsuebersichtVorschlag,
      // Erkannte Sparte, falls dem Kontakt noch nicht zugeordnet — muss vom Nutzer im UI bestätigt werden
      sparteVorschlag,
    })
  } catch (err) {
    console.error('[Dokumente] POST error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

const VALID_DOKUMENTTYPEN = new Set(['police', 'angebot', 'nachtrag', 'rechnung', 'sonstiges'])

// PATCH: Dokument umbenennen und/oder Dokumenttyp korrigieren
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const kontaktId = params.id

  try {
    const supabase = createServerClient()
    const body = await request.json()
    const { dokumentId, newFileName, dokumenttyp } = body

    if (!dokumentId || (!newFileName && dokumenttyp === undefined)) {
      return NextResponse.json(
        { error: 'dokumentId und (newFileName oder dokumenttyp) erforderlich' },
        { status: 400 }
      )
    }
    if (dokumenttyp !== undefined && dokumenttyp !== null && !VALID_DOKUMENTTYPEN.has(dokumenttyp)) {
      return NextResponse.json({ error: 'Ungültiger Dokumenttyp' }, { status: 400 })
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

    // In Google Drive umbenennen (nur wenn tatsächlich ein neuer Name übergeben wurde)
    if (newFileName) {
      await renameFileInGoogleDrive(dokument.file_id, newFileName)
    }

    // Metadaten aktualisieren
    const updates: Record<string, unknown> = {}
    if (newFileName) updates.file_name = newFileName
    if (dokumenttyp !== undefined) updates.dokumenttyp = dokumenttyp

    const { data: updated, error: updateError } = await supabase
      .from('dokumente_metadata')
      .update(updates)
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

    // Aus Google Drive löschen — ein Fehler hier (z.B. Token-Refresh
    // fehlgeschlagen) darf die Sichtbarkeit im CRM nicht blockieren, sonst
    // taucht das "gelöschte" Dokument in der App weiter auf. Die Datei bleibt
    // dann zwar vorerst in Drive liegen, ist aber für das Team klar als
    // Warnung sichtbar statt eines stillen bzw. blockierenden Fehlers.
    let driveWarning: string | null = null
    try {
      await deleteFileFromGoogleDrive(dokument.file_id)
    } catch (driveErr) {
      console.error('[Dokumente] Google-Drive-Löschung fehlgeschlagen:', driveErr)
      driveWarning = `Datei konnte nicht aus Google Drive gelöscht werden (${driveErr instanceof Error ? driveErr.message : 'unbekannter Fehler'}). Sie wurde trotzdem aus dem CRM entfernt.`
    }

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
      driveWarning,
    })
  } catch (err) {
    console.error('[Dokumente] DELETE error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Fehler' },
      { status: 500 }
    )
  }
}
