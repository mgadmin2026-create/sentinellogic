// Konsolidierte SuperChat-Push-Logik -- vorher komplett inline in
// src/app/api/kontakte/[id]/superchat/route.ts. Seit Phase 4 der
// Sync-Architektur-Vereinheitlichung zusätzlich an sync_runs angebunden
// (Struktur 1:1 an dialfire-sync.ts/klicktipp-sync.ts angelehnt) --
// createSuperchatContact()/updateSuperchatContact() werfen bereits
// SuperchatApiError bei Fehlern, kein Umbau auf Wurf-Verhalten nötig.
import { createServerClient } from '@/lib/supabase/server'
import {
  createSuperchatContact,
  findExistingSuperchatContact,
  SuperchatApiError,
  updateSuperchatContact,
  assignConversationLabelToContact,
  type SuperchatContactInput,
} from '@/lib/integrations/superchat'
import { runWithTracking, type ResumeRun } from '@/lib/sync-runs/retry-runner'

type SupabaseClient = ReturnType<typeof createServerClient>

export interface SuperchatSyncContact {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone_mobile: string | null
  phone_office: string | null
  anrede: string | null
  company_name: string | null
  street: string | null
  hausnummer: string | null
  postal_code: string | null
  city: string | null
  country: string | null
  geburtstag: string | null
  superchat_id: string | null
  status?: string | null
}

export interface SuperchatSyncMeta {
  userId?: string | null
  resumeFrom?: ResumeRun
}

export interface SuperchatSyncResult {
  superchatId: string
  operation: 'created' | 'updated'
  synchronizedAt: string
}

export interface SuperchatLinkResult {
  superchatId: string
  matchedBy: Array<'email' | 'phone'>
  linkedAt: string
}

function toProviderInput(contact: SuperchatSyncContact): SuperchatContactInput {
  return {
    firstName: contact.first_name,
    lastName: contact.last_name,
    email: contact.email,
    phoneMobile: contact.phone_mobile,
    phoneOffice: contact.phone_office,
    gender: contact.anrede,
    companyName: contact.company_name,
    street: contact.street,
    houseNumber: contact.hausnummer,
    postalCode: contact.postal_code,
    city: contact.city,
    country: contact.country,
    birthDate: contact.geburtstag,
  }
}

/**
 * Überträgt einen Kontakt an SuperChat (Create oder Update, je nachdem ob
 * superchat_id bereits gesetzt ist). Wirft SuperchatApiError bei Fehlern --
 * der Aufrufer (Route, oder retry-handlers.ts bei einem Retry) fängt das
 * weiterhin selbst ab.
 */
export async function syncContactToSuperchat(
  supabase: SupabaseClient,
  contact: SuperchatSyncContact,
  meta: SuperchatSyncMeta = {}
): Promise<SuperchatSyncResult> {
  const providerInput = toProviderInput(contact)

  const wasUpdate = Boolean(contact.superchat_id)

  try {
    const result = await runWithTracking(
      supabase,
      { runKind: 'item', integration: 'superchat', triggerType: 'manual', contactId: contact.id },
      () =>
        contact.superchat_id
          ? updateSuperchatContact(contact.superchat_id, providerInput)
          : createSuperchatContact(providerInput),
      meta.resumeFrom
    )

    const synchronizedAt = new Date().toISOString()

    const { error: updateError } = await supabase
      .from('contacts')
      .update({
        superchat_id: result.id,
        superchat_last_sync: synchronizedAt,
        superchat_sync_error: null,
      })
      .eq('id', contact.id)

    if (updateError) {
      console.error('[SuperChat Sync] Synchronisationsstatus konnte nicht gespeichert werden')
      throw new SuperchatApiError(
        wasUpdate
          ? 'Kontakt wurde übertragen, der lokale Status konnte aber nicht gespeichert werden'
          : 'Kontakt wurde in SuperChat angelegt, die Verknüpfung konnte aber nicht gespeichert werden'
      )
    }

    await supabase.from('activities').insert({
      lead_id: contact.id,
      type: 'superchat_synced',
      description: wasUpdate
        ? 'Kontakt in SuperChat aktualisiert'
        : 'Kontakt an SuperChat übertragen',
      data: { operation: wasUpdate ? 'updated' : 'created' },
      user_id: meta.userId ?? null,
    })

    // Die statusbasierte Regel muss auch greifen, wenn der Kontakt erst nach
    // dem Statuswechsel mit SuperChat verknüpft wird.
    if (contact.status === 'customer') {
      try {
        const labelResult = await assignConversationLabelToContact(result.id, 'Kunde AZ')
        await supabase.from('activities').insert({
          lead_id: contact.id,
          type: 'superchat_label_applied',
          description: 'SuperChat-Gesprächslabel „Kunde AZ“ gesetzt',
          data: labelResult,
          user_id: meta.userId ?? null,
        })
      } catch (labelError) {
        // Eine fehlende Label-Berechtigung darf die bereits erfolgreiche
        // Kontaktsynchronisation nicht nachträglich als fehlgeschlagen markieren.
        console.error('[SuperChat Sync] Gesprächslabel konnte nicht gesetzt werden')
        await supabase.from('activities').insert({
          lead_id: contact.id,
          type: 'superchat_label_failed',
          description: 'SuperChat-Gesprächslabel „Kunde AZ“ konnte nicht gesetzt werden',
          data: {
            reason: labelError instanceof Error ? labelError.message : 'Unbekannter Fehler',
          },
          user_id: meta.userId ?? null,
        })
      }
    }

    return { superchatId: result.id, operation: wasUpdate ? 'updated' : 'created', synchronizedAt }
  } catch (error) {
    const message =
      error instanceof SuperchatApiError
        ? error.message
        : 'Kontakt konnte nicht an SuperChat übertragen werden'

    console.error('[SuperChat Sync] Übertragung fehlgeschlagen', {
      status: error instanceof SuperchatApiError ? error.status : null,
    })

    await supabase.from('contacts').update({ superchat_sync_error: message }).eq('id', contact.id)

    await supabase.from('activities').insert({
      lead_id: contact.id,
      type: 'superchat_sync_failed',
      description: 'SuperChat-Übertragung fehlgeschlagen',
      data: { reason: message },
      user_id: meta.userId ?? null,
    })

    throw error
  }
}

/**
 * Verknüpft einen bereits in SuperChat vorhandenen Kontakt mit Sentinel.
 * Es wird nur bei einem eindeutigen Treffer über E-Mail/Telefon geschrieben.
 */
export async function linkExistingSuperchatContact(
  supabase: SupabaseClient,
  contact: SuperchatSyncContact,
  meta: SuperchatSyncMeta = {}
): Promise<SuperchatLinkResult> {
  if (contact.superchat_id) {
    throw new SuperchatApiError('Dieser Sentinel-Kontakt ist bereits mit SuperChat verknüpft')
  }

  const existing = await findExistingSuperchatContact(toProviderInput(contact))
  if (!existing) {
    throw new SuperchatApiError(
      'Kein eindeutiger SuperChat-Kontakt mit gleicher E-Mail-Adresse oder Telefonnummer gefunden'
    )
  }

  const linkedAt = new Date().toISOString()
  const { error: updateError } = await supabase
    .from('contacts')
    .update({
      superchat_id: existing.id,
      superchat_last_sync: linkedAt,
      superchat_sync_error: null,
    })
    .eq('id', contact.id)

  if (updateError) {
    if (updateError.code === '23505') {
      throw new SuperchatApiError(
        'Dieser SuperChat-Kontakt ist bereits mit einem anderen Sentinel-Kontakt verknüpft'
      )
    }
    console.error('[SuperChat Link] Verknüpfung konnte nicht gespeichert werden')
    throw new SuperchatApiError('Die SuperChat-Verknüpfung konnte nicht gespeichert werden')
  }

  await supabase.from('activities').insert({
    lead_id: contact.id,
    type: 'superchat_synced',
    description: 'Bestehenden SuperChat-Kontakt verknüpft',
    data: { operation: 'linked', matched_by: existing.matchedBy },
    user_id: meta.userId ?? null,
  })

  return { superchatId: existing.id, matchedBy: existing.matchedBy, linkedAt }
}
