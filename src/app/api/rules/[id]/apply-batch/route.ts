import { createServerClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activities-logger'
import { NextRequest, NextResponse } from 'next/server'

interface Rule {
  id: string
  condition_source: string
  actions: {
    dialfire_campaign?: string
    dialfire_task_name?: string
    klicktipp_tag?: string
    set_status?: string
  }
}

async function invokeEdgeFunction(functionName: string, payload: any) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.warn('[invokeEdgeFunction] Missing env vars')
    return null
  }

  const url = `${supabaseUrl}/functions/v1/${functionName}`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify(payload),
    })

    const result = await res.json()
    return result
  } catch (err) {
    console.error(`[invokeEdgeFunction] ${functionName} error:`, err)
    return null
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient()
    const ruleId = params.id

    // 1. Load rule
    const { data: rule, error: ruleError } = await supabase
      .from('rules')
      .select('*')
      .eq('id', ruleId)
      .single()

    if (ruleError || !rule) {
      return NextResponse.json(
        { success: false, error: 'Regel nicht gefunden' },
        { status: 404 }
      )
    }

    // 2. Find contacts matching rule source
    // Skip: automation_disabled=true, status='customer'
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('*')
      .eq('source', rule.condition_source)
      .eq('automation_disabled', false)
      .neq('status', 'customer')

    if (contactsError) {
      return NextResponse.json(
        { success: false, error: contactsError.message },
        { status: 500 }
      )
    }

    if (!contacts || contacts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Keine Kontakte gefunden, die diese Regel erfüllen',
        applied: 0,
        failed: 0,
      })
    }

    // 3. Apply rule to each contact
    let appliedCount = 0
    let failedCount = 0
    const errors: string[] = []

    for (const contact of contacts) {
      try {
        // Build fields to update from rule actions
        const fieldsToSet: any = {}
        const fieldsSummary: any = {}

        if (rule.actions.dialfire_campaign) {
          fieldsToSet.dialfire_campaign_id = rule.actions.dialfire_campaign
          fieldsSummary.dialfire_campaign_id = rule.actions.dialfire_campaign
        }

        if (rule.actions.dialfire_task_name) {
          fieldsToSet.dialfire_task_name_field = rule.actions.dialfire_task_name
          fieldsSummary.dialfire_task_name = rule.actions.dialfire_task_name
        }

        if (rule.actions.klicktipp_tag) {
          fieldsToSet.klicktipp_tags = [rule.actions.klicktipp_tag]
          fieldsSummary.klicktipp_tags = [rule.actions.klicktipp_tag]
        }

        if (rule.actions.set_status) {
          fieldsToSet.status = rule.actions.set_status
          fieldsSummary.status = rule.actions.set_status
        }

        // Skip if no actions
        if (Object.keys(fieldsToSet).length === 0) {
          continue
        }

        // Update contact
        const { error: updateError } = await supabase
          .from('contacts')
          .update(fieldsToSet)
          .eq('id', contact.id)

        if (updateError) {
          errors.push(`${contact.email}: ${updateError.message}`)
          failedCount++
          continue
        }

        // Log activity
        await logActivity(
          null,
          contact.id,
          'automation_executed',
          `Batch: Rule ${rule.id} applied (${Object.keys(fieldsToSet).join(', ')})`,
          fieldsSummary
        )

        // Dialfire Sync: Only if campaign or task is set
        if (fieldsToSet.dialfire_campaign_id || fieldsToSet.dialfire_task_name_field) {
          try {
            const dialfireResult = await invokeEdgeFunction('send-to-dialfire', {
              contact: {
                id: contact.id,
                email: contact.email,
                first_name: contact.first_name,
                last_name: contact.last_name,
                phone_mobile: contact.phone_mobile,
                company_name: contact.company_name,
                source: contact.source,
              },
            })

            if (dialfireResult?.success) {
              const dialfireId = dialfireResult.dialfire_id

              // Update contact with dialfire_id
              await supabase
                .from('contacts')
                .update({
                  dialfire_id: dialfireId,
                  dialfire_external_ref: contact.id,
                  dialfire_updated_at: new Date().toISOString(),
                })
                .eq('id', contact.id)

              console.log(`[Dialfire Batch] Synced: ${contact.email} -> ID: ${dialfireId}`)
              await logActivity(
                null,
                contact.id,
                'dialfire_synced',
                `Dialfire synced via batch rule (ID: ${dialfireId})`
              )
            } else {
              console.warn(`[Dialfire Batch] Failed for ${contact.email}: ${dialfireResult?.error}`)
              await logActivity(
                null,
                contact.id,
                'dialfire_sync_failed',
                `Dialfire sync failed: ${dialfireResult?.error || 'Unknown error'}`
              )
            }
          } catch (err) {
            console.error(`[Dialfire Batch] Error for ${contact.email}:`, err)
          }
        }

        appliedCount++
      } catch (err) {
        errors.push(`${contact.email}: ${err instanceof Error ? err.message : 'Unknown error'}`)
        failedCount++
      }
    }

    // 4. Return summary
    return NextResponse.json({
      success: true,
      message: `Regel auf ${appliedCount} Kontakte angewendet`,
      applied: appliedCount,
      failed: failedCount,
      total: contacts.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err) {
    console.error('[POST /api/rules/[id]/apply-batch]:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
