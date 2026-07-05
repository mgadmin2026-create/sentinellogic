import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Verbindungsstatus des zentralen Google-Drive-System-Kontos.
 * (TEMP: mit Diagnosefeldern zur Fehlersuche)
 */
export async function GET() {
  try {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('google_drive_system_token')
      .select('access_token, root_folder_id, connected_email, expires_at')
      .eq('id', 1)
      .maybeSingle()

    const supabaseHost = (process.env.NEXT_PUBLIC_SUPABASE_URL || '')
      .replace('https://', '')
      .split('.')[0]

    const connected = !!(data && data.access_token)

    return NextResponse.json({
      connected,
      email: data?.connected_email ?? null,
      rootFolderId: data?.root_folder_id ?? null,
      rootFolderUrl: data?.root_folder_id
        ? `https://drive.google.com/drive/folders/${data.root_folder_id}`
        : null,
      _debug: {
        supabaseHost,
        rowFound: !!data,
        hasAccessToken: !!data?.access_token,
        dbError: error ? `${error.code || ''} ${error.message}` : null,
      },
    })
  } catch (err) {
    console.error('[Google Drive Status] Error:', err)
    return NextResponse.json(
      { connected: false, _debug: { caught: err instanceof Error ? err.message : String(err) } },
      { status: 500 }
    )
  }
}
