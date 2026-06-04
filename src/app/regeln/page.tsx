'use client'
// Automatisierungsregeln — echte DB-Anbindung, WENN/DANN Karten
import { useState, useEffect } from 'react'
import { SOURCE_LABELS, type LeadStatus, type LeadSource } from '@/data/mock'

interface Rule {
  id: string; created_at: string; name: string
  condition_source: LeadSource | 'all'
  actions: {
    klicktipp_tag?: string; dialfire_campaign?: string
    set_status?: LeadStatus; send_notification?: boolean
    notification_email?: string
  }
  active: boolean; runs: number
}

const STATUS_LABELS: Record<string, string> = {
  new: 'Neu', contacted: 'Kontaktiert', qualified: 'Qualifiziert', customer: 'Kunde',
}
const SOURCE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'Alle Quellen' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'calendly', label: 'Calendly' },
  { value: 'email', label: 'E-Mail' },
  { value: 'csv', label: 'CSV' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'manuell', label: 'Manuell' },
]
const STATUS_OPTIONS = [
  { value: 'new', label: 'Neu' }, { value: 'contacted', label: 'Kontaktiert' },
  { value: 'qualified', label: 'Qualifiziert' }, { value: 'customer', label: 'Kunde' },
]

export default function RegelnPage() {
  const [rules, setRules] = useState<Rule[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Neues Formular
  const [newSource, setNewSource] = useState('facebook')
  const [newKlicktipp, setNewKlicktipp] = useState('')
  const [newDialfire, setNewDialfire] = useState('')
  const [newStatus, setNewStatus] = useState('')
  const [newNotification, setNewNotification] = useState(false)
  const [newNotificationEmail, setNewNotificationEmail] = useState('')

  function loadRules() {
    fetch('/api/rules').then((r) => r.json())
      .then((res) => { if (res.success) setRules(res.data) })
      .catch(console.error).finally(() => setLoading(false))
  }
  useEffect(() => { loadRules() }, [])

  async function toggleRule(rule: Rule) {
    const res = await fetch(`/api/rules/${rule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !rule.active }),
    })
    const data = await res.json()
    if (data.success) setRules((prev) => prev.map((r) => r.id === rule.id ? data.data : r))
  }

  async function deleteRule(id: string) {
    await fetch(`/api/rules/${id}`, { method: 'DELETE' })
    setDeleteId(null); loadRules()
  }

  async function saveRule() {
    if (!newKlicktipp && !newDialfire && !newStatus && !newNotification) return
    setSaving(true)
    const sourceLbl = SOURCE_OPTIONS.find((s) => s.value === newSource)?.label ?? newSource
    const actions: Rule['actions'] = {}
    if (newKlicktipp) actions.klicktipp_tag = newKlicktipp
    if (newDialfire) actions.dialfire_campaign = newDialfire
    if (newStatus) actions.set_status = newStatus as LeadStatus
    if (newNotification) {
      actions.send_notification = true
      if (newNotificationEmail.trim()) actions.notification_email = newNotificationEmail.trim()
    }

    await fetch('/api/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${sourceLbl} → Neue Regel`,
        condition_source: newSource,
        actions,
        active: true,
      }),
    })
    setSaving(false); setModalOpen(false)
    setNewSource('facebook'); setNewKlicktipp(''); setNewDialfire('')
    setNewStatus(''); setNewNotification(false); setNewNotificationEmail('')
    loadRules()
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Automatisierungsregeln</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {loading ? 'Lädt…' : `${rules.filter((r) => r.active).length} aktive Regeln — werden bei jedem neuen Lead ausgeführt`}
          </p>
        </div>
        <button onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 bg-[#FFC300] hover:bg-[#e6b000] text-[#1A1A1A] font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Neue Regel erstellen
        </button>
      </div>

      {/* Info-Banner */}
      <div className="bg-[#FFC300]/8 border border-[#FFC300]/25 rounded-xl px-5 py-3.5 mb-6 flex items-start gap-3">
        <svg width="16" height="16" className="text-[#b88c00] flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>
        <p className="text-sm text-[#b88c00]">
          Regeln werden automatisch ausgeführt, sobald ein neuer Lead angelegt wird.
          Jede Ausführung wird in der <strong>Aktivitäts-Timeline</strong> des Leads dokumentiert.
        </p>
      </div>

      {/* Regeln-Karten */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Regeln werden geladen…</div>
      ) : (
        <div className="space-y-4">
          {rules.map((rule) => (
            <div key={rule.id}
              className={`bg-white rounded-xl border shadow-sm p-5 transition-all ${rule.active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${rule.active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                      {rule.active ? '● Aktiv' : '○ Inaktiv'}
                    </span>
                    <span className="text-xs text-gray-400">{rule.runs} Ausführungen</span>
                  </div>

                  <div className="flex items-stretch gap-3">
                    {/* WENN */}
                    <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 min-w-[160px]">
                      <p className="text-xs font-bold text-blue-500 uppercase tracking-wide mb-1">WENN</p>
                      <p className="text-sm font-semibold text-[#1A1A1A]">
                        Quelle = {SOURCE_OPTIONS.find((s) => s.value === rule.condition_source)?.label ?? rule.condition_source}
                      </p>
                    </div>

                    <div className="flex items-center text-gray-300">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </div>

                    {/* DANN */}
                    <div className="bg-[#FFC300]/8 border border-[#FFC300]/20 rounded-lg px-4 py-3 flex-1">
                      <p className="text-xs font-bold text-[#b88c00] uppercase tracking-wide mb-2">DANN</p>
                      <div className="space-y-1">
                        {rule.actions.klicktipp_tag && (
                          <div className="flex items-center gap-1.5 text-sm text-[#1A1A1A]">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                            Klicktipp Tag: <span className="font-semibold ml-1">"{rule.actions.klicktipp_tag}"</span>
                          </div>
                        )}
                        {rule.actions.dialfire_campaign && (
                          <div className="flex items-center gap-1.5 text-sm text-[#1A1A1A]">
                            <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                            Dialfire Kampagne: <span className="font-semibold ml-1">"{rule.actions.dialfire_campaign}"</span>
                          </div>
                        )}
                        {rule.actions.set_status && (
                          <div className="flex items-center gap-1.5 text-sm text-[#1A1A1A]">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Status setzen: <span className="font-semibold ml-1">{STATUS_LABELS[rule.actions.set_status]}</span>
                          </div>
                        )}
                        {rule.actions.send_notification && (
                          <div className="flex items-center gap-1.5 text-sm text-[#1A1A1A]">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                            <span className="font-semibold">Benachrichtigung</span>
                            {rule.actions.notification_email && (
                              <span className="text-gray-500">→ {rule.actions.notification_email}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Aktionen */}
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <button onClick={() => toggleRule(rule)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${rule.active ? 'bg-[#FFC300]' : 'bg-gray-200'}`}>
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${rule.active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                  <div className="flex gap-1.5 mt-1">
                    <button onClick={() => setDeleteId(rule.id)}
                      className="text-xs text-red-400 hover:text-red-600 border border-red-100 hover:border-red-300 px-2.5 py-1.5 rounded-lg transition-all">
                      Löschen
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {rules.length === 0 && (
            <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-200">
              <p className="font-medium">Keine Regeln vorhanden</p>
              <p className="text-sm mt-1">Erstelle deine erste Automatisierungsregel.</p>
            </div>
          )}
        </div>
      )}

      {/* Neue Regel Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-[#1A1A1A]">Neue Regel erstellen</h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="p-6 space-y-5">
              {/* Bedingung */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">WENN — Bedingung</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Quelle =</span>
                  <select value={newSource} onChange={(e) => setNewSource(e.target.value)}
                    className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#FFC300]/40">
                    {SOURCE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              {/* Aktionen */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">DANN — Aktionen</label>
                <div className="space-y-3">
                  {[
                    { dot: 'bg-blue-400', label: 'Klicktipp Tag:', value: newKlicktipp, set: setNewKlicktipp, placeholder: 'z.B. fb-lead' },
                    { dot: 'bg-orange-400', label: 'Dialfire Kampagne:', value: newDialfire, set: setNewDialfire, placeholder: 'z.B. BHV-Gewerbe' },
                  ].map((f) => (
                    <div key={f.label} className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${f.dot} flex-shrink-0`} />
                      <span className="text-sm text-gray-600 w-40 flex-shrink-0">{f.label}</span>
                      <input type="text" placeholder={f.placeholder} value={f.value} onChange={(e) => f.set(e.target.value)}
                        className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#FFC300]/40" />
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                    <span className="text-sm text-gray-600 w-40 flex-shrink-0">Lead-Status:</span>
                    <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}
                      className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#FFC300]/40">
                      <option value="">— kein Status —</option>
                      {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0" />
                    <span className="text-sm text-gray-600 flex-1">Benachrichtigung senden</span>
                    <button onClick={() => setNewNotification(!newNotification)}
                      className={`relative w-9 h-5 rounded-full transition-colors ${newNotification ? 'bg-[#FFC300]' : 'bg-gray-200'}`}>
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${newNotification ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                  {newNotification && (
                    <div className="flex items-center gap-2 pl-4 border-l-2 border-purple-100">
                      <span className="text-sm text-gray-500 w-36 flex-shrink-0">E-Mail-Adresse:</span>
                      <input
                        type="email"
                        placeholder="z.B. admin@firma.de"
                        value={newNotificationEmail}
                        onChange={(e) => setNewNotificationEmail(e.target.value)}
                        className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#FFC300]/40"
                      />
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setModalOpen(false)} className="flex-1 border border-gray-200 text-gray-600 font-medium text-sm px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors">Abbrechen</button>
                <button onClick={saveRule} disabled={saving || (!newKlicktipp && !newDialfire && !newStatus && !newNotification)}
                  className="flex-1 bg-[#FFC300] hover:bg-[#e6b000] disabled:opacity-40 text-[#1A1A1A] font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors">
                  {saving ? 'Speichert…' : 'Regel speichern'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Löschen-Bestätigung */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </div>
            <h3 className="text-lg font-bold mb-4">Regel löschen?</h3>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 border border-gray-200 text-gray-600 font-medium text-sm px-4 py-2.5 rounded-lg">Abbrechen</button>
              <button onClick={() => deleteRule(deleteId)} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold text-sm px-4 py-2.5 rounded-lg">Löschen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
