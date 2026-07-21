'use client'
// Vollständige Aktivitäts-Timeline mit Akteur — ehemals Aktivitäten-Tab,
// jetzt Drawer-Inhalt.

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
  if (type.includes('task')) return '✓'
  return '📝'
}

export function getActivityColor(type: string) {
  if (type.includes('klicktipp')) return 'bg-blue-100 text-blue-600'
  if (type.includes('dialfire')) return 'bg-purple-100 text-purple-600'
  if (type.includes('task')) return 'bg-emerald-100 text-emerald-600'
  return 'bg-yellow-100 text-yellow-600'
}

export function AktivitaetenPanel({ aktivitäten }: { aktivitäten: Aktivität[] }) {
  if (aktivitäten.length === 0) {
    return <p className="text-gray-400 text-sm">Keine Aktivitäten vorhanden.</p>
  }

  return (
    <div className="space-y-4">
      {aktivitäten.map((akt, i) => (
        <div key={akt.id} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold flex-shrink-0 ${getActivityColor(akt.type)}`}>
              {getActivityIcon(akt.type)}
            </div>
            {i < aktivitäten.length - 1 && <div className="w-0.5 h-8 bg-gray-200 mt-2" />}
          </div>
          <div className="flex-1 pt-1">
            <p className="text-sm font-medium text-gray-900">{akt.description}</p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs text-gray-400">
                {new Date(akt.created_at).toLocaleDateString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              </p>
              <span className="text-xs text-gray-400">· {akt.user?.name || 'System'}</span>
              {akt.type && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getActivityColor(akt.type)}`}>
                  {akt.type.replace('_', ' ')}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
