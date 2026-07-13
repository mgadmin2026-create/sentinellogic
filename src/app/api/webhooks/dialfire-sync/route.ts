import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

interface DialfireContact {
  $id: string
  $ref?: string
  $phone?: string
  email?: string
  [key: string]: any
}

interface DialfireWebhookPayload {
  contact: DialfireContact
  state: 'new' | 'updated'
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as DialfireWebhookPayload
    const dialfireContact = payload.contact

    if (!dialfireContact?.$id) {
      return Response.json({ error: 'Missing Dialfire contact ID' }, { status: 400 })
    }

    const supabase = createServerClient()

    // Finde Supabase-Kontakt via $ref (externe Referenz)
    let supabaseContactId = dialfireContact.$ref

    if (!supabaseContactId) {
      // Fallback: Suche via Email
      if (dialfireContact.email) {
        const { data: existing } = await supabase
          .from('contacts')
          .select('id')
          .eq('email', dialfireContact.email)
          .single()

        if (!existing) {
          console.warn(`No Supabase contact found for Dialfire ID ${dialfireContact.$id}`)
          return Response.json({ success: true, message: 'No matching contact' })
        }

        supabaseContactId = existing.id
      } else {
        return Response.json({ error: 'Cannot identify contact' }, { status: 400 })
      }
    }

    // Update Supabase mit Dialfire-Daten
    const updateData: Record<string, any> = {
      dialfire_id: dialfireContact.$id,
      dialfire_updated_at: new Date().toISOString(),
    }

    // Optionale Felder aktualisieren
    if (dialfireContact.$phone) {
      updateData.phone_mobile = dialfireContact.$phone
    }
    if (dialfireContact.email) {
      updateData.email = dialfireContact.email
    }

    const { error } = await supabase
      .from('contacts')
      .update(updateData)
      .eq('id', supabaseContactId)

    if (error) {
      console.error('Update error:', error)
      return Response.json({ error: error.message }, { status: 500 })
    }

    console.log(`✅ Dialfire contact ${dialfireContact.$id} synced to Supabase`)

    return Response.json({ success: true })
  } catch (err) {
    console.error('[POST /api/webhooks/dialfire-sync] Error:', err)
    return Response.json({ error: String(err) }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return Response.json({
    success: true,
    message: 'Dialfire Sync Webhook - POST only',
  })
}
