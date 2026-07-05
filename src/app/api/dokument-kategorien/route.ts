// API Route: Dokument-Ordnerstruktur (konfigurierbar je Kontakt-Typ)
// GET   /api/dokument-kategorien — Struktur laden (Fallback: Defaults)
// PATCH /api/dokument-kategorien — Struktur speichern { privat: [...], gewerbe: [...] }
// POST  /api/dokument-kategorien — Kategorie umbenennen inkl. Drive-Propagation
//                                  { action: 'rename', typ, oldPfad, newPfad }
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import {
  getOrdnerstruktur,
  renameKategorieFolders,
  type Ordnerstruktur,
  type OrdnerstrukturNode,
} from '@/lib/google-drive-oauth'

export const dynamic = 'force-dynamic'

const RESERVED = 'sonstiges'

function validateNodes(nodes: unknown, level: number): string | null {
  if (!Array.isArray(nodes)) return 'Struktur muss ein Array sein'
  if (level > 2) return 'Maximal 2 Ebenen erlaubt'

  const seen = new Set<string>()
  for (const node of nodes as OrdnerstrukturNode[]) {
    const name = typeof node?.name === 'string' ? node.name.trim() : ''
    if (!name) return 'Kategoriename darf nicht leer sein'
    if (name.includes('/')) return `"${name}": Schrägstrich ist nicht erlaubt`
    if (name.toLowerCase() === RESERVED) return '"Sonstiges" ist reserviert (immer vorhanden)'
    const lower = name.toLowerCase()
    if (seen.has(lower)) return `Doppelte Kategorie: "${name}"`
    seen.add(lower)

    if (node.children !== undefined) {
      if (level >= 2) return `"${name}": Unterkategorien sind nur auf Ebene 1 erlaubt`
      const childError = validateNodes(node.children, level + 1)
      if (childError) return childError
    }
  }
  return null
}

export async function GET() {
  try {
    const struktur = await getOrdnerstruktur()
    return NextResponse.json({ success: true, data: struktur })
  } catch (err) {
    console.error('[GET /api/dokument-kategorien]', err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<Ordnerstruktur>

    for (const typ of ['privat', 'gewerbe'] as const) {
      const error = validateNodes(body[typ] ?? [], 1)
      if (error) {
        return NextResponse.json({ success: false, error }, { status: 400 })
      }
    }

    const value: Ordnerstruktur = {
      privat: (body.privat ?? []).map(cleanNode),
      gewerbe: (body.gewerbe ?? []).map(cleanNode),
    }

    const supabase = createServerClient()
    const { error } = await supabase.from('system_config').upsert(
      {
        key: 'dokument_ordnerstruktur',
        config: value,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    )

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true, data: value })
  } catch (err) {
    console.error('[PATCH /api/dokument-kategorien]', err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}

function cleanNode(node: OrdnerstrukturNode): OrdnerstrukturNode {
  const cleaned: OrdnerstrukturNode = { name: node.name.trim() }
  if (Array.isArray(node.children) && node.children.length > 0) {
    cleaned.children = node.children.map((c) => ({ name: c.name.trim() }))
  }
  return cleaned
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (body.action !== 'rename') {
      return NextResponse.json({ success: false, error: 'Unbekannte Aktion' }, { status: 400 })
    }

    const typ = String(body.typ)
    const oldPfad = String(body.oldPfad ?? '').trim()
    const newPfad = String(body.newPfad ?? '').trim()

    if (!['privat', 'gewerbe'].includes(typ)) {
      return NextResponse.json({ success: false, error: 'typ muss privat oder gewerbe sein' }, { status: 400 })
    }
    if (!oldPfad || !newPfad || oldPfad === newPfad) {
      return NextResponse.json({ success: false, error: 'oldPfad und newPfad erforderlich' }, { status: 400 })
    }
    const newName = newPfad.split('/').pop()!
    if (!newName || newName.toLowerCase() === RESERVED) {
      return NextResponse.json({ success: false, error: 'Ungültiger neuer Name' }, { status: 400 })
    }

    const result = await renameKategorieFolders(typ as 'privat' | 'gewerbe', oldPfad, newPfad)
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    console.error('[POST /api/dokument-kategorien]', err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
