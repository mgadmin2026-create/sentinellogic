import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function GET(request: NextRequest, { params }: { params: { contactId: string } }) {
  const contactId = params.contactId

  try {
    // Get the latest Dialfire sync snapshot for this contact
    const { data, error } = await supabase
      .from('dialfire_sync_snapshots')
      .select('dialfire_flat_view, created_at')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Keine Dialfire Response vorhanden' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        dialfire_flat_view: data.dialfire_flat_view,
        created_at: data.created_at,
      },
    })
  } catch (err) {
    console.error('Error fetching Dialfire snapshot:', err)
    return NextResponse.json(
      { success: false, error: 'Fehler beim Laden der Dialfire Response' },
      { status: 500 }
    )
  }
}
