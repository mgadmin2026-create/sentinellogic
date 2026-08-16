'use client'
import { useState } from 'react'
import Link from 'next/link'
import { RELEASE_NOTES, ReleaseNote } from '@/data/release-notes'
import { ReleaseNotesModal } from '@/components/ReleaseNotesModal'
import { PageHeader } from '@/components/ui'

type CategoryFilter = 'all' | 'feature' | 'improvement' | 'fix' | 'security'

const CATEGORY_COLORS = {
  feature: 'bg-blue-100 text-blue-800',
  improvement: 'bg-yellow-100 text-yellow-800',
  fix: 'bg-green-100 text-green-800',
  security: 'bg-red-100 text-red-800',
}

const CATEGORY_LABELS = {
  feature: 'Feature',
  improvement: 'Verbesserung',
  fix: 'Bugfix',
  security: 'Sicherheit',
}

export default function ReleaseNotesPage() {
  const [selectedVersion, setSelectedVersion] = useState<ReleaseNote | null>(RELEASE_NOTES[0] || null)
  const [modalOpen, setModalOpen] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')

  const filteredFeatures = selectedVersion?.features.filter(f => categoryFilter === 'all' || f.category === categoryFilter) || []

  return (
    <div className="p-8">
      {/* Header */}
      <PageHeader
        title="Release Notes"
        subtitle="Übersicht über neue Features, Verbesserungen und Bugfixes"
        actions={
          <Link href="/" className="text-yellow-600 hover:text-yellow-700 text-sm font-medium">
            ← Zurück zum Dashboard
          </Link>
        }
      />

      <div className="grid grid-cols-3 gap-6">
        {/* Sidebar: Versions List */}
        <div className="col-span-1">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden sticky top-8">
            <div className="bg-brand px-6 py-4">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Alle Versionen</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {RELEASE_NOTES.map(release => (
                <button
                  key={release.version}
                  onClick={() => {
                    setSelectedVersion(release)
                    setModalOpen(true)
                  }}
                  className={`w-full text-left px-6 py-3 text-sm font-medium transition-colors ${
                    selectedVersion?.version === release.version
                      ? 'bg-yellow-50 text-yellow-900 border-l-4 border-yellow-400'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <p className="font-semibold">{release.version}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{release.date}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main: Version Details */}
        <div className="col-span-2 space-y-6">
          {selectedVersion ? (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Version Header */}
              <div className="bg-gradient-to-r from-brand to-yellow-300 px-6 py-8">
                <p className="text-xs text-gray-700 font-semibold uppercase mb-2">Version</p>
                <h2 className="text-3xl font-bold text-gray-900">{selectedVersion.version}</h2>
                <p className="text-sm text-gray-800 mt-2">{selectedVersion.title}</p>
                <p className="text-xs text-gray-700 mt-4">
                  📅 {new Date(selectedVersion.date).toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>

              {/* Summary */}
              <div className="px-6 py-4 bg-blue-50 border-b border-blue-200">
                <p className="text-sm text-blue-900">{selectedVersion.summary}</p>
              </div>

              {/* Category Filter */}
              <div className="px-6 py-4 border-b border-gray-100 flex gap-2 flex-wrap">
                {(['all', 'feature', 'improvement', 'fix', 'security'] as const).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`text-xs font-medium px-3 py-1.5 rounded-full transition-all ${
                      categoryFilter === cat
                        ? 'bg-brand text-gray-900'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {cat === 'all' ? 'Alle' : CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>

              {/* Features List */}
              <div className="px-6 py-6 space-y-4">
                {filteredFeatures.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">Keine Features in dieser Kategorie</p>
                ) : (
                  filteredFeatures.map((feature, idx) => (
                    <div key={idx} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50/50 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="text-2xl flex-shrink-0">{feature.icon || '•'}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <p className="font-semibold text-gray-900">{feature.title}</p>
                            <span className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[feature.category]}`}>
                              {CATEGORY_LABELS[feature.category]}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">{feature.description}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Breaking Changes */}
              {selectedVersion.breaking_changes && selectedVersion.breaking_changes.length > 0 && (
                <div className="mx-6 mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-lg">
                  <p className="text-xs font-semibold text-red-900 uppercase mb-2">⚠️ Breaking Changes</p>
                  <ul className="space-y-1">
                    {selectedVersion.breaking_changes.map((change, idx) => (
                      <li key={idx} className="text-sm text-red-800">
                        • {change}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
              <p>Keine Release Notes vorhanden</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      <ReleaseNotesModal release={selectedVersion} isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}
