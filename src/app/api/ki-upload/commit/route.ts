// POST /api/ki-upload/commit — geprüfte Extraktion übernehmen
// 1. Kontakt anlegen via interner POST /api/kontakte (Reuse: Duplikat-Check,
//    Automation-Engine, KlickTipp- & Dialfire-Sync) ODER bestehenden Kontakt nutzen
// 2. Versicherungsfelder per PATCH nachziehen
// 3. Dokument via interner POST /api/kontakte/[id]/dokumente in Google Drive ablegen
//    (Kompression, Kategorie-Ordner, Metadaten, Statistik, Activity-Log)
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activities-logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

interface Leistung {
  type: string
  description: string
  coverage?: string
}

interface CommitDaten {
  existing_kontakt_id?: string
  first_name: string
  last_name: string
  company_name?: string
  email?: string
  phone?: string
  street?: string
  postal_code?: string
  city?: string
  country?: string
  kontakt_typ: 'privat' | 'gewerbe'
  kategorie: string
  versicherungsgesellschaft?: string
  versicherungstyp?: string
  sparte?: string
  zahlweise?: string
  vertragsnummer?: string
  beitrag?: string
  vertragsbeginn?: string
  vertragsende?: string
  dokumenttyp?: string
  zusammenfassung?: string
  weitere_personen?: string[]
  // Vertragsdetails (neu v0.6.0)
  is_contract?: boolean
  contract_type?: 'eigen' | 'fremd' | 'unknown'
  benefits?: Leistung[]
}

function buildNotes(d: CommitDaten): string {
  const zeilen = [
    `[KI-Upload ${new Date().toISOString().slice(0, 10)}] ${d.zusammenfassung || 'Dokument analysiert'}`,
    d.vertragsnummer ? `Vertragsnummer: ${d.vertragsnummer}` : null,
    d.beitrag ? `Beitrag: ${d.beitrag}` : null,
    d.vertragsbeginn ? `Vertragsbeginn: ${d.vertragsbeginn}` : null,
    d.vertragsende ? `Vertragsende: ${d.vertragsende}` : null,
    d.is_contract && d.contract_type ? `Vertragstyp: ${d.contract_type === 'eigen' ? '🟢 Eigenvertrag' : d.contract_type === 'fremd' ? '🔵 Fremdvertrag' : '🟡 Unbekannt'}` : null,
    d.benefits?.length ? `Leistungen:\n${d.benefits.map((l) => `  • ${l.type}: ${l.description}${l.coverage ? ` (${l.coverage})` : ''}`).join('\n')}` : null,
    d.weitere_personen?.length ? `Weitere versicherte Personen: ${d.weitere_personen.join(', ')}` : null,
  ].filter(Boolean)
  return zeilen.join('\n')
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const datenRaw = formData.get('daten')

    if (!file || typeof datenRaw !== 'string') {
      return NextResponse.json(
        { success: false, error: 'file und daten erforderlich' },
        { status: 400 }
      )
    }
    const daten = JSON.parse(datenRaw) as CommitDaten
    const origin = request.nextUrl.origin
    const notes = buildNotes(daten)

    // ── 1. Kontakt bestimmen ─────────────────────────────────────
    let kontaktId = daten.existing_kontakt_id || null
    let kontaktNeu = false

    if (!kontaktId) {
      const createRes = await fetch(`${origin}/api/kontakte`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: daten.first_name,
          last_name: daten.last_name,
          company_name: daten.company_name || null,
          email: daten.email || null,
          phone_mobile: daten.phone || null,
          street: daten.street || null,
          postal_code: daten.postal_code || null,
          city: daten.city || null,
          country: daten.country || null,
          kontakt_typ: daten.kontakt_typ,
          source: 'ki_upload',
          notes,
        }),
      })
      const createData = await createRes.json()

      if (createRes.status === 409 && createData.existing?.id) {
        // Duplikat zwischen Analyse und Commit entstanden -> anhaengen
        kontaktId = createData.existing.id
      } else if (!createData.success) {
        return NextResponse.json(
          { success: false, error: `Kontakt anlegen fehlgeschlagen: ${createData.error}` },
          { status: 502 }
        )
      } else {
        kontaktId = createData.data.id
        kontaktNeu = true
      }
    }

    // ── 2. Versicherungsfelder nachziehen ────────────────────────
    const patchFelder: Record<string, string> = {}
    if (daten.versicherungsgesellschaft) patchFelder.versicherungsgesellschaft = daten.versicherungsgesellschaft
    if (daten.versicherungstyp) patchFelder.versicherungstyp = daten.versicherungstyp
    if (daten.sparte) patchFelder.sparte = daten.sparte
    if (daten.zahlweise) patchFelder.zahlweise = daten.zahlweise

    if (Object.keys(patchFelder).length > 0) {
      const patchRes = await fetch(`${origin}/api/kontakte/${kontaktId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchFelder),
      })
      if (!patchRes.ok) {
        console.warn('[KI-Upload] Versicherungsfelder-PATCH fehlgeschlagen (nicht blockierend)')
      }
    }

    // ── 3. Dokument in Google Drive ablegen ──────────────────────
    const uploadForm = new FormData()
    uploadForm.append('file', file)
    uploadForm.append('kategorie', daten.kategorie || 'Sonstiges')

    const uploadRes = await fetch(`${origin}/api/kontakte/${kontaktId}/dokumente`, {
      method: 'POST',
      body: uploadForm,
    })
    const uploadData = await uploadRes.json()

    if (!uploadRes.ok) {
      // Kontakt existiert bereits — Fehler klar melden, nichts zurueckrollen
      return NextResponse.json(
        {
          success: false,
          kontakt_id: kontaktId,
          kontakt_neu: kontaktNeu,
          error: `Kontakt ${kontaktNeu ? 'angelegt' : 'gefunden'}, aber Drive-Ablage fehlgeschlagen: ${uploadData.error || uploadRes.status}`,
        },
        { status: 502 }
      )
    }

    // ── 3.5 Vertrags-Detailsdaten speichern ────────────────────────
    if (daten.is_contract && daten.benefits) {
      const supabase = createServerClient()
      try {
        await supabase.from('contracts').insert({
          contact_id: kontaktId,
          contract_number: daten.vertragsnummer || null,
          insurance_type: daten.versicherungsgesellschaft || null,
          contract_type: daten.contract_type || 'unknown',
          insurance_category: daten.versicherungstyp || null,
          monthly_premium: daten.beitrag || null,
          duration_start: daten.vertragsbeginn ? new Date(daten.vertragsbeginn).toISOString().split('T')[0] : null,
          duration_end: daten.vertragsende ? new Date(daten.vertragsende).toISOString().split('T')[0] : null,
          benefits: daten.benefits,
          created_by: 'ki_upload',
        })
      } catch (err) {
        console.warn('[KI-Upload] Contracts-Speicherung fehlgeschlagen (nicht blockierend):', err)
      }
    }

    // Activity: KI-Upload dokumentieren
    try {
      await logActivity(
        null,
        kontaktId!,
        'automation_executed',
        `🤖 KI-Upload: "${file.name}" analysiert (${daten.dokumenttyp || 'Dokument'}) und unter "${daten.kategorie}" abgelegt${kontaktNeu ? ' — Kontakt automatisch erstellt' : ''}`,
        { quelle: 'ki_upload', kategorie: daten.kategorie }
      )
    } catch {
      // nicht blockierend
    }

    return NextResponse.json({
      success: true,
      kontakt_id: kontaktId,
      kontakt_neu: kontaktNeu,
      dokument: uploadData.dokument,
    })
  } catch (err) {
    console.error('[KI-Upload] Commit-Fehler:', err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
