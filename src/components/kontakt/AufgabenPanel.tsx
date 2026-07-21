'use client'
// Komplette Aufgabenhistorie eines Kontakts mit Status-Filter — Drawer-Inhalt.
// Zeilenklick öffnet das Bearbeiten-Modal (über onEditTask), Status ist inline änderbar.
import { useState } from 'react'

export interface KontaktAufgabe {
  id: string
  contact_id?: string
  titel: string
  beschreibung?: string
  status: 'offen' | 'in_bearbeitung' | 'erledigt'
  priorität: 'niedrig' | 'mittel' | 'hoch'
  fällig: string
  assigned_user_id?: string
  assigned_user?: { name: string }
  created_at?: string
}

const STATUS_FILTER = [
  { label: 'Alle', value: 'all' },
  { label: 'Offen', value: 'offen' },
  { label: 'In Bearbeitung', value: 'in_bearbeitung' },
  { label: 'Erledigt', value: 'erledigt' },
]

interface AufgabenPanelProps {
  aufgaben: KontaktAufgabe[]
  onStatusChange: (id: string, status: string) => void
  onEditTask: (aufgabe: KontaktAufgabe) => void
  onNewTask: () => void
}

export function AufgabenPanel({ aufgaben, onStatusChange, onEditTask, onNewTask }: AufgabenPanelProps) {
  const [statusFilter, setStatusFilter] = useState('all')

  const filtered = statusFilter === 'all' ? aufgaben : aufgaben.filter((a) => a.status === statusFilter)

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {STATUS_FILTER.map((f) => {
          const count = f.value === 'all' ? aufgaben.length : aufgaben.filter((a) => a.status === f.value).length
          return (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                statusFilter === f.value
                  ? 'bg-yellow-400 text-gray-900'
                  : 'bg-gray-100 text-gray-500 hover:text-gray-900'
              }`}
            >
              {f.label} {count}
            </button>
          )
        })}
        <button
          onClick={onNewTask}
          className="ml-auto text-yellow-600 hover:text-yellow-700 text-sm font-medium whitespace-nowrap"
        >
          + Neue Aufgabe
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="text-gray-400 text-sm py-8 text-center">Keine Aufgaben für diesen Kontakt.</p>
      ) : (
        <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
          {filtered.map((aufgabe) => (
            <div
              key={aufgabe.id}
              onClick={() => onEditTask(aufgabe)}
              className={`flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer ${
                aufgabe.status === 'erledigt' ? 'opacity-60' : ''
              }`}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-yellow-600 truncate">{aufgabe.titel}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {new Date(aufgabe.fällig).toLocaleDateString('de-DE')}
                  {' · '}
                  <span
                    className={
                      aufgabe.priorität === 'hoch'
                        ? 'text-red-600 font-semibold'
                        : aufgabe.priorität === 'mittel'
                          ? 'text-orange-600'
                          : 'text-gray-500'
                    }
                  >
                    {aufgabe.priorität.charAt(0).toUpperCase() + aufgabe.priorität.slice(1)}
                  </span>
                  {aufgabe.assigned_user?.name ? ` · ${aufgabe.assigned_user.name}` : ''}
                </p>
              </div>
              <div onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
                <select
                  value={aufgabe.status}
                  onChange={(e) => onStatusChange(aufgabe.id, e.target.value)}
                  className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${
                    aufgabe.status === 'offen'
                      ? 'bg-red-100 text-red-800'
                      : aufgabe.status === 'in_bearbeitung'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  <option value="offen">Offen</option>
                  <option value="in_bearbeitung">In Bearbeitung</option>
                  <option value="erledigt">Erledigt</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
