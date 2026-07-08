import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET: Verträge eines Kontakts laden
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const kontaktId = params.id

  try {
    const supabase = createServerClient()

    const { data: contracts, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('contact_id', kontaktId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Vertraege] Error fetching contracts:', error)
      return NextResponse.json({ error: 'Failed to fetch contracts' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      contracts: contracts || [],
    })
  } catch (err) {
    console.error('[Vertraege] GET error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
