import { createServerClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activities-logger'
import { sendRuleNotification } from '@/lib/rule-notifications'
import { ruleKlicktippTags } from '@/lib/rule-klicktipp-tags'
import { assignConversationLabelToContact, SuperchatApiError } from '@/lib/integrations/superchat'

interface Rule {
  id: string
  name?: string
  active: boolean
  condition_source: string
  condition_sparte?: string
  condition_status?: string | null
  actions: {
    klicktipp_tag?: string
    klicktipp_tags?: string[]
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

/** Führt Regeln aus, die explizit an einen Kontaktstatus gebunden sind. */
export async function executeStatusAutomations(contactId: string, status: string): Promise<void> {
  const supabase = createServerClient()
  const { data: contact } = await supabase
    .from('contacts')
    .select('id, source, sparte, superchat_id, automation_disabled, is_test_data')
    .eq('id', contactId)
    .single()

  if (!contact || contact.automation_disabled || contact.is_test_data) return

  const { data: rules, error } = await supabase
    .from('rules')
    .select('*')
    .eq('active', true)
    .eq('condition_status', status)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[Automation] Statusregeln konnten nicht geladen werden:', error.message)
    return
  }

  for (const rule of rules ?? []) {
    const sourceMatches = rule.condition_source === 'all' || rule.condition_source === contact.source
    const sparteMatches = !rule.condition_sparte || rule.condition_sparte === contact.sparte
    if (!sourceMatches || !sparteMatches) continue

    const labelName = rule.actions?.superchat_label
    if (!labelName || !contact.superchat_id) continue

    try {
      const result = await assignConversationLabelToContact(contact.superchat_id, labelName)
      await logActivity(
        null,
        contactId,
        'automation_executed',
        `SuperChat-Gesprächslabel „${labelName}“ gesetzt`,
        { rule_id: rule.id, trigger: 'status_change', ...result }
      )
    } catch (labelError) {
      console.error('[Automation] SuperChat-Gesprächslabel konnte nicht gesetzt werden:', {
        status: labelError instanceof SuperchatApiError ? labelError.status : null,
      })
      await logActivity(
        null,
        contactId,
        'superchat_sync_failed',
        'SuperChat-Gesprächslabel konnte nicht gesetzt werden',
        { rule_id: rule.id, trigger: 'status_change' }
      )
    }
  }
}

/**
 * Execute automation rules for a newly created contact
 */
export async function executeAutomation(
  contactId: string,
  contactSource: string,
  automationDisabled: boolean,
  contactSparte?: string
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

    // Load all active rules. Ohne ORDER BY ist die von Supabase zurückgegebene
    // Reihenfolge nicht garantiert — bei mehreren aktiv passenden Regeln würde
    // .find() unten sonst nicht-deterministisch die "erste" wählen. Älteste
    // Regel zuerst macht das Matching reproduzierbar; ersetzt keine echte
    // Priorisierung nach Spezifität (z.B. Regel mit Sparte vor Catch-All-Regel) —
    // das bleibt eine offene Produktentscheidung.
    const { data: rules, error: rulesError } = await supabase
      .from('rules')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: true })

    if (rulesError) {
      console.error('[Automation] Error loading rules:', rulesError)
      return { executed: false, fields_set: {}, error: rulesError.message }
    }

    // Find matching rule for this source and insurance product
    const matchingRule = rules?.find((rule: Rule) => {
      if (rule.condition_status) return false
      // Check source condition
      const sourceMatches = rule.condition_source === 'all' || rule.condition_source === contactSource

      // Check sparte condition (if specified)
      const sparteMatches =
        !rule.condition_sparte ||
        rule.condition_sparte === contactSparte

      return sourceMatches && sparteMatches
    })

    if (!matchingRule) {
      console.log(`[Automation] No matching rule for source: ${contactSource}, sparte: ${contactSparte || 'all'}`)
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

    const klicktippTags = ruleKlicktippTags(matchingRule.actions)
    if (klicktippTags.length > 0) {
      fieldsToSet.klicktipp_tags = klicktippTags
      const tagIds = klicktippTags.map((tag) => klicktippTagsMap[tag]).filter(Boolean)
      if (tagIds.length > 0) {
        fieldsToSet.klicktipp_tag_ids = tagIds
      }
      fieldsSummary.klicktipp_tags = klicktippTags
      fieldsSummary.klicktipp_tag_ids = tagIds
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
        { rule_id: matchingRule.id, trigger: 'auto', ...fieldsSummary }
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
