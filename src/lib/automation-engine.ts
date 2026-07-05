import { createServerClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activities-logger'
import { sendRuleNotification } from '@/lib/rule-notifications'

interface Rule {
  id: string
  name?: string
  active: boolean
  condition_source: string
  actions: {
    klicktipp_tag?: string
    dialfire_campaign?: string
    dialfire_task_name?: string
    set_status?: string
    send_notification?: boolean
    notification_email?: string
  }
}

interface AutomationResult {
  executed: boolean
  rule_id?: string
  fields_set: {
    dialfire_campaign_id?: string
    dialfire_task_name?: string
    klicktipp_tags?: string[]
  }
  error?: string
}

/**
 * Execute automation rules for a newly created contact
 */
export async function executeAutomation(
  contactId: string,
  contactSource: string,
  automationDisabled: boolean
): Promise<AutomationResult> {
  try {
    const supabase = createServerClient()

    // If automation is disabled, skip
    if (automationDisabled) {
      console.log(`[Automation] Skipped for contact ${contactId} (automation_disabled=true)`)
      return { executed: false, fields_set: {} }
    }

    // Load config for tag ID lookup
    const { data: configData } = await supabase
      .from('system_config')
      .select('config')
      .eq('key', 'system_config')
      .single()

    const config = configData?.config || {}
    const klicktippTagsMap = (config.klicktipp_tags || []).reduce((acc: any, tag: any) => {
      acc[tag.tag_name] = tag.tag_id
      return acc
    }, {})

    // Load all active rules
    const { data: rules, error: rulesError } = await supabase
      .from('rules')
      .select('*')
      .eq('active', true)

    if (rulesError) {
      console.error('[Automation] Error loading rules:', rulesError)
      return { executed: false, fields_set: {}, error: rulesError.message }
    }

    // Find matching rule for this source
    const matchingRule = rules?.find(
      (rule: Rule) => rule.condition_source === 'all' || rule.condition_source === contactSource
    )

    if (!matchingRule) {
      console.log(`[Automation] No matching rule for source: ${contactSource}`)
      return { executed: false, fields_set: {} }
    }

    // E-Mail-Benachrichtigung (unabhaengig davon, ob Felder gesetzt werden)
    if (matchingRule.actions.send_notification && matchingRule.actions.notification_email) {
      const { data: kontakt } = await supabase
        .from('contacts')
        .select('first_name, last_name, email')
        .eq('id', contactId)
        .single()

      const contactName = kontakt
        ? `${kontakt.first_name ?? ''} ${kontakt.last_name ?? ''}`.trim()
        : 'Kontakt'

      const sent = await sendRuleNotification({
        to: matchingRule.actions.notification_email,
        contactName,
        contactEmail: kontakt?.email,
        ruleName: matchingRule.name || 'Regel',
        actions: matchingRule.actions,
      })

      await logActivity(
        null,
        contactId,
        sent ? 'notification_sent' : 'notification_failed',
        sent
          ? `Benachrichtigung gesendet an ${matchingRule.actions.notification_email}`
          : `Benachrichtigung fehlgeschlagen (${matchingRule.actions.notification_email})`,
        { rule_id: matchingRule.id }
      )
    }

    // Prepare fields to update
    const fieldsToSet: any = {}
    const fieldsSummary: any = { dialfire_campaign_id: '', dialfire_task_name: '', klicktipp_tags: [] as string[], status: '' }

    if (matchingRule.actions.dialfire_campaign) {
      fieldsToSet.dialfire_campaign_id = matchingRule.actions.dialfire_campaign
      fieldsSummary.dialfire_campaign_id = matchingRule.actions.dialfire_campaign
    }

    if (matchingRule.actions.dialfire_task_name) {
      fieldsToSet.dialfire_task_name_field = matchingRule.actions.dialfire_task_name
      fieldsSummary.dialfire_task_name = matchingRule.actions.dialfire_task_name
    }

    if (matchingRule.actions.klicktipp_tag) {
      fieldsToSet.klicktipp_tags = [matchingRule.actions.klicktipp_tag]
      const tagId = klicktippTagsMap[matchingRule.actions.klicktipp_tag]
      if (tagId) {
        fieldsToSet.klicktipp_tag_ids = [tagId]
      }
      fieldsSummary.klicktipp_tags = [matchingRule.actions.klicktipp_tag]
      fieldsSummary.klicktipp_tag_ids = tagId ? [tagId] : []
    }

    if (matchingRule.actions.set_status) {
      fieldsToSet.status = matchingRule.actions.set_status
      fieldsSummary.status = matchingRule.actions.set_status
    }

    // Update contact with automated fields
    if (Object.keys(fieldsToSet).length > 0) {
      const { error: updateError } = await supabase
        .from('contacts')
        .update(fieldsToSet)
        .eq('id', contactId)

      if (updateError) {
        console.error('[Automation] Error updating contact:', updateError)
        return { executed: false, fields_set: {}, error: updateError.message }
      }

      // Log automation execution
      const fieldNames = Object.keys(fieldsToSet).join(', ')
      await logActivity(
        null,
        contactId,
        'automation_executed',
        `Automation rule applied: ${fieldNames}`,
        { rule_id: matchingRule.id, ...fieldsSummary }
      )

      console.log(`[Automation] Rules applied for contact ${contactId}:`, fieldsSummary)
      return { executed: true, rule_id: matchingRule.id, fields_set: fieldsSummary }
    }

    return { executed: false, fields_set: {} }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Automation] Unexpected error:', errorMsg)
    return { executed: false, fields_set: {}, error: errorMsg }
  }
}
