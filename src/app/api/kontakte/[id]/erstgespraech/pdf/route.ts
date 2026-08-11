import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import { buildErstgespraechPdfBuffer, type ErstgespraechPdfSection } from '@/lib/erstgespraech-pdf'

interface LeitfadenFrage {
  felder?: Array<{ feld?: string; label?: string }>
}

function displayValue(value: unknown): string {
  if (value === true) return 'Ja'
  if (value === false) return 'Nein'
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return Response.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 })

  const includeEmpty = new URL(request.url).searchParams.get('includeEmpty') === 'true'
  const supabase = createServerClient()
  const [{ data: contact, error }, { data: assignments }] = await Promise.all([
    supabase.from('contacts').select('*').eq('id', params.id).single(),
    supabase
      .from('contact_sparte_map')
      .select('is_primary, sparte:sparte_id(id, name, leitfaden_fragen)')
      .eq('contact_id', params.id),
  ])

  if (error || !contact || (contact.is_test_data && !currentUser.showTestData)) {
    return Response.json({ success: false, error: 'Kontakt nicht gefunden' }, { status: 404 })
  }

  const baseFields = [
    { label: 'Vorname', value: displayValue(contact.first_name) },
    { label: 'Nachname', value: displayValue(contact.last_name) },
    { label: 'E-Mail', value: displayValue(contact.email) },
    { label: 'Telefon', value: displayValue(contact.phone_mobile) },
    { label: 'Notizen', value: displayValue(contact.notes) },
  ]

  const sections: ErstgespraechPdfSection[] = [{
    title: 'Kontakt und Gesprächsnotizen',
    fields: includeEmpty ? baseFields : baseFields.filter((field) => field.value),
  }]

  for (const assignment of assignments ?? []) {
    const sparte = assignment.sparte as any
    const seen = new Set<string>()
    const fields = ((sparte?.leitfaden_fragen ?? []) as LeitfadenFrage[]).flatMap((question) =>
      (question.felder ?? []).flatMap((field) => {
        if (!field.feld || !field.label || seen.has(field.feld)) return []
        seen.add(field.feld)
        const value = displayValue(contact[field.feld])
        return includeEmpty || value ? [{ label: field.label, value }] : []
      })
    )
    if (fields.length > 0 || includeEmpty) sections.push({ title: sparte?.name || 'Erstgespräch', fields })
  }

  try {
    const pdf = await buildErstgespraechPdfBuffer(`${contact.first_name} ${contact.last_name}`.trim(), sections)
    const safeName = `${contact.first_name}-${contact.last_name}`.replace(/[^a-zA-Z0-9äöüÄÖÜß]+/g, '-')
    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Erstgespraech-${safeName}.pdf"`,
      },
    })
  } catch (pdfError) {
    console.error('[GET Erstgespräch-PDF] Erstellung fehlgeschlagen:', pdfError)
    return Response.json({ success: false, error: 'PDF-Erstellung fehlgeschlagen' }, { status: 500 })
  }
}
