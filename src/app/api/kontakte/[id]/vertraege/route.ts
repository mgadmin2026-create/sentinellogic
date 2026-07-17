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

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const body = await req.json()
    const { contractId } = body

    if (!contractId) {
      return Response.json(
        { success: false, error: 'contractId erforderlich' },
        { status: 400 }
      )
    }

    // Überprüfen, ob der Vertrag zum Kontakt gehört
    const { data: contract, error: fetchError } = await supabase
      .from('contracts')
      .select('id')
      .eq('id', contractId)
      .eq('contact_id', id)
      .single()

    if (fetchError || !contract) {
      return Response.json(
        { success: false, error: 'Vertrag nicht gefunden' },
        { status: 404 }
      )
    }

    // Vertrag löschen
    const { error: deleteError } = await supabase
      .from('contracts')
      .delete()
      .eq('id', contractId)

    if (deleteError) throw deleteError

    return Response.json({
      success: true,
      message: 'Vertrag gelöscht',
    })
  } catch (err: any) {
    console.error('Error deleting contract:', err)
    return Response.json(
      { success: false, error: err.message },
      { status: 500 }
    )
  }
}
