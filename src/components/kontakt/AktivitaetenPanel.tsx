'use client'
// Kontakthistorie: vollständige Aktivitäts-Timeline mit Akteur — ehemals
// Aktivitäten-Tab, jetzt Drawer-Inhalt (erreichbar über das ⋯-Menü im Kopfbereich).
//
// Fachlich/technisch getrennt, weil die technischen Einträge (Sync- und
// Automations-Läufe) die Historie zahlenmäßig dominieren und den fachlich
// relevanten Verlauf (Kontakt angelegt, Status geändert, Aufgabe erstellt, ...)
// überdecken. Default zeigt nur Fachliches, Technisches ist zuschaltbar.
import { useState } from 'react'
import { HelpButton } from '@/components/help/HelpButton'

export interface Aktivität {
  id: string
  type: string
  description: string
  data?: Record<string, any>
  created_at: string
  user?: { name: string } | null
}

export function getActivityIcon(type: string) {
  if (type.includes('klicktipp')) return '🔗'
  if (type.includes('dialfire')) return '📞'
  if (type.includes('superchat')) return '💬'
  if (type.includes('task')) return '✓'
  return '📝'
}

export function getActivityColor(type: string) {
  if (type.includes('klicktipp')) return 'bg-blue-100 text-blue-600'
  if (type.includes('dialfire')) return 'bg-purple-100 text-purple-600'
  if (type.includes('superchat')) return 'bg-emerald-100 text-emerald-600'
  if (type.includes('task')) return 'bg-emerald-100 text-emerald-600'
  return 'bg-yellow-100 text-yellow-600'
}

// Technisch = Sync- und Automations-Mechanik (Dialfire/KlickTipp/Superchat/
// Facebook-Abgleich, Regelausführung, reine Feld-Updates). Alles andere gilt
// als fachlich und ist damit standardmäßig sichtbar — unbekannte künftige
// Typen landen bewusst im fachlichen Default statt unsichtbar zu werden.
export function istTechnisch(type: string): boolean {
  if (type.includes('sync')) return true
  if (type.startsWith('automation_')) return true
  if (type === 'facebook_linked' || type === 'facebook_skipped_duplicate') return true
  if (type === 'contact_updated') return true
  return false
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
        <div className="space-y-4">
          {sichtbar.map((akt, i) => (
            <div key={akt.id} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold flex-shrink-0 ${getActivityColor(akt.type)}`}>
                  {getActivityIcon(akt.type)}
                </div>
                {i < sichtbar.length - 1 && <div className="w-0.5 h-8 bg-gray-200 mt-2" />}
              </div>
              <div className="flex-1 pt-1">
                <p className="text-sm font-medium text-gray-900">{akt.description}</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs text-gray-400">{zeitpunkt(akt.created_at)}</p>
                  <span className="text-xs text-gray-400">· {akt.user?.name || 'System'}</span>
                  {akt.type && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getActivityColor(akt.type)}`}>
                      {akt.type.replace(/_/g, ' ')}
                    </span>
                  )}
                  {istTechnisch(akt.type) && (
                    <span className="text-xs text-gray-400" title="Technischer Eintrag (Sync/Automation)">⚙️</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
