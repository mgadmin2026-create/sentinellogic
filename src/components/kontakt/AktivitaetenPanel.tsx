'use client'
// Kontakthistorie: vollständige Aktivitäts-Timeline mit Akteur — ehemals
// Aktivitäten-Tab, jetzt Drawer-Inhalt (erreichbar über das ⋯-Menü im Kopfbereich).
//
// Fachlich/technisch getrennt, weil die technischen Einträge (Sync- und
// Automations-Läufe) die Historie zahlenmäßig dominieren und den fachlich
// relevanten Verlauf (Kontakt angelegt, Status geändert, Aufgabe erstellt, ...)
// überdecken. Default zeigt nur Fachliches, Technisches ist zuschaltbar.
import { useState } from 'react'
import Link from 'next/link'
import { HelpButton } from '@/components/help/HelpButton'
import { istTechnisch } from '@/lib/activity-classification'

export { istTechnisch }

export interface Aktivität {
  id: string
  type: string
  description: string
  data?: Record<string, any>
  created_at: string
  user?: { name: string } | null
}

export function getActivityIcon(type: string) {
  if (type.includes('email')) return '✉️'
  if (type.includes('klicktipp')) return '🔗'
  if (type.includes('dialfire')) return '📞'
  if (type.includes('superchat')) return '💬'
  if (type.includes('strato_calendar')) return '📅'
  if (type.includes('task')) return '✓'
  return '📝'
}

export function getActivityColor(type: string) {
  if (type.includes('email')) return 'bg-sky-100 text-sky-700'
  if (type.includes('klicktipp')) return 'bg-blue-100 text-blue-600'
  if (type.includes('dialfire')) return 'bg-purple-100 text-purple-600'
  if (type.includes('superchat')) return 'bg-emerald-100 text-emerald-600'
  if (type.includes('strato_calendar')) return 'bg-orange-100 text-orange-600'
  if (type.includes('task')) return 'bg-emerald-100 text-emerald-600'
  return 'bg-yellow-100 text-yellow-600'
}

function zeitpunkt(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

export function AktivitaetenPanel({ aktivitäten }: { aktivitäten: Aktivität[] }) {
  const [zeigeTechnisch, setZeigeTechnisch] = useState(false)

  const technischeAnzahl = aktivitäten.filter((a) => istTechnisch(a.type)).length
  const sichtbar = zeigeTechnisch ? aktivitäten : aktivitäten.filter((a) => !istTechnisch(a.type))

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {sichtbar.length} von {aktivitäten.length} Einträgen
          </span>
          <HelpButton articleId="kontakt-detail.aktivitaeten" />
        </div>
        {technischeAnzahl > 0 && (
          <button
            onClick={() => setZeigeTechnisch((v) => !v)}
            className="text-xs font-semibold text-gray-500 hover:text-gray-900 transition-colors"
          >
            {zeigeTechnisch ? '− Technische Einträge ausblenden' : `+ ${technischeAnzahl} technische Einträge anzeigen`}
          </button>
        )}
      </div>

      {sichtbar.length === 0 ? (
        <p className="text-gray-400 text-sm">Keine Aktivitäten vorhanden.</p>
      ) : (
        <div>
          {sichtbar.map((akt, i) => (
            <div key={akt.id} className={`relative pl-10 ${i < sichtbar.length - 1 ? 'pb-6' : ''}`}>
              {i < sichtbar.length - 1 && (
                <span className="absolute left-[15px] top-8 bottom-0 w-px bg-gray-200" aria-hidden="true" />
              )}
              <div className={`absolute left-0 top-0 w-8 h-8 rounded-full flex items-center justify-center text-sm ring-4 ring-white flex-shrink-0 ${getActivityColor(akt.type)}`}>
                {getActivityIcon(akt.type)}
              </div>
              <p className="text-sm font-medium text-gray-900 pt-1">
                {akt.description}
                {akt.type === 'klicktipp_synced' && akt.data?.klicktipp_id && (
                  <span className="ml-1.5 text-xs font-mono text-gray-400">(ID: {akt.data.klicktipp_id})</span>
                )}
              </p>
              {akt.type === 'email_received' && Number.isInteger(Number(akt.data?.mailbox_uid)) && Number(akt.data?.mailbox_uid) > 0 && akt.data?.uid_validity && (
                <Link
                  href={`/postfach?uid=${Number(akt.data?.mailbox_uid)}&uidValidity=${encodeURIComponent(String(akt.data.uid_validity))}`}
                  className="mt-1 inline-block text-xs font-semibold text-sky-700 hover:underline"
                >
                  E-Mail im Postfach öffnen →
                </Link>
              )}
              <div className="flex items-center gap-1.5 mt-1">
                <p className="text-xs text-gray-400">{zeitpunkt(akt.created_at)} · {akt.user?.name || 'System'}</p>
                {istTechnisch(akt.type) && (
                  <span className="text-xs text-gray-400" title="Technischer Eintrag (Sync/Automation)">⚙️</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
