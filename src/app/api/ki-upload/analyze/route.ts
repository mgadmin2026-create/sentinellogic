// POST /api/ki-upload/analyze — Versicherungsdokument mit Claude analysieren
// Rueckgabe: extrahierte Daten + Duplikat-Kandidat (kein Schreiben in die DB)
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { analysiereVersicherungsdokument } from '@/lib/ki-upload'
import { getOrdnerstruktur, type OrdnerstrukturNode } from '@/lib/google-drive-oauth'

export const dynamic = 'force-dynamic'
export const maxDuration = 120 // Claude-Analyse kann bei gescannten PDFs dauern

const MAX_FILE_BYTES = 30 * 1024 * 1024 // Claude-API-Limit 32MB pro Request

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

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ success: false, error: 'Keine Datei übergeben' }, { status: 400 })
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { success: false, error: 'Datei zu groß (max. 30 MB)' },
        { status: 413 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const struktur = await getOrdnerstruktur()

    console.log(`[KI-Upload] Analysiere ${file.name} (${file.size}B, ${file.type})`)
    const extraktion = await analysiereVersicherungsdokument(
      buffer,
      file.type || 'application/pdf',
      flatten(struktur.privat),
      flatten(struktur.gewerbe)
    )

    // Duplikat-Kandidat suchen: E-Mail > Name > Firma
    const supabase = createServerClient()
    let duplikat: { id: string; first_name: string; last_name: string; email: string | null; company_name: string | null } | null = null

    if (extraktion.email) {
      const { data } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, email, company_name')
        .ilike('email', extraktion.email.trim())
        .limit(1)
        .maybeSingle()
      duplikat = data ?? null
    }
    if (!duplikat && extraktion.first_name && extraktion.last_name) {
      const { data } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, email, company_name')
        .ilike('first_name', extraktion.first_name.trim())
        .ilike('last_name', extraktion.last_name.trim())
        .limit(1)
        .maybeSingle()
      duplikat = data ?? null
    }
    if (!duplikat && extraktion.company_name) {
      const { data } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, email, company_name')
        .ilike('company_name', extraktion.company_name.trim())
        .limit(1)
        .maybeSingle()
      duplikat = data ?? null
    }

    return NextResponse.json({ success: true, extraktion, duplikat })
  } catch (err) {
    console.error('[KI-Upload] Analyse-Fehler:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
