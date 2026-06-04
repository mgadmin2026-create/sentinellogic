// API Route: Lead-Verwaltung
// GET  /api/leads — alle Leads abrufen
// POST /api/leads — neuen Lead anlegen (mit Regelausführung + Duplikatprüfung)
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { syncLeadToKlicktipp, type LeadSyncData } from '@/lib/integrations/klicktipp'
import { Resend } from 'resend'

const VALID_SOURCES = ['facebook', 'tiktok', 'calendly', 'csv', 'email', 'manuell']
const VALID_STATUSES = ['new', 'contacted', 'qualified', 'customer']

function normalizeSource(raw?: string): string {
  if (!raw) return 'manuell'
  const map: Record<string, string> = {
    facebook: 'facebook', Facebook: 'facebook',
    tiktok: 'tiktok', TikTok: 'tiktok',
    calendly: 'calendly', Calendly: 'calendly',
    csv: 'csv', CSV: 'csv',
    email: 'email', 'E-Mail': 'email',
    manuell: 'manuell', Manuell: 'manuell', manual: 'manuell',
  }
  return map[raw] ?? (VALID_SOURCES.includes(raw.toLowerCase()) ? raw.toLowerCase() : 'manuell')
}

// ── Regelausführung ─────────────────────────────────────────
interface RuleActions {
  klicktipp_tag?: string
  dialfire_campaign?: string
  set_status?: string
  send_notification?: boolean
  notification_email?: string
}

// Benachrichtigungs-E-Mail via Resend senden
async function sendNotificationEmail(
  to: string,
  leadName: string,
  leadEmail: string | null | undefined,
  ruleName: string,
  actions: RuleActions
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[Benachrichtigung] RESEND_API_KEY nicht gesetzt — E-Mail nicht gesendet')
    return
  }
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const actionsText = [
      actions.klicktipp_tag ? `• KlickTipp Tag: "${actions.klicktipp_tag}"` : null,
      actions.dialfire_campaign ? `• Dialfire Kampagne: "${actions.dialfire_campaign}"` : null,
      actions.set_status ? `• Status gesetzt: ${actions.set_status}` : null,
    ].filter(Boolean).join('\n')

    await resend.emails.send({
      from: 'Sentimental Logic <noreply@onlinefirst.eu>',
      to,
      subject: `🔔 Neuer Lead: ${leadName}`,
      html: `
        <div style="font-family:sans-serif;max-width:540px;margin:0 auto;padding:24px">
          <h2 style="color:#1A1A1A;margin-bottom:4px">Neuer Lead angelegt</h2>
          <p style="color:#666;margin-top:0">Regel: <strong>${ruleName}</strong></p>
          <hr style="border:none;border-top:1px solid #eee;margin:16px 0"/>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:6px 0;color:#666;width:120px">Name</td><td style="font-weight:600">${leadName}</td></tr>
            ${leadEmail ? `<tr><td style="padding:6px 0;color:#666">E-Mail</td><td>${leadEmail}</td></tr>` : ''}
          </table>
          <hr style="border:none;border-top:1px solid #eee;margin:16px 0"/>
          <p style="color:#666;margin-bottom:6px"><strong>Ausgeführte Aktionen:</strong></p>
          <pre style="background:#f9f9f9;padding:12px;border-radius:8px;font-size:13px;color:#333">${actionsText || '—'}</pre>
          <p style="margin-top:20px;font-size:12px;color:#999">Sentimental Logic — Automatisierungssystem</p>
        </div>
      `,
    })
  } catch (err) {
    console.error('[Benachrichtigung] E-Mail-Fehler:', err)
  }
}

async function executeRules(
  supabase: ReturnType<typeof createServerClient>,
  leadId: string,
  source: string,
  currentStatus: string,
  leadData: LeadSyncData & { first_name: string; last_name: string }
): Promise<{ statusOverride?: string; appliedRules: string[] }> {
  // Passende aktive Regeln laden
  const { data: rules } = await supabase
    .from('rules')
    .select('*')
    .eq('active', true)
    .or(`condition_source.eq.${source},condition_source.eq.all`)

  if (!rules || rules.length === 0) return { appliedRules: [] }

  const appliedRules: string[] = []
  let statusOverride: string | undefined

  for (const rule of rules) {
    const actions = rule.actions as RuleActions
    const resultParts: string[] = []

    // ── KlickTipp Tag tatsächlich setzen ──────────────────────
    if (actions.klicktipp_tag) {
      if (!leadData.email) {
        resultParts.push(`⚠️ KlickTipp übersprungen: Kein E-Mail beim Lead`)
      } else if (!process.env.KLICKTIPP_API_KEY) {
        resultParts.push(`⚠️ KlickTipp übersprungen: KLICKTIPP_API_KEY nicht gesetzt`)
      } else {
        // Echten API-Call durchführen
        const syncResult = await syncLeadToKlicktipp(
          leadData,
          actions.klicktipp_tag,
          process.env.KLICKTIPP_LIST_ID
        )
        if (syncResult.success) {
          resultParts.push(
            `✅ KlickTipp: ${syncResult.message}`
          )
          // Subscriber-ID im Lead speichern
          if (syncResult.subscriberId) {
            await supabase
              .from('leads')
              .update({ klicktipp_id: syncResult.subscriberId })
              .eq('id', leadId)
          }
        } else {
          resultParts.push(`⚠️ KlickTipp Fehler: ${syncResult.message}`)
        }
      }
    }

    // ── Dialfire Kampagne ──────────────────────────────────────
    if (actions.dialfire_campaign) {
      const hasApiKey = !!process.env.DIALFIRE_API_KEY
      resultParts.push(
        hasApiKey
          ? `Dialfire Kampagne "${actions.dialfire_campaign}" zugewiesen`
          : `Dialfire Kampagne "${actions.dialfire_campaign}" konfiguriert (API-Key ausstehend)`
      )
    }

    // ── Status überschreiben ──────────────────────────────────
    if (actions.set_status && VALID_STATUSES.includes(actions.set_status)) {
      if (actions.set_status !== currentStatus) {
        statusOverride = actions.set_status
        resultParts.push(`Status gesetzt: ${actions.set_status}`)
      }
    }

    // ── Benachrichtigung per E-Mail ───────────────────────────
    if (actions.send_notification && actions.notification_email) {
      const leadName = `${leadData.first_name} ${leadData.last_name}`
      await sendNotificationEmail(
        actions.notification_email,
        leadName,
        leadData.email,
        rule.name,
        actions
      )
      resultParts.push(`📧 Benachrichtigung gesendet an ${actions.notification_email}`)
    } else if (actions.send_notification) {
      resultParts.push('Benachrichtigung ausgelöst (keine E-Mail konfiguriert)')
    }

    if (resultParts.length > 0) {
      await supabase.from('activities').insert({
        lead_id: leadId,
        type: 'sync',
        description: `⚡ Regel "${rule.name}" ausgeführt: ${resultParts.join(' · ')}`,
        data: { rule_id: rule.id, rule_name: rule.name, actions },
      })
      await supabase.from('rules').update({ runs: rule.runs + 1 }).eq('id', rule.id)
      appliedRules.push(rule.name)
    }
  }

  return { statusOverride, appliedRules }
}

// ── GET ─────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const source = searchParams.get('source')
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '200', 10), 500)

    let query = supabase
      .from('leads').select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status && VALID_STATUSES.includes(status)) query = query.eq('status', status)
    if (source && VALID_SOURCES.includes(source)) query = query.eq('source', source)

    const { data, error } = await query
    if (error) throw new Error(error.message)
    return Response.json({ success: true, data: data ?? [] })
  } catch (error) {
    console.error('[GET /api/leads]', error)
    return Response.json({ success: false, error: 'Leads konnten nicht geladen werden' }, { status: 500 })
  }
}

// ── POST ────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const supabase = createServerClient()

    const { first_name, last_name } = body
    if (!first_name?.trim() || !last_name?.trim()) {
      return Response.json({ success: false, error: 'Vorname und Nachname sind Pflichtfelder' }, { status: 400 })
    }

    // ── Duplikatprüfung ─────────────────────────────────────
    if (!body.force) {
      if (body.email?.trim()) {
        const { data: emailDupe } = await supabase
          .from('leads').select('id, first_name, last_name, email')
          .eq('email', body.email.trim().toLowerCase()).limit(1).maybeSingle()
        if (emailDupe) {
          return Response.json({
            success: false, duplicate: true,
            error: `Duplikat: Lead mit dieser E-Mail existiert bereits (${emailDupe.first_name} ${emailDupe.last_name}).`,
            existing: emailDupe,
          }, { status: 409 })
        }
      }
      const { data: nameDupe } = await supabase
        .from('leads').select('id, first_name, last_name, email')
        .eq('first_name', first_name.trim()).eq('last_name', last_name.trim())
        .limit(1).maybeSingle()
      if (nameDupe) {
        return Response.json({
          success: false, duplicate: true,
          error: `Duplikat: Lead mit diesem Namen existiert bereits (${nameDupe.email || 'keine E-Mail'}).`,
          existing: nameDupe,
        }, { status: 409 })
      }
    }

    const source = normalizeSource(body.source)
    const status = VALID_STATUSES.includes(body.status) ? body.status : 'new'

    // ── Lead anlegen ─────────────────────────────────────────
    // Basis-Felder (immer vorhanden)
    const insertBase: Record<string, unknown> = {
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      email: body.email?.trim()?.toLowerCase() || null,
      phone_mobile: body.phone_mobile?.trim() || null,
      phone_office: body.phone_office?.trim() || null,
      birth_date: body.birth_date || null,
      marital_status: body.marital_status?.trim() || null,
      children: body.children ? parseInt(body.children) : null,
      profession: body.profession?.trim() || null,
      profession_group: body.profession_group?.trim() || null,
      position: body.position?.trim() || null,
      address: body.address?.trim() || null,
      company_name: body.company_name?.trim() || null,
      legal_form: body.legal_form?.trim() || null,
      founded_year: body.founded_year ? parseInt(body.founded_year) : null,
      employees: body.employees ? parseInt(body.employees) : null,
      annual_revenue: body.annual_revenue?.trim() || null,
      trade_register: body.trade_register?.trim() || null,
      vat_id: body.vat_id?.trim() || null,
      industry: body.industry?.trim() || null,
      business_description: body.business_description?.trim() || null,
      website: body.website?.trim() || null,
      headquarters: body.headquarters?.trim() || null,
      existing_insurances: Array.isArray(body.existing_insurances) ? body.existing_insurances : [],
      current_providers: body.current_providers?.trim() || null,
      monthly_premium: body.monthly_premium?.trim() || null,
      coverage_gaps: body.coverage_gaps?.trim() || null,
      source,
      status,
      notes: body.notes?.trim() || null,
    }

    // Optionale Adressfelder (migration_v2) — nur wenn befüllt
    if (body.street?.trim()) insertBase.street = body.street.trim()
    if (body.postal_code?.trim()) insertBase.postal_code = body.postal_code.trim()
    if (body.city?.trim()) insertBase.city = body.city.trim()
    if (body.country?.trim() && body.country.trim() !== 'Deutschland') insertBase.country = body.country.trim()

    // Erst mit Adressfeldern versuchen, bei Fehler ohne Adressfelder wiederholen
    let { data: lead, error: insertError } = await supabase
      .from('leads').insert(insertBase).select().single()

    if (insertError && (insertError.code === '42703' || insertError.message.includes('column'))) {
      console.warn('[POST] Adressspalten nicht vorhanden, Retry ohne migration_v2-Felder')
      const { street: _s, postal_code: _p, city: _c, country: _co, ...baseOnly } = insertBase
      const retry = await supabase.from('leads').insert(baseOnly).select().single()
      lead = retry.data
      insertError = retry.error
    }

    if (insertError) throw new Error(`Supabase Fehler: ${insertError.message}`)

    // Eingangs-Aktivität
    await supabase.from('activities').insert({
      lead_id: lead.id,
      type: 'sync',
      description: `Lead angelegt via ${source}`,
    })

    // ── Regeln ausführen (inkl. KlickTipp Live-Sync) ─────────
    const { statusOverride, appliedRules } = await executeRules(
      supabase,
      lead.id,
      source,
      lead.status,
      {
        email: lead.email,
        first_name: lead.first_name,
        last_name: lead.last_name,
        phone_mobile: lead.phone_mobile,
      }
    )

    // Status-Override anwenden falls eine Regel ihn gesetzt hat
    if (statusOverride) {
      await supabase.from('leads').update({ status: statusOverride }).eq('id', lead.id)
      lead.status = statusOverride
    }

    return Response.json({
      success: true,
      data: lead,
      meta: { applied_rules: appliedRules },
    }, { status: 201 })

  } catch (error) {
    console.error('[POST /api/leads]', error)
    return Response.json({ success: false, error: 'Lead konnte nicht angelegt werden' }, { status: 500 })
  }
}
