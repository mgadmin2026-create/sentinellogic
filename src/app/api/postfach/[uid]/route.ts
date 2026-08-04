import { createServerClient } from '@/lib/supabase/server'
import { getInboxMessage, StratoMailConfigurationError } from '@/lib/strato-mail'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(_request: Request, { params }: { params: { uid: string } }) {
  const uid = Number(params.uid)
  if (!Number.isInteger(uid) || uid < 1) {
    return Response.json({ success: false, error: 'Ungültige Nachrichten-ID' }, { status: 400 })
  }

  try {
    const message = await getInboxMessage(uid)
    if (!message) return Response.json({ success: false, error: 'Nachricht nicht gefunden' }, { status: 404 })

    const sender = message.from[0]?.address
    if (sender) {
      const supabase = createServerClient()
      const { data: contact } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, company_name')
        .eq('email', sender.toLowerCase())
        .maybeSingle()

      if (contact) {
        message.contact = {
          id: contact.id,
          name: `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || contact.company_name || sender,
        }
      }
    }

    return Response.json({ success: true, data: message })
  } catch (error) {
    console.error('[Postfach] Nachricht konnte nicht geladen werden:', error instanceof Error ? error.name : 'Unbekannter Fehler')
    const missingConfig = error instanceof StratoMailConfigurationError
    return Response.json({
      success: false,
      configured: !missingConfig,
      error: missingConfig
        ? error.message
        : 'Die Nachricht konnte nicht aus dem STRATO-Postfach geladen werden.',
    }, { status: missingConfig ? 503 : 502 })
  }
}
