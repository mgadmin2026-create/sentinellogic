// API Route: Kontakte exportieren
// GET /api/kontakte/export?format=csv|xlsx|pdf&<gleiche Filter wie /api/kontakte + Liste>
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { applyKontakteFilters } from '@/lib/kontakte-filters'
import { buildContactsPdfBuffer, type ExportRow } from '@/lib/kontakte-export-pdf'
import ExcelJS from 'exceljs'

const VALID_STATUSES = ['new', 'contacted', 'qualified', 'customer']

const STATUS_LABELS: Record<string, string> = {
  new: 'Neu', contacted: 'Kontaktiert', qualified: 'Qualifiziert', customer: 'Kunde',
}
const SOURCE_LABELS: Record<string, string> = {
  manuell: 'Manuell', csv: 'CSV', facebook: 'Facebook', tiktok: 'TikTok', calendly: 'Calendly', email: 'E-Mail', ki_upload: 'KI Upload',
}
const PIPELINE_LABELS: Record<string, string> = {
  lead_in: 'Lead kommt rein', contacted: 'Lead wird kontaktiert', data_gathering: 'Daten werden eingeholt',
  wait_policies: 'Warten auf Policen', calc_offers: 'Angebote berechnen', download_offers: 'Angebote herunterladen & ablegen',
  contract_overview: 'Vertragsübersicht erstellen', send_offers: 'Angebote senden', offer_meeting: 'Angebotsbesprechung (Termin)',
  sales_talk: 'Verkaufsgespräch', contracts_store: 'Verträge ablegen', aftercare: 'Nachbereitung',
}

function toCsv(rows: Record<string, any>[]): string {
  if (!rows.length) return ''
  const cols = Object.keys(rows[0])
  const escape = (v: any) => {
    if (v === null || v === undefined) return ''
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = cols.join(',')
  const body = rows.map((r) => cols.map((c) => escape(r[c])).join(',')).join('\n')
  return `${header}\n${body}`
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const url = new URL(request.url)
    const format = url.searchParams.get('format')
    if (!format || !['csv', 'xlsx', 'pdf'].includes(format)) {
      return Response.json({ success: false, error: 'format muss csv, xlsx oder pdf sein' }, { status: 400 })
    }

    const status = url.searchParams.get('status')
    const search = url.searchParams.get('search')
    const includeArchived = url.searchParams.get('includeArchived') === 'true'
    const source = url.searchParams.get('source')
    const kontaktTyp = url.searchParams.get('kontakt_typ')
    const pipelineStage = url.searchParams.get('pipeline_stage')
    const sparte = url.searchParams.get('sparte')
    const pruefungGrund = url.searchParams.get('pruefung_grund')
    const tagIds = (url.searchParams.get('tags') || '').split(',').filter(Boolean)

    let query = supabase.from('contacts').select('*').order('created_at', { ascending: false })
    if (!includeArchived) query = query.is('archived_at', null)
    if (status && VALID_STATUSES.includes(status)) query = query.eq('status', status)
    if (search) {
      const q = `%${search}%`
      query = query.or(`first_name.ilike.${q},last_name.ilike.${q},email.ilike.${q},company_name.ilike.${q}`)
    }

    const { data, error } = await query.limit(5000)
    if (error) {
      console.error('[GET /api/kontakte/export] Fehler:', error)
      return Response.json({ success: false, error: error.message }, { status: 500 })
    }

    let contacts = data ?? []

    // Tags gebündelt nachladen
    if (contacts.length > 0) {
      const { data: tagRows } = await supabase
        .from('contact_tag_map')
        .select('contact_id, tag:tag_id(id, name)')
        .in('contact_id', contacts.map((c) => c.id))

      const tagsByContact = new Map<string, { id: string; name: string }[]>()
      for (const row of tagRows ?? []) {
        const list = tagsByContact.get((row as any).contact_id) ?? []
        list.push((row as any).tag)
        tagsByContact.set((row as any).contact_id, list)
      }
      contacts = contacts.map((c) => ({ ...c, tags: tagsByContact.get(c.id) ?? [] }))
    }

    // Restliche Filter (die GET /api/kontakte noch nicht serverseitig kennt)
    contacts = applyKontakteFilters(contacts, { source, kontaktTyp, pipelineStage, sparte, pruefungGrund, tagIds })

    const dateStr = new Date().toISOString().split('T')[0]
    const filenameBase = `kontakte_export_${dateStr}`

    if (format === 'csv') {
      const rows = contacts.map((c) => ({
        ...c,
        tags: (c.tags ?? []).map((t: any) => t.name).join(', '),
      }))
      const csv = toCsv(rows)
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filenameBase}.csv"`,
        },
      })
    }

    // Kuratierte Spalten für Excel/PDF (60+ Spalten sind im Querformat nicht lesbar)
    const exportRows: ExportRow[] = contacts.map((c) => ({
      name: `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim(),
      company: c.company_name ?? '',
      email: c.email ?? '',
      phone: c.phone_mobile ?? c.phone_office ?? '',
      status: STATUS_LABELS[c.status] ?? c.status ?? '',
      pipelineStage: PIPELINE_LABELS[c.pipeline_stage] ?? c.pipeline_stage ?? '',
      source: SOURCE_LABELS[c.source] ?? c.source ?? '',
      sparte: c.sparte ?? '',
      kontaktTyp: c.kontakt_typ === 'privat' ? 'Privat' : 'Gewerbe',
      tags: (c.tags ?? []).map((t: any) => t.name).join(', '),
      createdAt: c.created_at ? new Date(c.created_at).toLocaleDateString('de-DE') : '',
    }))

    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook()
      const sheet = workbook.addWorksheet('Kontakte')
      const columns = [
        { header: 'Name', key: 'name', width: 24 },
        { header: 'Firma', key: 'company', width: 24 },
        { header: 'E-Mail', key: 'email', width: 28 },
        { header: 'Telefon', key: 'phone', width: 18 },
        { header: 'Status', key: 'status', width: 14 },
        { header: 'Pipeline-Stufe', key: 'pipelineStage', width: 26 },
        { header: 'Quelle', key: 'source', width: 14 },
        { header: 'Sparte', key: 'sparte', width: 18 },
        { header: 'Typ', key: 'kontaktTyp', width: 10 },
        { header: 'Tags', key: 'tags', width: 24 },
        { header: 'Erstellt am', key: 'createdAt', width: 14 },
      ]
      sheet.columns = columns
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } }
      exportRows.forEach((row) => sheet.addRow(row))
      sheet.views = [{ state: 'frozen', ySplit: 1 }]

      const buffer = await workbook.xlsx.writeBuffer()
      return new Response(new Uint8Array(buffer as ArrayBuffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filenameBase}.xlsx"`,
        },
      })
    }

    // format === 'pdf'
    const filterParts: string[] = []
    if (status) filterParts.push(`Status: ${STATUS_LABELS[status] ?? status}`)
    if (search) filterParts.push(`Suche: "${search}"`)
    if (source) filterParts.push(`Quelle: ${SOURCE_LABELS[source] ?? source}`)
    const filterSummary = filterParts.length > 0 ? filterParts.join(' · ') : 'Alle Kontakte'

    const pdfBuffer = await buildContactsPdfBuffer(exportRows, filterSummary)
    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filenameBase}.pdf"`,
      },
    })
  } catch (err) {
    console.error('[GET /api/kontakte/export] Fehler:', err)
    return Response.json({ success: false, error: 'Export fehlgeschlagen' }, { status: 500 })
  }
}
