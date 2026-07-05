import { NextResponse } from 'next/server'
import { getSystemToken } from '@/lib/google-drive-oauth'

export const dynamic = 'force-dynamic'

/**
 * Verbindungsstatus des zentralen Google-Drive-System-Kontos.
 */
export async function GET() {
  try {
    const token = await getSystemToken()

    if (!token || !token.access_token) {
      return NextResponse.json({ connected: false })
    }

    return NextResponse.json({
      connected: true,
      email: token.connected_email,
      rootFolderId: token.root_folder_id,
      rootFolderUrl: token.root_folder_id
        ? `https://drive.google.com/drive/folders/${token.root_folder_id}`
        : null,
    })
  } catch (err) {
    console.error('[Google Drive Status] Error:', err)
    return NextResponse.json(
      { connected: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
