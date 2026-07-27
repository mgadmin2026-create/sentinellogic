// API Route: Beitragsübersicht als PDF herunterladen
// GET /api/kontakte/[id]/beitragsuebersicht/pdf
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { buildBeitragsuebersichtPdfBuffer } from '@/lib/beitragsuebersicht-pdf'

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return Response.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 })
  }

  const supabase = createServerClient()
  const { data: contact, error } = await supabase
    .from('contacts')
    .select('first_name, last_name, company_name, kontakt_typ, beitragsuebersicht, assigned_user:assigned_user_id(name)')
    .eq('id', params.id)
    .single()

  if (error || !contact) {
    return Response.json({ success: false, error: 'Kontakt nicht gefunden' }, { status: 404 })
  }
  if (!contact.beitragsuebersicht) {
    return Response.json({ success: false, error: 'Für diesen Kontakt wurde noch keine Beitragsübersicht angelegt' }, { status: 400 })
  }

  const kundentyp: 'privat' | 'gewerbe' = contact.kontakt_typ === 'privat' ? 'privat' : 'gewerbe'
  const kundenname =
    kundentyp === 'gewerbe' && contact.company_name
      ? contact.company_name
      : `${contact.first_name} ${contact.last_name}`.trim()
  const beratername = (contact.assigned_user as any)?.name || currentUser.name

  try {
    const pdfBuffer = await buildBeitragsuebersichtPdfBuffer({
      kundenname,
      kundentyp,
      beratername,
      uebersicht: contact.beitragsuebersicht,
    })

    const filenameBase = `Beitragsuebersicht-${kundenname.replace(/[^a-zA-Z0-9äöüÄÖÜß]+/g, '-')}`
    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filenameBase}.pdf"`,
      },
    })
  } catch (err) {
    console.error('[GET /api/kontakte/[id]/beitragsuebersicht/pdf] Fehler:', err)
    return Response.json({ success: false, error: 'PDF-Erstellung fehlgeschlagen' }, { status: 500 })
  }
}
