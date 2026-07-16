import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params

    // Fetch verträge (Contracts) for this contact
    const { data, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('contact_id', id)
      .order('created_at', { ascending: false })

    if (error) throw error

    return Response.json({
      success: true,
      data: data || [],
    })
  } catch (err: any) {
    console.error('Error fetching verträge:', err)
    return Response.json(
      { success: false, error: err.message },
      { status: 500 }
    )
  }
}
