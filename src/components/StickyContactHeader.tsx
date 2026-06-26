'use client'

interface StickyContactHeaderProps {
  firstName?: string
  lastName?: string
  activeTab: string
  setActiveTab: (tab: string) => void
  isEditing: boolean
  onEditChange: (editing: boolean) => void
  onDelete: () => void
}

const tabs = [
  { id: 'overview', label: '📋 Übersicht' },
  { id: 'process', label: '⚙️ Prozess' },
  { id: 'activities', label: '📝 Aktivitäten' },
  { id: 'tasks', label: '✓ Aufgaben' },
  { id: 'notes', label: '📄 Notizen' },
  { id: 'documents', label: '📎 Dokumente' },
  { id: 'automation', label: '⚡ Automation' },
]

export function StickyContactHeader({
  firstName,
  lastName,
  activeTab,
  setActiveTab,
  isEditing,
  onEditChange,
  onDelete,
}: StickyContactHeaderProps) {
  return (
    <div className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 py-4">
        {/* Header Row: Name + Tabs */}
        <div className="flex items-center gap-6 mb-4">
          {/* Name */}
          <div className="min-w-fit">
            <h1 className="text-xl font-bold text-gray-900">
              {firstName} {lastName}
            </h1>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-gray-200 flex-1 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-yellow-600 border-yellow-600'
                    : 'text-gray-600 border-transparent hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Actions Row */}
        <div className="flex items-center justify-between">
          <div></div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onEditChange(!isEditing)}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                isEditing
                  ? 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                  : 'bg-yellow-400 hover:bg-yellow-500 text-gray-900'
              }`}
            >
              {isEditing ? '✗ Bearbeitung abbrechen' : '✏️ Bearbeiten'}
            </button>
            <button
              onClick={onDelete}
              className="px-3 py-2 text-sm font-medium bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
            >
              🗑️ Löschen
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
