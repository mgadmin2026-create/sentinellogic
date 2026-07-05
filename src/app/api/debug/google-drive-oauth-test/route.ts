import { NextResponse } from 'next/server'
import { getSystemToken, uploadDocumentToGoogleDrive } from '@/lib/google-drive-oauth'

/**
 * Testet das zentrale Google-Drive-System-Konto mit einem Test-Upload.
 */
export async function GET() {
  try {
    const token = await getSystemToken()
    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: 'System-Konto nicht verbunden',
          hint: 'Verbinde das Konto unter /einstellungen/dokumente',
        },
        { status: 409 }
      )
    }

    const testBuffer = Buffer.from('System-Konto Test-Upload - ' + new Date().toISOString())
    const result = await uploadDocumentToGoogleDrive(
      testBuffer,
      'system-test-' + Date.now() + '.txt',
      'text/plain',
      'test-contact',
      'System Test'
    )

    return NextResponse.json({
      success: true,
      message: 'Google Drive System-Konto Test bestanden!',
      connectedEmail: token.connected_email,
      ...result,
    })
  } catch (err) {
    console.error('[Google Drive OAuth Test] Error:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
