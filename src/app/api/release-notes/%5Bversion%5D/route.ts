// API Route: Release Notes — Get By Version
// GET /api/release-notes/0.2.0
import { getReleaseByVersion } from '@/data/release-notes'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: Promise<{ version: string }> }) {
  try {
    const { version } = await params

    if (!version) {
      return Response.json({ success: false, error: 'Version erforderlich' }, { status: 400 })
    }

    const release = getReleaseByVersion(version)
    if (!release) {
      return Response.json({ success: false, error: 'Version nicht gefunden' }, { status: 404 })
    }

    return Response.json({ success: true, data: release })
  } catch (err) {
    console.error('[GET /api/release-notes/[version]] Fehler:', err)
    return Response.json({ success: false, error: 'Fehler beim Laden' }, { status: 500 })
  }
}
