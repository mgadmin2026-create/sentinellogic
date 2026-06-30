'use client'

interface StickyContactHeaderProps {
  firstName?: string
  lastName?: string
  companyName?: string
  phone?: string
  activeTab: string
  setActiveTab: (tab: string) => void
  isEditing: boolean
  onEditChange: (editing: boolean) => void
  onDelete: () => void
}

const tabs = [
  { id: 'overview', label: '👤 Übersicht' },
  { id: 'process', label: '🎯 Prozess' },
  { id: 'activities', label: '📝 Aktivitäten' },
  { id: 'tasks', label: '✓ Aufgaben' },
  { id: 'notes', label: '📋 Notizen' },
  { id: 'dialfire', label: '📞 Dialfire' },
  { id: 'documents', label: '📎 Dokumente' },
  { id: 'automation', label: '⚡ Automation' },
]

export function StickyContactHeader({
  firstName,
  lastName,
  companyName,
  phone,
  activeTab,
  setActiveTab,
  isEditing,
  onEditChange,
  onDelete,
}: StickyContactHeaderProps) {
  return (
    <div className={`sticky top-0 z-40 transition-colors ${
      isEditing
        ? 'bg-yellow-50 border-b-2 border-yellow-300'
        : 'bg-white border-b border-gray-200'
    } shadow-sm`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Contact Info Row: Name, Company, Phone in one line */}
        <div className="py-3 sm:py-4 flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
          {/* Left: Name + Company + Phone */}
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">
                {firstName} {lastName}
              </h1>
              {companyName && (
                <>
                  <span className="text-gray-400">•</span>
                  <span className="text-sm sm:text-base text-gray-600 truncate">
                    {companyName}
                  </span>
                </>
              )}
            </div>
            {phone && (
              <p className="text-xs sm:text-sm text-gray-500">
                📱 {phone}
              </p>
            )}
          </div>

          {/* Right: Edit Mode Indicator + Buttons */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {isEditing && (
              <div className="hidden sm:flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded">
                ✏️ Bearbeitungsmodus
              </div>
            )}
            <button
              onClick={() => onEditChange(!isEditing)}
              className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                isEditing
                  ? 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                  : 'bg-yellow-400 hover:bg-yellow-500 text-gray-900'
              }`}
            >
              {isEditing ? '✗ Abbrechen' : '✏️ Bearbeiten'}
            </button>
            <button
              onClick={onDelete}
              className="px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
            >
              🗑️
            </button>
          </div>
        </div>

        {/* Tabs Row */}
        <div className="flex gap-0.5 sm:gap-1 border-t border-gray-100 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-2.5 sm:px-3 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'text-yellow-600 border-yellow-600'
                  : 'text-gray-600 border-transparent hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
