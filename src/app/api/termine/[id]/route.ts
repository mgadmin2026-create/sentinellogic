// API Route: Einzelner Termin
// GET    /api/termine/[id] — Termin laden
// PATCH  /api/termine/[id] — Termin aktualisieren
// DELETE /api/termine/[id] — Termin löschen
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getStratoConfig, pushStratoEvent, deleteStratoEvent } from '@/lib/strato-caldav'
import { sanitizeTeilnehmer } from '@/lib/kalender-helpers'
import { sendTerminBenachrichtigung, buildAenderungen } from '@/lib/termin-email'

interface TerminTeilnehmer {
  email: string
  name?: string
}

function terminInhaltGleich(a: any, b: any): boolean {
  return (
    a.titel === b.titel &&
    (a.beschreibung ?? null) === (b.beschreibung ?? null) &&
    (a.ort ?? null) === (b.ort ?? null) &&
    !!a.ganztaegig === !!b.ganztaegig &&
    new Date(a.start_zeit).getTime() === new Date(b.start_zeit).getTime() &&
    new Date(a.end_zeit).getTime() === new Date(b.end_zeit).getTime()
  )
}

function teilnehmerEmails(t: TerminTeilnehmer[] | null | undefined): Set<string> {
  return new Set((t ?? []).map((x) => x.email.toLowerCase()))
}

const ALLOWED_UPDATE_FIELDS = new Set([
  'titel', 'beschreibung', 'start_zeit', 'end_zeit', 'ganztaegig',
  'ort', 'contact_id', 'assigned_user_id', 'farbe', 'teilnehmer',
])

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('termine')
      .select(`
        *,
        contact:contact_id(id, first_name, last_name),
        assigned_user:assigned_user_id(name)
      `)
      .eq('id', params.id)
      .single()

    if (error || !data) {
      return Response.json({ success: false, error: 'Termin nicht gefunden' }, { status: 404 })
    }

    return Response.json({ success: true, data })
  } catch (err) {
    console.error('[GET /api/termine/[id]] Fehler:', err)
    return Response.json({ success: false, error: 'Termin konnte nicht geladen werden' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient()
    const body = await request.json()

    const { data: bestehend, error: fetchError } = await supabase
      .from('termine')
      .select('*')
      .eq('id', params.id)
      .single()

    if (fetchError || !bestehend) {
      return Response.json({ success: false, error: 'Termin nicht gefunden' }, { status: 404 })
    }

    const raw: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(body)) {
      if (ALLOWED_UPDATE_FIELDS.has(key)) raw[key] = value
    }
    for (const key of Object.keys(raw)) {
      if (raw[key] === '') raw[key] = null
    }
    if ('teilnehmer' in raw) raw.teilnehmer = sanitizeTeilnehmer(raw.teilnehmer)

    // Vorschau der resultierenden Werte (nicht gesendete Felder bleiben beim
    // bestehenden Stand) — entscheidet, ob Teilnehmer über die Änderung
    // benachrichtigt werden müssen und ob dafür SEQUENCE hochgezählt wird
    // (RFC 5546: Kalender-Apps der Empfänger erkennen daran ein Update).
    const vorschau = { ...bestehend, ...raw }
    const inhaltGeaendert = !terminInhaltGleich(bestehend, vorschau)
    const teilnehmerGeaendert =
      JSON.stringify(Array.from(teilnehmerEmails(vorschau.teilnehmer)).sort()) !==
      JSON.stringify(Array.from(teilnehmerEmails(bestehend.teilnehmer)).sort())

    if (inhaltGeaendert || teilnehmerGeaendert) {
      raw.sequence = (bestehend.sequence ?? 0) + 1
    }
    raw.updated_at = new Date().toISOString()

    if (Object.keys(raw).length === 0) {
      return Response.json({ success: false, error: 'Keine gültigen Felder zum Aktualisieren' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('termine')
      .update(raw)
      .eq('id', params.id)
      .select(`
        *,
        contact:contact_id(id, first_name, last_name),
        assigned_user:assigned_user_id(name)
      `)
      .single()

    if (error) {
      console.error('[PATCH /api/termine/[id]] Fehler:', error)
      return Response.json({ success: false, error: error.message }, { status: 500 })
    }

    // Änderung zu STRATO pushen (beidseitige Sync) — best effort, wie beim
    // Anlegen. Bereits verknüpfte Termine (external_href gesetzt) werden
    // aktualisiert statt dupliziert.
    const stratoConfig = getStratoConfig()
    if (stratoConfig) {
      try {
        const gepusht = await pushStratoEvent(stratoConfig, {
          uid: data.external_uid,
          href: data.external_href,
          titel: data.titel,
          beschreibung: data.beschreibung,
          ort: data.ort,
          start: new Date(data.start_zeit),
          end: new Date(data.end_zeit),
          ganztaegig: data.ganztaegig,
          teilnehmer: data.teilnehmer,
          sequence: data.sequence,
        })
        await supabase
          .from('termine')
          .update({
            external_uid: gepusht.uid,
            external_href: gepusht.href,
            external_etag: gepusht.etag,
            external_source: 'strato_caldav',
            last_synced_at: new Date().toISOString(),
          })
          .eq('id', params.id)
      } catch (err) {
        console.error('[PATCH /api/termine/[id]] STRATO-Push fehlgeschlagen (Änderung bleibt lokal gespeichert):', err)
      }
    }

    // Teilnehmer benachrichtigen — best effort, wie der STRATO-Push oben.
    // Entfernte Teilnehmer bekommen eine Absage, neu hinzugekommene eine
    // Einladung, weiterhin dabei bleibende bei inhaltlicher Änderung ein
    // Update (verschoben/Ort/Titel/Beschreibung).
    if (inhaltGeaendert || teilnehmerGeaendert) {
      try {
        const alteTeilnehmer: TerminTeilnehmer[] = bestehend.teilnehmer ?? []
        const neueTeilnehmer: TerminTeilnehmer[] = data.teilnehmer ?? []
        const alteEmails = teilnehmerEmails(alteTeilnehmer)
        const neueEmails = teilnehmerEmails(neueTeilnehmer)

        const entfernte = alteTeilnehmer.filter((t) => !neueEmails.has(t.email.toLowerCase()))
        const hinzugefuegte = neueTeilnehmer.filter((t) => !alteEmails.has(t.email.toLowerCase()))
        const bleibende = neueTeilnehmer.filter((t) => alteEmails.has(t.email.toLowerCase()))

        if (entfernte.length) {
          await sendTerminBenachrichtigung({ termin: bestehend, teilnehmer: entfernte, art: 'absage', sequence: data.sequence ?? 0 })
        }
        if (hinzugefuegte.length) {
          await sendTerminBenachrichtigung({ termin: data, teilnehmer: hinzugefuegte, art: 'einladung', sequence: data.sequence ?? 0 })
        }
        if (bleibende.length && inhaltGeaendert) {
          const changes = buildAenderungen(bestehend, data)
          await sendTerminBenachrichtigung({ termin: data, teilnehmer: bleibende, art: 'aktualisierung', sequence: data.sequence ?? 0, changes })
        }
      } catch (err) {
        console.error('[PATCH /api/termine/[id]] Benachrichtigung fehlgeschlagen:', err)
      }
    }

    return Response.json({ success: true, data })
  } catch (err) {
    console.error('[PATCH /api/termine/[id]] Fehler:', err)
    return Response.json({ success: false, error: 'Termin konnte nicht aktualisiert werden' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient()

    const { data: bestehend } = await supabase
      .from('termine')
      .select('*')
      .eq('id', params.id)
      .maybeSingle()

    // Absage an alle Teilnehmer, bevor der Termin verschwindet — best effort,
    // wie die übrigen Benachrichtigungen. Storniert der Nutzer den Termin,
    // sollen Eingeladene das erfahren, nicht nur eine kommentarlos
    // verschwundene Kalendereinladung sehen.
    if (bestehend?.teilnehmer?.length) {
      try {
        await sendTerminBenachrichtigung({
          termin: bestehend,
          teilnehmer: bestehend.teilnehmer,
          art: 'absage',
          sequence: (bestehend.sequence ?? 0) + 1,
        })
      } catch (err) {
        console.error('[DELETE /api/termine/[id]] Absage-Mail fehlgeschlagen:', err)
      }
    }

    // Verknüpften STRATO-Termin löschen (beidseitige Sync) — best effort:
    // schlägt es fehl (z.B. STRATO nicht erreichbar), wird trotzdem lokal
    // gelöscht, damit ein STRATO-Ausfall die CRM-Nutzung nicht blockiert.
    const stratoConfig = getStratoConfig()
    if (stratoConfig && bestehend?.external_href) {
      try {
        await deleteStratoEvent(stratoConfig, bestehend.external_href)
      } catch (err) {
        console.error('[DELETE /api/termine/[id]] STRATO-Löschung fehlgeschlagen (lokal wird trotzdem gelöscht):', err)
      }
    }

    const { error } = await supabase.from('termine').delete().eq('id', params.id)

    if (error) {
      console.error('[DELETE /api/termine/[id]] Fehler:', error)
      return Response.json({ success: false, error: error.message }, { status: 500 })
    }

    return Response.json({ success: true, data: { deleted: true } })
  } catch (err) {
    console.error('[DELETE /api/termine/[id]] Fehler:', err)
    return Response.json({ success: false, error: 'Termin konnte nicht gelöscht werden' }, { status: 500 })
  }
}
