import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET: Alle Dokumente über alle Kontakte + Aggregat-Statistik
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const search = request.nextUrl.searchParams.get('search')?.trim() || ''

    let query = supabase
      .from('dokumente_metadata')
      .select(
        'id, file_id, file_name, file_type, kategorie, original_size, compressed_size, compression_ratio, created_at, kontakt_id, ordner_id, contacts(first_name, last_name)'
      )
      .eq('ordner_archived', false)
      .order('created_at', { ascending: false })
      .limit(2000)

    if (search) {
      query = query.ilike('file_name', `%${search}%`)
    }

    const { data, error } = await query

    if (error) {
      console.error('[Dokumente] List error:', error)
      return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
    }

    const rows = (data || []).map((d: any) => {
      const c = Array.isArray(d.contacts) ? d.contacts[0] : d.contacts
      const kontaktName = c ? `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() : null
      return {
        id: d.id,
        file_id: d.file_id,
        file_name: d.file_name,
        file_type: d.file_type,
        kategorie: d.kategorie || 'Sonstiges',
        original_size: d.original_size || 0,
        compressed_size: d.compressed_size || 0,
        compression_ratio: d.compression_ratio || 0,
        created_at: d.created_at,
        kontakt_id: d.kontakt_id,
        kontakt_name: kontaktName || '(gelöschter Kontakt)',
        drive_url: `https://drive.google.com/file/d/${d.file_id}/view`,
        ordner_url: `https://drive.google.com/drive/folders/${d.ordner_id}`,
      }
    })

    const stats = rows.reduce(
      (acc, r) => {
        acc.count += 1
        acc.totalOriginal += r.original_size
        acc.totalCompressed += r.compressed_size
        return acc
      },
      { count: 0, totalOriginal: 0, totalCompressed: 0 }
    )

    return NextResponse.json({
      success: true,
      stats: {
        count: stats.count,
        totalCompressed: stats.totalCompressed,
        totalSaved: Math.max(0, stats.totalOriginal - stats.totalCompressed),
      },
      dokumente: rows,
    })
  } catch (err) {
    console.error('[Dokumente] GET error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
