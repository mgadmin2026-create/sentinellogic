import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { uploadDocumentToGoogleDrive, initGoogleDrive } from '@/lib/google-drive-client'
import { logActivity } from '@/lib/activities-logger'

// Initialize Google Drive on startup
if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY && process.env.GOOGLE_DRIVE_FOLDER_ID) {
  try {
    initGoogleDrive(process.env.GOOGLE_SERVICE_ACCOUNT_KEY, process.env.GOOGLE_DRIVE_FOLDER_ID)
  } catch (err) {
    console.error('[Google Drive] Initialization failed:', err)
  }
}

// GET: List documents for a contact
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const kontaktId = params.id

  try {
    const supabase = await createServerClient()

    // Get contact
    const { data: kontakt, error: kontaktError } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, google_drive_ordner_id, dokumente_count, dokumente_total_size')
      .eq('id', kontaktId)
      .single()

    if (kontaktError || !kontakt) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    // Get documents for this contact
    const { data: dokumente, error: dokumenteError } = await supabase
      .from('dokumente_metadata')
      .select('*')
      .eq('kontakt_id', kontaktId)
      .eq('ordner_archived', false)
      .order('created_at', { ascending: false })

    if (dokumenteError) {
      console.error('[Dokumente] Error fetching documents:', dokumenteError)
      return NextResponse.json(
        { error: 'Failed to fetch documents' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      kontakt: {
        id: kontakt.id,
        name: `${kontakt.first_name} ${kontakt.last_name}`,
        ordner_id: kontakt.google_drive_ordner_id,
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

// POST: Upload document
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const kontaktId = params.id

  try {
    const supabase = await createServerClient()

    // Get contact
    const { data: kontakt, error: kontaktError } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, google_drive_ordner_id, google_drive_ordner_name')
      .eq('id', kontaktId)
      .single()

    if (kontaktError || !kontakt) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const description = formData.get('description') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Convert file to buffer
    const fileBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(fileBuffer)

    console.log(`[Dokumente] Uploading ${file.name} for contact ${kontaktId}`)

    // Upload to Google Drive (with compression)
    const uploadResult = await uploadDocumentToGoogleDrive(
      buffer,
      file.name,
      file.type,
      kontaktId,
      `${kontakt.first_name} ${kontakt.last_name}`
    )

    // Save metadata to DB
    const { data: dokument, error: insertError } = await supabase
      .from('dokumente_metadata')
      .insert({
        kontakt_id: kontaktId,
        ordner_id: uploadResult.ordnerId,
        ordner_name: uploadResult.ordnerName,
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
      return NextResponse.json(
        { error: 'Failed to save document metadata' },
        { status: 500 }
      )
    }

    // Update contact dokumente count
    await supabase.rpc('update_kontakt_dokumente_stats', {
      p_kontakt_id: kontaktId,
    })

    // Log activity
    await logActivity(
      null,
      kontaktId,
      'dokument_uploaded',
      `Dokument hochgeladen: ${file.name} (${uploadResult.compressionRatio}% komprimiert)`
    )

    return NextResponse.json({
      success: true,
      dokument: {
        id: dokument.id,
        file_id: uploadResult.fileId,
        file_name: uploadResult.fileName,
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
