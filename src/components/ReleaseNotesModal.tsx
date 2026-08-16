'use client'
import { ReleaseNote } from '@/data/release-notes'

interface Props {
  release: ReleaseNote | null
  isOpen: boolean
  onClose: () => void
}

const CATEGORY_ICONS = {
  feature: '✨',
  improvement: '⚡',
  fix: '🔧',
  security: '🔒',
}

const CATEGORY_LABELS = {
  feature: 'Feature',
  improvement: 'Verbesserung',
  fix: 'Bugfix',
  security: 'Sicherheit',
}

const CATEGORY_COLORS = {
  feature: 'bg-blue-100 text-blue-800',
  improvement: 'bg-yellow-100 text-yellow-800',
  fix: 'bg-green-100 text-green-800',
  security: 'bg-red-100 text-red-800',
}

export function ReleaseNotesModal({ release, isOpen, onClose }: Props) {
  if (!isOpen || !release) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-brand to-yellow-300 px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-700 font-semibold">Version</p>
            <h2 className="text-2xl font-bold text-gray-900">{release.version}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-900 text-2xl font-bold transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Title & Date */}
          <div>
            <h3 className="text-xl font-bold text-gray-900">{release.title}</h3>
            <p className="text-xs text-gray-500 mt-1">
              Veröffentlicht: {new Date(release.date).toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          {/* Summary */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900">{release.summary}</p>
          </div>

          {/* Features */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">Was ist neu</h4>
            <div className="space-y-3">
              {release.features.map((feature, idx) => (
                <div key={idx} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="text-xl flex-shrink-0">{feature.icon || '•'}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-gray-900">{feature.title}</p>
                        <span
                          className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[feature.category]}`}
                        >
                          {CATEGORY_ICONS[feature.category]} {CATEGORY_LABELS[feature.category]}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{feature.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Breaking Changes */}
          {release.breaking_changes && release.breaking_changes.length > 0 && (
            <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg">
              <p className="text-xs font-semibold text-red-900 uppercase mb-2">⚠️ Breaking Changes</p>
              <ul className="space-y-1">
                {release.breaking_changes.map((change, idx) => (
                  <li key={idx} className="text-sm text-red-800">
                    • {change}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Known Issues */}
          {release.known_issues && release.known_issues.length > 0 && (
            <div className="p-4 bg-yellow-50 border-2 border-yellow-200 rounded-lg">
              <p className="text-xs font-semibold text-yellow-900 uppercase mb-2">🐛 Bekannte Probleme</p>
              <ul className="space-y-1">
                {release.known_issues.map((issue, idx) => (
                  <li key={idx} className="text-sm text-yellow-800">
                    • {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Next Release */}
          {release.next_release_date && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-xs text-green-900">
                <strong>Nächste Version:</strong> {new Date(release.next_release_date).toLocaleDateString('de-DE')}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-100 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-600 font-medium text-sm px-4 py-2.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Schließen
          </button>
          <button
            onClick={() => {
              fetch('/api/release-notes/mark-viewed', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ version: release.version }),
              }).catch(console.error)
              onClose()
            }}
            className="flex-1 bg-brand hover:bg-yellow-500 text-gray-900 font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors"
          >
            ✓ Gelesen
          </button>
        </div>
      </div>
    </div>
  )
}
