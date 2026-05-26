// Webhook: Facebook Lead Ads
// GET  — Webhook-Verifizierung durch Facebook (einmalig beim Setup)
// POST — Eingehende Leads aus Facebook Lead Ads verarbeiten
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import type { FacebookLeadPayload } from '@/types'

const VERIFY_TOKEN = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN

// Facebook Webhook-Verifizierung (Challenge-Response)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('hub.mode')
    const token = searchParams.get('hub.verify_token')
    const challenge = searchParams.get('hub.challenge')

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('[Facebook Webhook] Verifizierung erfolgreich')
      return new Response(challenge, { status: 200 })
    }

    console.warn('[Facebook Webhook] Verifizierung fehlgeschlagen — ungültiger Token')
    return new Response('Forbidden', { status: 403 })
  } catch (error) {
    console.error('[GET /api/webhooks/facebook] Fehler:', error)
    return new Response('Interner Fehler', { status: 500 })
  }
}

// Eingehende Lead Ads Daten verarbeiten
export async function POST(request: NextRequest) {
  try {
    const body: FacebookLeadPayload = await request.json()

    if (body.object !== 'page') {
      return Response.json({ success: false, error: 'Unbekannter Webhook-Typ' }, { status: 400 })
    }

    const supabase = createServerClient()
    const processedLeads: string[] = []

    for (const entry of body.entry) {
      for (const change of entry.changes) {
        if (change.field !== 'leadgen') continue

        const leadgenId = change.value.leadgen_id
        const fieldData = change.value.field_data ?? []

        // Felder aus dem Facebook-Formular extrahieren
        const getField = (name: string) =>
          fieldData.find((f) => f.name === name)?.values[0] ?? ''

        const firstName = getField('first_name')
        const lastName = getField('last_name')
        const email = getField('email')
        const phone = getField('phone_number')

        if (!email && !phone) {
          console.warn(`[Facebook Webhook] Lead ${leadgenId} ohne Kontaktdaten übersprungen`)
          continue
        }

        // Duplikat-Prüfung anhand leadgen_id
        const { data: existing } = await supabase
          .from('leads')
          .select('id')
          .eq('source', 'facebook')
          .contains('research_data', { leadgen_id: leadgenId })
          .maybeSingle()

        if (existing) {
          console.log(`[Facebook Webhook] Lead ${leadgenId} bereits vorhanden`)
          continue
        }

        // Lead in Supabase speichern
        const { data: lead, error } = await supabase
          .from('leads')
          .insert({
            first_name: firstName,
            last_name: lastName,
            email: email || null,
            phone: phone || null,
            source: 'facebook',
            status: 'new',
            research_data: {
              leadgen_id: leadgenId,
              page_id: change.value.page_id,
              form_id: change.value.form_id,
              ad_id: change.value.ad_id,
              raw_fields: fieldData,
            },
          })
          .select()
          .single()

        if (error) {
          console.error(`[Facebook Webhook] Insert Fehler für ${leadgenId}:`, error)
          continue
        }

        // Aktivität protokollieren
        await supabase.from('activities').insert({
          lead_id: lead.id,
          type: 'sync',
          description: 'Lead via Facebook Lead Ads eingegangen',
          data: { leadgen_id: leadgenId, ad_id: change.value.ad_id },
        })

        processedLeads.push(lead.id)
      }
    }

    console.log(`[Facebook Webhook] ${processedLeads.length} Leads verarbeitet`)
    return Response.json({ success: true, data: { processed: processedLeads.length } })
  } catch (error) {
    console.error('[POST /api/webhooks/facebook] Fehler:', error)
    return Response.json({ success: false, error: 'Webhook-Verarbeitung fehlgeschlagen' }, { status: 500 })
  }
}
