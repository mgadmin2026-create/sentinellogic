// Dashboard — Übersicht aller Leads und KPIs
// Server Component: Daten werden serverseitig geladen
import { createServerClient } from '@/lib/supabase/server'
import type { Lead } from '@/types'

async function getDashboardData() {
  try {
    const supabase = createServerClient()

    const [leadsResult, activitiesResult] = await Promise.all([
      supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('activities')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5),
    ])

    if (leadsResult.error) throw new Error(`Leads Fehler: ${leadsResult.error.message}`)
    if (activitiesResult.error) throw new Error(`Aktivitäten Fehler: ${activitiesResult.error.message}`)

    return {
      leads: leadsResult.data as Lead[],
      activities: activitiesResult.data,
    }
  } catch (error) {
    console.error('[Dashboard] Daten laden Fehler:', error)
    return { leads: [], activities: [] }
  }
}

const STATUS_LABELS: Record<string, string> = {
  new: 'Neu',
  contacted: 'Kontaktiert',
  qualified: 'Qualifiziert',
  customer: 'Kunde',
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  qualified: 'bg-green-100 text-green-800',
  customer: 'bg-purple-100 text-purple-800',
}

export default async function DashboardPage() {
  const { leads, activities } = await getDashboardData()

  const kpis = {
    total: leads.length,
    new: leads.filter((l) => l.status === 'new').length,
    qualified: leads.filter((l) => l.status === 'qualified').length,
    customer: leads.filter((l) => l.status === 'customer').length,
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Sentimental Logic — Dashboard
        </h1>

        {/* KPI Kacheln */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Leads gesamt', value: kpis.total, color: 'bg-gray-800 text-white' },
            { label: 'Neue Leads', value: kpis.new, color: 'bg-blue-600 text-white' },
            { label: 'Qualifiziert', value: kpis.qualified, color: 'bg-green-600 text-white' },
            { label: 'Kunden', value: kpis.customer, color: 'bg-purple-600 text-white' },
          ].map((kpi) => (
            <div key={kpi.label} className={`rounded-xl p-5 ${kpi.color}`}>
              <p className="text-sm opacity-80">{kpi.label}</p>
              <p className="text-3xl font-bold mt-1">{kpi.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Letzte Leads */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Neueste Leads</h2>
            {leads.length === 0 ? (
              <p className="text-gray-500 text-sm">Noch keine Leads vorhanden.</p>
            ) : (
              <div className="space-y-3">
                {leads.map((lead) => (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {lead.first_name} {lead.last_name}
                      </p>
                      <p className="text-sm text-gray-500">{lead.email || lead.phone}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 capitalize">{lead.source}</span>
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${
                          STATUS_COLORS[lead.status] ?? 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {STATUS_LABELS[lead.status] ?? lead.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Letzte Aktivitäten */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Aktivitäten</h2>
            {activities.length === 0 ? (
              <p className="text-gray-500 text-sm">Noch keine Aktivitäten.</p>
            ) : (
              <div className="space-y-3">
                {activities.map((activity) => (
                  <div key={activity.id} className="text-sm">
                    <p className="text-gray-900">{activity.description}</p>
                    <p className="text-gray-400 text-xs mt-0.5">
                      {new Date(activity.created_at).toLocaleDateString('de-DE')}
                    </p>
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
