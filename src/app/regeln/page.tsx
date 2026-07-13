'use client'
import { useState, useEffect } from 'react'
import { SOURCE_LABELS, type LeadStatus, type LeadSource } from '@/data/mock'

interface Rule {
  id: string; created_at: string; name: string
  condition_source: LeadSource | 'all'
  condition_insurance_product?: string
  actions: {
    klicktipp_tag?: string; dialfire_campaign?: string; dialfire_task_name?: string
    set_status?: LeadStatus; send_notification?: boolean
    notification_email?: string
  }
  active: boolean; runs: number
}

interface IntegrationConfig {
  dialfire_campaigns?: Array<{ id: string; name: string; label: string }>
  dialfire_tasks?: Array<{ task_name: string; task_label: string; description: string }>
  klicktipp_tags?: Array<{ tag_id: number; tag_name: string; tag_label: string }>
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
  { value: 'ki_upload', label: 'KI Upload' },
]
const INSURANCE_PRODUCT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Alle Versicherungstypen' },
  { value: 'PKV', label: 'PKV (Private Krankenversicherung)' },
  { value: 'Unternehmerschutz', label: 'Unternehmerschutz' },
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
  const [applyingRuleId, setApplyingRuleId] = useState<string | null>(null)
  const [applyMessage, setApplyMessage] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<IntegrationConfig>({})

  // Form state
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)
  const [newSource, setNewSource] = useState('facebook')
  const [newInsuranceProduct, setNewInsuranceProduct] = useState('')
  const [newKlicktipp, setNewKlicktipp] = useState('')
  const [newDialfire, setNewDialfire] = useState('')
  const [newDialfireTask, setNewDialfireTask] = useState('')
  const [newStatus, setNewStatus] = useState('')
  const [newNotification, setNewNotification] = useState(false)
  const [newNotificationEmail, setNewNotificationEmail] = useState('')

  // Load config and rules
  useEffect(() => {
    Promise.all([
      fetch('/api/config?key=system_config').then(r => r.json()),
      fetch('/api/rules').then(r => r.json())
    ]).then(([configRes, rulesRes]) => {
      if (configRes.success) setConfig(configRes.data)
      if (rulesRes.success) setRules(rulesRes.data)
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  async function toggleRule(rule: Rule) {
    const res = await fetch(`/api/rules/${rule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !rule.active }),
    })
    const data = await res.json()
    if (data.success) setRules((prev) => prev.map((r) => r.id === rule.id ? data.data : r))
  }

  async function applyBatchRule(ruleId: string) {
    setApplyingRuleId(ruleId)
    setApplyMessage('')

    try {
      const res = await fetch(`/api/rules/${ruleId}/apply-batch`, {
        method: 'POST',
      })
      const result = await res.json()

      if (result.success) {
        setApplyMessage(`✅ ${result.message} (${result.applied} Kontakte aktualisiert)`)
        loadRules() // Ausführungszähler in der Anzeige aktualisieren
      } else {
        setApplyMessage(`❌ Fehler: ${result.error}`)
      }

      setTimeout(() => {
        setApplyMessage('')
        setApplyingRuleId(null)
      }, 5000)
    } catch (err) {
      setApplyMessage(`❌ Fehler: ${err instanceof Error ? err.message : 'Unknown error'}`)
      setTimeout(() => {
        setApplyMessage('')
        setApplyingRuleId(null)
      }, 5000)
    }
  }

  async function deleteRule(id: string) {
    await fetch(`/api/rules/${id}`, { method: 'DELETE' })
    setDeleteId(null); loadRules()
  }

  function loadRules() {
    fetch('/api/rules').then((r) => r.json())
      .then((res) => { if (res.success) setRules(res.data) })
      .catch(console.error)
  }

  async function saveRule() {
    if (!newKlicktipp && !newDialfire && !newDialfireTask && !newStatus && !newNotification) return
    setSaving(true)
    const sourceLbl = SOURCE_OPTIONS.find((s) => s.value === newSource)?.label ?? newSource
    const actions: Rule['actions'] = {}
    if (newKlicktipp) actions.klicktipp_tag = newKlicktipp
    if (newDialfire) actions.dialfire_campaign = newDialfire
    if (newDialfireTask) actions.dialfire_task_name = newDialfireTask
    if (newStatus) actions.set_status = newStatus as LeadStatus
    if (newNotification) {
      actions.send_notification = true
      if (newNotificationEmail.trim()) actions.notification_email = newNotificationEmail.trim()
    }

    const insuranceLbl = INSURANCE_PRODUCT_OPTIONS.find((i) => i.value === newInsuranceProduct)?.label
    const ruleName = insuranceLbl && insuranceLbl !== 'Alle Versicherungstypen'
      ? `${sourceLbl} + ${insuranceLbl} → ${editingRuleId ? 'Regel' : 'Neue Regel'}`
      : `${sourceLbl} → ${editingRuleId ? 'Regel' : 'Neue Regel'}`

    const url = editingRuleId ? `/api/rules/${editingRuleId}` : '/api/rules'
    const method = editingRuleId ? 'PATCH' : 'POST'
    const payload = {
      name: ruleName,
      condition_source: newSource,
      condition_insurance_product: newInsuranceProduct || null,
      actions,
      ...(editingRuleId ? {} : { active: true })
    }

    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false); setModalOpen(false); setEditingRuleId(null)
    setNewSource('facebook'); setNewInsuranceProduct(''); setNewKlicktipp(''); setNewDialfire(''); setNewDialfireTask('')
    setNewStatus(''); setNewNotification(false); setNewNotificationEmail('')
    loadRules()
  }

  function editRule(rule: Rule) {
    setEditingRuleId(rule.id)
    setNewSource(rule.condition_source)
    setNewInsuranceProduct(rule.condition_insurance_product || '')
    setNewKlicktipp(rule.actions.klicktipp_tag || '')
    setNewDialfire(rule.actions.dialfire_campaign || '')
    setNewDialfireTask(rule.actions.dialfire_task_name || '')
    setNewStatus(rule.actions.set_status || '')
    setNewNotification(rule.actions.send_notification || false)
    setNewNotificationEmail(rule.actions.notification_email || '')
    setModalOpen(true)
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
        <button onClick={() => {
          setEditingRuleId(null)
          setNewSource('facebook'); setNewInsuranceProduct(''); setNewKlicktipp(''); setNewDialfire(''); setNewDialfireTask('')
          setNewStatus(''); setNewNotification(false); setNewNotificationEmail('')
          setModalOpen(true)
        }}
          className="flex items-center gap-2 bg-[#FFC300] hover:bg-[#e6b000] text-[#1A1A1A] font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Neue Regel erstellen
        </button>
      </div>

      {/* Info Banner */}
      <div className="bg-[#FFC300]/8 border border-[#FFC300]/25 rounded-xl px-5 py-3.5 mb-6 flex items-start gap-3">
        <svg width="16" height="16" className="text-[#b88c00] flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>
        <p className="text-sm text-[#b88c00]">
          Regeln werden automatisch ausgeführt, sobald ein neuer Lead angelegt wird.
          Alle Werte müssen vorher in <strong>Einstellungen → Integration Setup</strong> konfiguriert werden.
        </p>
      </div>

      {/* Feedback Message */}
      {applyMessage && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
          {applyMessage}
        </div>
      )}

      {/* Rules */}
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
                    <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 min-w-[200px]">
                      <p className="text-xs font-bold text-blue-500 uppercase tracking-wide mb-1">WENN</p>
                      <p className="text-sm font-semibold text-[#1A1A1A] mb-1">
                        Quelle = {SOURCE_OPTIONS.find((s) => s.value === rule.condition_source)?.label ?? rule.condition_source}
                      </p>
                      {rule.condition_insurance_product && (
                        <p className="text-sm font-semibold text-[#1A1A1A] text-blue-700">
                          + Typ = {INSURANCE_PRODUCT_OPTIONS.find((i) => i.value === rule.condition_insurance_product)?.label ?? rule.condition_insurance_product}
                        </p>
                      )}
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
                            KlickTipp Tag: <span className="font-semibold ml-1">{rule.actions.klicktipp_tag}</span>
                          </div>
                        )}
                        {rule.actions.dialfire_campaign && (
                          <div className="flex items-center gap-1.5 text-sm text-[#1A1A1A]">
                            <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                            Dialfire Kampagne: <span className="font-semibold ml-1">{rule.actions.dialfire_campaign}</span>
                          </div>
                        )}
                        {rule.actions.dialfire_task_name && (
                          <div className="flex items-center gap-1.5 text-sm text-[#1A1A1A]">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                            Dialfire Task: <span className="font-semibold ml-1">{rule.actions.dialfire_task_name}</span>
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
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                            Email Benachrichtigung: <span className="font-semibold ml-1">{rule.actions.notification_email || 'Ja'}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {rule.active && (
                    <button
                      onClick={() => applyBatchRule(rule.id)}
                      disabled={applyingRuleId === rule.id}
                      className="text-xs font-semibold px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 disabled:opacity-50 rounded-lg transition-colors"
                      title="Auf alle bestehenden Kontakte mit dieser Quelle anwenden"
                    >
                      {applyingRuleId === rule.id ? '⏳ Lädt...' : '📋 Anwenden'}
                    </button>
                  )}
                  <button onClick={() => toggleRule(rule)}
                    className={`relative w-9 h-5 rounded-full transition-colors ${rule.active ? 'bg-emerald-500' : 'bg-gray-200'}`}>
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${rule.active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                  <button onClick={() => editRule(rule)}
                    className="text-gray-400 hover:text-blue-600 text-lg transition-colors"
                    title="Regel bearbeiten">
                    ✎
                  </button>
                  <button onClick={() => setDeleteId(rule.id)}
                    className="text-gray-400 hover:text-red-500 text-lg transition-colors">
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-[#1A1A1A]">
                {editingRuleId ? '✎ Regel bearbeiten' : '➕ Neue Regel erstellen'}
              </h2>
              <button onClick={() => { setModalOpen(false); setEditingRuleId(null) }}
                className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
            </div>

            <div className="space-y-4">
              {/* Source */}
              <div>
                <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">Quelle</label>
                <select value={newSource} onChange={(e) => setNewSource(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#FFC300]">
                  {SOURCE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Insurance Product */}
              <div>
                <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">Versicherungstyp (optional)</label>
                <select value={newInsuranceProduct} onChange={(e) => setNewInsuranceProduct(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#FFC300]">
                  {INSURANCE_PRODUCT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* KlickTipp Tag - Dropdown */}
              <div>
                <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">KlickTipp Tag (optional)</label>
                <select value={newKlicktipp} onChange={(e) => setNewKlicktipp(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#FFC300]">
                  <option value="">-- Kein Tag --</option>
                  {config.klicktipp_tags?.map((tag) => (
                    <option key={tag.tag_id} value={tag.tag_name}>{tag.tag_label}</option>
                  ))}
                </select>
              </div>

              {/* Dialfire Campaign - Dropdown */}
              <div>
                <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">Dialfire Kampagne (optional)</label>
                <select value={newDialfire} onChange={(e) => setNewDialfire(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#FFC300]">
                  <option value="">-- Keine Kampagne --</option>
                  {config.dialfire_campaigns?.map((camp) => (
                    <option key={camp.id} value={camp.id}>{camp.label}</option>
                  ))}
                </select>
              </div>

              {/* Dialfire Task - Dropdown */}
              <div>
                <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">Dialfire Task (optional)</label>
                <select value={newDialfireTask} onChange={(e) => setNewDialfireTask(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#FFC300]">
                  <option value="">-- Keine Task --</option>
                  {config.dialfire_tasks?.map((task) => (
                    <option key={task.task_name} value={task.task_name}>{task.task_label}</option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">Status (optional)</label>
                <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#FFC300]">
                  <option value="">-- Kein Status --</option>
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Notification */}
              <div className="flex items-center gap-3">
                <input type="checkbox" id="notif" checked={newNotification} onChange={(e) => setNewNotification(e.target.checked)}
                  className="w-4 h-4" />
                <label htmlFor="notif" className="text-sm font-semibold text-[#1A1A1A]">Email Benachrichtigung</label>
              </div>

              {newNotification && (
                <input type="email" placeholder="E-Mail Adresse (optional)" value={newNotificationEmail}
                  onChange={(e) => setNewNotificationEmail(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#FFC300]" />
              )}
            </div>

            {/* Buttons */}
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setModalOpen(false); setEditingRuleId(null) }}
                className="flex-1 border border-gray-200 text-[#1A1A1A] font-semibold py-2 rounded-lg hover:bg-gray-50 transition-colors">
                Abbrechen
              </button>
              <button onClick={saveRule} disabled={saving}
                className="flex-1 bg-[#FFC300] hover:bg-[#e6b000] disabled:opacity-50 text-[#1A1A1A] font-semibold py-2 rounded-lg transition-colors">
                {saving ? 'Speichert…' : editingRuleId ? 'Speichern' : 'Regel erstellen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-sm">
            <h3 className="text-lg font-bold text-[#1A1A1A] mb-4">Regel löschen?</h3>
            <p className="text-gray-600 mb-6">Diese Aktion kann nicht rückgängig gemacht werden.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)}
                className="flex-1 border border-gray-200 text-[#1A1A1A] font-semibold py-2 rounded-lg hover:bg-gray-50">
                Abbrechen
              </button>
              <button onClick={() => { deleteRule(deleteId); setDeleteId(null) }}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-2 rounded-lg">
                Löschen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
