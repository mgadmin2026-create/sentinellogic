'use client'
// Fixierte Kopfzeile der Kontaktdetailseite (2 Zeilen + Tag/Notiz-Leiste).
// Zeile 1: Identität (Name, Status, Qualität) + Meta (Firma, Geburtstag/Alter,
// E-Mail, Verantwortlicher) + Aktionen. Zeile 2: Tags + Notizen, ebenfalls fixiert.
import { useState } from 'react'
import { toWhatsAppNumber } from '@/lib/phone'
import { PlacetelCallButton } from '@/components/PlacetelCallButton'
import { TagInput, type Tag } from '@/components/TagInput'

interface StickyContactHeaderProps {
  contactId: string
  firstName?: string
  lastName?: string
  companyName?: string
  email?: string
  phoneMobile?: string
  phoneOffice?: string
  status?: string
  qualität?: string
  geburtstag?: string
  assignedUserName?: string
  onEmailClick?: () => void
  onEditClick: () => void
  onDelete: () => void
  isArchived?: boolean
  tags: Tag[]
  onTagsChange: (tags: Tag[]) => void
  notes: string
  notesSaving?: boolean
  onSaveNotes: (notes: string) => Promise<void>
  amisStatusLabel?: string
  latestAmisTask?: any
  handleCreateAmisTask?: (taskType: 'person_create' | 'person_create_quote') => Promise<void>
  amisCreating?: string | null
}

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  new: { label: 'Neu', className: 'bg-blue-500 text-white' },
  contacted: { label: 'Kontaktiert', className: 'bg-amber-400 text-gray-900' },
  qualified: { label: 'Qualifiziert', className: 'bg-emerald-500 text-white' },
  customer: { label: 'Kunde', className: 'bg-purple-500 text-white' },
}

const QUALITÄT_LABELS: Record<string, string> = {
  kalt: '❄️ Kalt',
  warm: '☀️ Warm',
  heiss: '🔥 Heiß',
  'sehr-heiss': '🔥 Sehr heiß',
}

function calcAge(geburtstag?: string): number | null {
  if (!geburtstag) return null
  const birth = new Date(geburtstag)
  if (isNaN(birth.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--
  return age
}

export function StickyContactHeader({
  contactId,
  firstName,
  lastName,
  companyName,
  email,
  phoneMobile,
  phoneOffice,
  status,
  qualität,
  geburtstag,
  assignedUserName,
  onEmailClick,
  onEditClick,
  onDelete,
  isArchived,
  tags,
  onTagsChange,
  notes,
  notesSaving,
  onSaveNotes,
  amisStatusLabel,
  latestAmisTask,
  handleCreateAmisTask,
  amisCreating,
}: StickyContactHeaderProps) {
  const [notesEditMode, setNotesEditMode] = useState(false)
  const [notesDraft, setNotesDraft] = useState('')

  const callNumber = phoneMobile || phoneOffice
  const waNumber = toWhatsAppNumber(callNumber)
  const age = calcAge(geburtstag)
  const statusBadge = status ? STATUS_BADGES[status] : undefined
  const initials = `${(firstName || '?').charAt(0)}${(lastName || '?').charAt(0)}`.toUpperCase()
  const notesFirstLine = notes ? notes.split('\n')[0] : ''

  async function saveNotes() {
    await onSaveNotes(notesDraft)
    setNotesEditMode(false)
  }

  return (
    <div className="sticky top-0 z-40 shadow-md">
      {/* Zeile 1: Identität + Aktionen (dunkel) */}
      <div className="bg-[#1A1A1A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center font-bold text-sm text-gray-900 flex-shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-base sm:text-lg font-bold text-white truncate">
                    {firstName} {lastName}
                  </h1>
                  {isArchived && (
                    <span className="inline-flex rounded-full bg-gray-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-200">
                      Archiviert
                    </span>
                  )}
                  {statusBadge && (
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusBadge.className}`}>
                      {statusBadge.label}
                    </span>
                  )}
                  {qualität && QUALITÄT_LABELS[qualität] && (
                    <span className="text-yellow-400 text-xs font-semibold">{QUALITÄT_LABELS[qualität]}</span>
                  )}
                </div>
                <p className="text-[11px] sm:text-xs text-gray-400 mt-1 truncate">
                  {[
                    companyName,
                    geburtstag ? `🎂 ${new Date(geburtstag).toLocaleDateString('de-DE')}${age !== null ? ` (${age} J.)` : ''}` : null,
                    email ? `✉️ ${email}` : null,
                    assignedUserName,
                  ]
                    .filter(Boolean)
                    .join('  ·  ')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
              {callNumber && (
                <PlacetelCallButton
                  contactId={contactId}
                  phoneMobile={phoneMobile}
                  phoneOffice={phoneOffice}
                  disabled={isArchived}
                  variant="primary"
                  label={`📞 ${callNumber}`}
                  menuAlign="right"
                />
              )}

              {email && (
                <button
                  onClick={onEmailClick}
                  className="px-3 py-2 text-xs sm:text-sm font-semibold bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                  title={`E-Mail an ${email}`}
                >
                  ✉️ E-Mail
                </button>
              )}

              {/* AMIS.NOW Dropdown */}
              {handleCreateAmisTask && (
                <div className="relative group">
                  <button className="px-3 py-2 text-xs sm:text-sm font-semibold bg-amber-400 hover:bg-amber-500 text-gray-900 rounded-lg transition-colors">
                    ⚡ AMIS
                  </button>
                  <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                    <button
                      onClick={() => handleCreateAmisTask('person_create')}
                      disabled={amisCreating !== null}
                      className="w-full text-left px-4 py-2 text-xs font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 border-b border-gray-100"
                    >
                      {amisCreating === 'person_create' ? '⏳ Person anlegen...' : '👤 Person anlegen'}
                    </button>
                    <button
                      onClick={() => handleCreateAmisTask('person_create_quote')}
                      disabled={amisCreating !== null}
                      className="w-full text-left px-4 py-2 text-xs font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {amisCreating === 'person_create_quote' ? '⏳ Angebot berechnen...' : '💰 Angebot berechnen'}
                    </button>
                  </div>
                </div>
              )}

              {/* AMIS Status Info */}
              {latestAmisTask && (
                <div className="relative group">
                  <button className="px-2.5 py-2 text-xs sm:text-sm font-semibold rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors" title="AMIS Status">
                    ℹ️
                  </button>
                  <div className="absolute right-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg p-3 space-y-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 text-xs">
                    <div>
                      <p className="text-gray-500 font-semibold">Letzte Aufgabe</p>
                      <p className="text-gray-900">{latestAmisTask.titel}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 font-semibold">Status</p>
                      <p className="text-gray-900">{amisStatusLabel}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 font-semibold">Angebotsnummer</p>
                      <p className="text-gray-900">{latestAmisTask.amis_quote_number || '—'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 font-semibold">Erstellt</p>
                      <p className="text-gray-900">{latestAmisTask.created_at ? new Date(latestAmisTask.created_at).toLocaleDateString('de-DE') : '—'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Bearbeiten — öffnet den EditDrawer mit allen Feldern */}
              <button
                data-testid="contact-edit-toggle"
                onClick={onEditClick}
                className="px-3 py-2 text-xs sm:text-sm font-semibold bg-yellow-400 hover:bg-yellow-500 text-gray-900 rounded-lg transition-colors"
              >
                ✏️ Bearbeiten
              </button>

              {/* Archivieren */}
              <button
                onClick={onDelete}
                title="Archivieren"
                className="px-2.5 py-2 text-xs sm:text-sm font-medium bg-red-500/20 hover:bg-red-500/35 text-red-300 rounded-lg transition-colors"
              >
                🗑️
              </button>

              {/* ⋯-Menü: tel-Anruf + WhatsApp */}
              {(callNumber || waNumber) && (
                <div className="relative group">
                  <button className="px-2.5 py-2 text-xs sm:text-sm font-semibold bg-white/10 hover:bg-white/20 text-gray-300 rounded-lg transition-colors" title="Weitere Aktionen">
                    ⋯
                  </button>
                  <div className="absolute right-0 mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                    {callNumber && (
                      <a
                        href={`tel:${callNumber}`}
                        title={`Anrufen: ${callNumber}`}
                        className="block px-4 py-2 text-xs font-medium text-gray-900 hover:bg-gray-50 border-b border-gray-100"
                      >
                        📞 Anrufen (Gerät): {callNumber}
                      </a>
                    )}
                    {waNumber && (
                      <a
                        href={`https://wa.me/${waNumber}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="WhatsApp-Chat öffnen"
                        className="block px-4 py-2 text-xs font-medium text-gray-900 hover:bg-gray-50"
                      >
                        💬 WhatsApp öffnen
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Zeile 2: Tags + Notizen (hell, ebenfalls fixiert) */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-1.5">
          <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
            <div className="flex items-center gap-2 min-w-0 sm:max-w-md flex-shrink-0">
              <span className="text-xs text-gray-400 flex-shrink-0">🏷️</span>
              <TagInput value={tags} onChange={onTagsChange} placeholder="Tag hinzufügen…" />
            </div>
            <div className="hidden sm:block w-px h-5 bg-gray-200 flex-shrink-0" />
            {notesEditMode ? (
              <div className="flex items-center gap-2 flex-1 min-w-0 py-1">
                <textarea
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  placeholder="Notizen zum Kontakt…"
                  autoFocus
                  rows={2}
                  className="flex-1 p-2 border border-amber-200 rounded-lg bg-amber-50/50 text-xs focus:outline-none focus:ring-2 focus:ring-yellow-400/40 resize-y"
                />
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <button
                    onClick={saveNotes}
                    disabled={notesSaving}
                    className="bg-yellow-400 hover:bg-yellow-500 disabled:opacity-50 text-gray-900 font-semibold text-[10px] px-3 py-1 rounded transition-colors"
                  >
                    {notesSaving ? '…' : 'Speichern'}
                  </button>
                  <button
                    onClick={() => setNotesEditMode(false)}
                    className="text-[10px] text-gray-500 hover:text-gray-900 font-medium px-3 py-1"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <button
                  onClick={() => {
                    setNotesDraft(notes)
                    setNotesEditMode(true)
                  }}
                  className="flex-1 min-w-0 text-left group"
                  title={notes || 'Notizen bearbeiten'}
                >
                  <span className="text-xs font-semibold text-amber-800 mr-1.5">📋</span>
                  {notes ? (
                    <span className="text-xs text-gray-700 truncate inline-block max-w-full align-middle">
                      {notesFirstLine.slice(0, 140)}
                      {notes.length > 140 || notes.includes('\n') ? '…' : ''}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400 italic">Keine Notizen</span>
                  )}
                </button>
                <button
                  onClick={() => {
                    setNotesDraft(notes)
                    setNotesEditMode(true)
                  }}
                  className="flex-shrink-0 text-[11px] text-amber-700 hover:text-amber-900 font-medium"
                >
                  ✏️
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
