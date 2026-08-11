// POST /api/kontakte/[id]/beitragsuebersicht/uebernahme
// Schreibt eine per KI-Upload gelesene, vom Nutzer im Bestätigungs-Modal
// (Direkt-Upload-Pfad, KontaktDokumenteTab.tsx) bestätigte Beitragszeile in
// die Beitragsübersicht. Nutzt denselben Helper wie der /ki-upload-Pfad,
// damit beide Upload-Wege identisch funktionieren.
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { uebernehmeVertragInBeitragsuebersicht } from '@/lib/beitragsuebersicht-uebernahme'
import type { Zyklus } from '@/lib/beitragsuebersicht-zyklus'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const { sparte, beitrag, betragZyklus, spalte, versicherungsgesellschaft, vertragsbeginn, vertragsende } = body as {
      sparte?: string
      beitrag?: string
      betragZyklus?: Zyklus
      spalte?: 'alt' | 'neu'
      versicherungsgesellschaft?: string
      vertragsbeginn?: string
      vertragsende?: string
    }

    if (!sparte || !beitrag || !betragZyklus || !spalte) {
      return NextResponse.json({ success: false, error: 'sparte, beitrag, betragZyklus und spalte erforderlich' }, { status: 400 })
    }

    const supabase = createServerClient()
    await uebernehmeVertragInBeitragsuebersicht(supabase, params.id, {
      sparte,
      beitrag,
      betragZyklus,
      spalte,
      versicherungsgesellschaft,
      vertragsbeginn,
      vertragsende,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Beitragsübersicht-Übernahme] POST error:', err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
