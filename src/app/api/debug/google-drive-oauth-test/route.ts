import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { uploadDocumentToGoogleDrive } from '@/lib/google-drive-oauth'

export async function GET() {
  try {
    const supabase = createServerClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Not authenticated. Please login first, then authorize Google Drive access.',
        step: '1_login_required',
      }, { status: 401 })
    }

    console.log('[Google Drive OAuth Test] Testing for user:', user.id)

    // Check if user has OAuth tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from('google_oauth_tokens')
      .select('access_token, expires_at')
      .eq('user_id', user.id)
      .single()

    if (tokenError || !tokenData) {
      return NextResponse.json({
        success: false,
        error: 'No Google OAuth token found',
        step: '2_oauth_required',
        authUrl: `/api/auth/google/start`,
      }, { status: 400 })
    }

    // Create test file
    const testContent = 'OAuth Test Upload - ' + new Date().toISOString()
    const testBuffer = Buffer.from(testContent)

    console.log('[Google Drive OAuth Test] Uploading test file...')

    // Upload
    const result = await uploadDocumentToGoogleDrive(
      user.id,
      testBuffer,
      'oauth-test-' + Date.now() + '.txt',
      'text/plain',
      'oauth-test-contact',
      'OAuth Test'
    )

    return NextResponse.json({
      success: true,
      message: 'Google Drive OAuth test passed!',
      fileId: result.fileId,
      ordnerId: result.ordnerId,
      ordnerName: result.ordnerName,
      originalSize: result.originalSize,
      compressedSize: result.compressedSize,
      compressionRatio: result.compressionRatio,
      userId: user.id,
    })
  } catch (err) {
    console.error('[Google Drive OAuth Test] Error:', err)
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    }, { status: 500 })
  }
}
