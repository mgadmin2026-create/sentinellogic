import { NextResponse } from 'next/server'
import { initGoogleDrive, uploadDocumentToGoogleDrive } from '@/lib/google-drive-client'

export async function GET() {
  try {
    console.log('[Google Drive Test] Starting...')

    // Check env vars
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      return NextResponse.json({
        success: false,
        error: 'Missing GOOGLE_SERVICE_ACCOUNT_KEY',
      }, { status: 400 })
    }

    if (!process.env.GOOGLE_DRIVE_FOLDER_ID) {
      return NextResponse.json({
        success: false,
        error: 'Missing GOOGLE_DRIVE_FOLDER_ID',
      }, { status: 400 })
    }

    // Initialize
    console.log('[Google Drive Test] Initializing...')
    initGoogleDrive(
      process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
      process.env.GOOGLE_DRIVE_FOLDER_ID
    )

    // Create test file (1KB text)
    const testContent = 'Test upload from Claude Code - ' + new Date().toISOString()
    const testBuffer = Buffer.from(testContent)

    // Upload
    console.log('[Google Drive Test] Uploading test file...')
    const result = await uploadDocumentToGoogleDrive(
      testBuffer,
      'test-' + Date.now() + '.txt',
      'text/plain',
      'test-contact-id',
      'Test Contact'
    )

    return NextResponse.json({
      success: true,
      message: 'Google Drive API test passed!',
      fileId: result.fileId,
      ordnerId: result.ordnerId,
      compressionRatio: result.compressionRatio,
    })
  } catch (err) {
    console.error('[Google Drive Test] Error:', err)
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    }, { status: 500 })
  }
}
