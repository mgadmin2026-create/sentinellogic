import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

/**
 * POST /api/kontakte/[id]/dokumente/save-contract
 * Speichert einen erkannten Vertrag mit optional geändertem Namen
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const kontaktId = params.id

  try {
    const supabase = createServerClient()
    const body = await request.json()
    const { first_name, last_name, email, company_name, contract_data } = body

    if (!contract_data || !first_name || !last_name) {
      return NextResponse.json(
        { error: 'first_name, last_name und contract_data erforderlich' },
        { status: 400 }
      )
    }

    // Prüfe, ob es noch immer einen Duplikat-Kontakt mit den NEUEN Namen gibt
    const { data: stillDuplicate } = await supabase
      .from('contacts')
      .select('id')
      .ilike('first_name', first_name.trim())
      .ilike('last_name', last_name.trim())
      .neq('id', kontaktId)
      .maybeSingle()

    if (stillDuplicate) {
      return NextResponse.json(
        {
          error: `Kontakt mit Name "${first_name} ${last_name}" existiert bereits`,
          duplicate: stillDuplicate,
        },
        { status: 409 }
      )
    }

    // Aktualisiere den Kontakt mit neuen Namen (falls unterschiedlich)
    const { data: currentContact } = await supabase
      .from('contacts')
      .select('first_name, last_name, email')
      .eq('id', kontaktId)
      .single()

    if (
      currentContact?.first_name !== first_name ||
      currentContact?.last_name !== last_name ||
      (email && currentContact?.email !== email)
    ) {
      await supabase
        .from('contacts')
        .update({
          first_name,
          last_name,
          ...(email && { email }),
          ...(company_name && { company_name }),
        })
        .eq('id', kontaktId)
    }

    // Speichere den Vertrag
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .insert({
        contact_id: kontaktId,
        contract_number: contract_data.contract_number || null,
        insurance_type: contract_data.insurance_type || null,
        contract_type: contract_data.contract_type || 'unknown',
        insurance_category: contract_data.insurance_category || null,
        monthly_premium: contract_data.monthly_premium || null,
        duration_start: contract_data.duration_start || null,
        duration_end: contract_data.duration_end || null,
        benefits: contract_data.benefits || null,
        created_by: 'dokument_upload_manual',
      })
      .select()
      .single()

    if (contractError) {
      console.error('[save-contract] Fehler beim Speichern:', contractError)
      return NextResponse.json(
        { error: 'Vertrag konnte nicht gespeichert werden' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      contract,
      message: `Vertrag gespeichert für ${first_name} ${last_name}`,
    })
  } catch (err) {
    console.error('[save-contract] Fehler:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Fehler beim Speichern' },
      { status: 500 }
    )
  }
}
