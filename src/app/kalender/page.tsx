'use client'
import { useState, useEffect } from 'react'

const ChevronLeft = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"></polyline>
  </svg>
)

const ChevronRight = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"></polyline>
  </svg>
)

interface Aufgabe {
  id: string
  titel: string
  fällig: string
  status: 'offen' | 'in_bearbeitung' | 'erledigt'
  priorität: 'niedrig' | 'mittel' | 'hoch'
  contact_id?: string
  contact?: { first_name: string; last_name: string }
}

const STATUS_COLORS: Record<string, string> = {
  offen: 'bg-red-100 text-red-800',
  in_bearbeitung: 'bg-yellow-100 text-yellow-800',
  erledigt: 'bg-emerald-100 text-emerald-800',
}

const PRIORITÄT_COLORS: Record<string, string> = {
  niedrig: 'text-gray-500',
  mittel: 'text-orange-500',
  hoch: 'text-red-500',
}

const TAGE_DER_WOCHE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

export default function KalenderPage() {
  const [view, setView] = useState<'month' | 'week'>('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [aufgaben, setAufgaben] = useState<Aufgabe[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [statusFilter, setStatusFilter] = useState<string>('nicht-erledigt')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAufgaben()
  }, [statusFilter])

  async function loadAufgaben() {
    try {
      setLoading(true)
      const res = await fetch('/api/aufgaben?limit=1000')
      const json = await res.json()
      if (json.success) {
        let data = json.data || []
        // Filter: exclude completed by default
        if (statusFilter === 'nicht-erledigt') {
          data = data.filter((a: Aufgabe) => a.status !== 'erledigt')
        }
        setAufgaben(data)
      }
    } catch (err) {
      console.error('Fehler beim Laden der Aufgaben:', err)
    } finally {
      setLoading(false)
    }
  }

  function getAufgabenForDate(date: Date): Aufgabe[] {
    const dateStr = date.toISOString().split('T')[0]
    return aufgaben.filter((a) => a.fällig === dateStr)
  }

  function getDaysInMonth(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  function getFirstDayOfMonth(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  }

  function getWeekDates(date: Date): Date[] {
    const start = new Date(date)
    start.setDate(date.getDate() - date.getDay() + 1)
    const week = []
    for (let i = 0; i < 7; i++) {
      week.push(new Date(start))
      start.setDate(start.getDate() + 1)
    }
    return week
  }

  function prevMonth() {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))
  }

  function nextMonth() {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))
  }

  function prevWeek() {
    const prev = new Date(currentDate)
    prev.setDate(prev.getDate() - 7)
    setCurrentDate(prev)
  }

  function nextWeek() {
    const next = new Date(currentDate)
    next.setDate(next.getDate() + 7)
    setCurrentDate(next)
  }

  const formatDate = (d: Date) => d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Kalender</h1>
          <p className="text-gray-500 text-sm mt-1">Fällige Aufgaben</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setView('month')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              view === 'month' ? 'bg-yellow-400 text-gray-900' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Monat
          </button>
          <button
            onClick={() => setView('week')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              view === 'week' ? 'bg-yellow-400 text-gray-900' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Woche
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Kalender */}
        <div className="col-span-2 bg-white rounded-xl border border-gray-200 p-6">
          {/* Navigation */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={view === 'month' ? prevMonth : prevWeek}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft />
            </button>
            <h2 className="text-lg font-semibold text-gray-900">
              {view === 'month'
                ? currentDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
                : `Woche ${formatDate(getWeekDates(currentDate)[0])} - ${formatDate(getWeekDates(currentDate)[6])}`}
            </h2>
            <button
              onClick={view === 'month' ? nextMonth : nextWeek}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight />
            </button>
          </div>

          {/* Month View */}
          {view === 'month' && (
            <div>
              {/* Wochentage Header */}
              <div className="grid grid-cols-7 gap-2 mb-2">
                {TAGE_DER_WOCHE.map((day) => (
                  <div key={day} className="text-center text-sm font-semibold text-gray-600 py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Kalender Grid */}
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: getFirstDayOfMonth(currentDate) - 1 }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-24 bg-gray-50 rounded-lg" />
                ))}

                {Array.from({ length: getDaysInMonth(currentDate) }).map((_, i) => {
                  const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), i + 1)
                  const dayAufgaben = getAufgabenForDate(date)
                  const isToday = new Date().toISOString().split('T')[0] === date.toISOString().split('T')[0]

                  return (
                    <div
                      key={i}
                      onClick={() => setSelectedDate(date)}
                      className={`min-h-24 p-2 rounded-lg border-2 cursor-pointer transition-colors ${
                        isToday
                          ? 'border-yellow-400 bg-yellow-50'
                          : selectedDate.toISOString().split('T')[0] === date.toISOString().split('T')[0]
                            ? 'border-yellow-400 bg-yellow-100'
                            : dayAufgaben.length > 0
                              ? 'border-blue-200 bg-blue-50 hover:bg-blue-100'
                              : 'border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                    >
                      <p className="text-sm font-semibold text-gray-900 mb-1">{i + 1}</p>
                      <div className="space-y-1">
                        {dayAufgaben.slice(0, 2).map((a) => (
                          <div key={a.id} className="text-xs text-gray-600 truncate" title={a.titel}>
                            • {a.titel.substring(0, 12)}
                          </div>
                        ))}
                        {dayAufgaben.length > 2 && <div className="text-xs text-gray-500">+{dayAufgaben.length - 2} mehr</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Week View */}
          {view === 'week' && (
            <div className="space-y-2">
              {getWeekDates(currentDate).map((date) => {
                const dayAufgaben = getAufgabenForDate(date)
                const isToday = new Date().toISOString().split('T')[0] === date.toISOString().split('T')[0]

                return (
                  <div
                    key={date.toISOString()}
                    onClick={() => setSelectedDate(date)}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                      isToday
                        ? 'border-yellow-400 bg-yellow-50'
                        : selectedDate.toISOString().split('T')[0] === date.toISOString().split('T')[0]
                          ? 'border-yellow-400 bg-yellow-100'
                          : dayAufgaben.length > 0
                            ? 'border-blue-200 bg-blue-50 hover:bg-blue-100'
                            : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <p className="font-semibold text-gray-900 mb-2">
                      {formatDate(date)} {isToday && <span className="text-yellow-600">(Heute)</span>}
                    </p>
                    {dayAufgaben.length === 0 ? (
                      <p className="text-sm text-gray-400">Keine Aufgaben</p>
                    ) : (
                      <div className="space-y-1">
                        {dayAufgaben.map((a) => (
                          <div key={a.id} className="text-sm text-gray-600">
                            • {a.titel}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Sidebar: Aufgaben Details */}
        <div className="space-y-4">
          {/* Status Filter */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 font-semibold uppercase mb-3">Status Filter</p>
            <div className="space-y-2">
              <button
                onClick={() => setStatusFilter('nicht-erledigt')}
                className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                  statusFilter === 'nicht-erledigt'
                    ? 'bg-yellow-100 text-yellow-900 border border-yellow-400'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Nicht erledigt
              </button>
              <button
                onClick={() => setStatusFilter('alle')}
                className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                  statusFilter === 'alle' ? 'bg-yellow-100 text-yellow-900 border border-yellow-400' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Alle
              </button>
            </div>
          </div>

          {/* Ausgewählter Tag */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 font-semibold uppercase mb-3">
              {selectedDate.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>

            {loading ? (
              <p className="text-gray-400 text-sm">Laden…</p>
            ) : getAufgabenForDate(selectedDate).length === 0 ? (
              <p className="text-gray-400 text-sm">Keine Aufgaben</p>
            ) : (
              <div className="space-y-3">
                {getAufgabenForDate(selectedDate).map((a) => (
                  <div key={a.id} className="border border-gray-200 rounded-lg p-3">
                    <p className="text-sm font-semibold text-gray-900">{a.titel}</p>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <span className={`text-xs font-medium px-2 py-1 rounded ${STATUS_COLORS[a.status]}`}>{a.status}</span>
                      <span className={`text-xs font-bold ${PRIORITÄT_COLORS[a.priorität]}`}>
                        {'●'.repeat(['niedrig', 'mittel', 'hoch'].indexOf(a.priorität) + 1)}
                      </span>
                    </div>
                    {a.contact && <p className="text-xs text-gray-500 mt-2">{a.contact.first_name} {a.contact.last_name}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
