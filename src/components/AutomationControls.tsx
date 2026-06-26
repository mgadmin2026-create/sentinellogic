'use client'

import { useState, useEffect } from 'react'

interface AutomationControlsProps {
  contactId: string
  initialData: {
    automation_disabled: boolean
    dialfire_campaign_auto: boolean
    dialfire_campaign_id?: string
    dialfire_task_auto: boolean
    dialfire_task_name_field?: string
    klicktipp_tags_auto: boolean
    klicktipp_tags_field?: string[]
  }
  onUpdate?: (data: any) => void
}

interface IntegrationConfig {
  dialfire_campaigns?: Array<{ id: string; name: string; label: string }>
  dialfire_tasks?: Array<{ task_name: string; task_label: string; description: string }>
  klicktipp_tags?: Array<{ tag_id: number; tag_name: string; tag_label: string }>
}

export function AutomationControls({ contactId, initialData, onUpdate }: AutomationControlsProps) {
  const [data, setData] = useState(initialData)
  const [config, setConfig] = useState<IntegrationConfig>({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  // Load integration config
  useEffect(() => {
    fetch('/api/config?key=system_config')
      .then(r => r.json())
      .then(res => {
        if (res.success) setConfig(res.data)
      })
      .catch(console.error)
  }, [])

  const handleUpdate = async (updates: Partial<typeof data>) => {
    setSaving(true)
    setMessage('')

    try {
      const response = await fetch(`/api/kontakte/${contactId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      const result = await response.json()
      if (result.success) {
        setData(prev => ({ ...prev, ...updates }))
        setMessage('✅ Automation-Einstellungen gespeichert')
        if (onUpdate) onUpdate({ ...data, ...updates })
        setTimeout(() => setMessage(''), 3000)
      } else {
        setMessage(`❌ Fehler: ${result.error}`)
      }
    } catch (error) {
      setMessage(`❌ Fehler: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4">Automation & Integration</h3>
        <p className="text-sm text-gray-500 mb-6">
          Steuere wie dieser Kontakt automatisiert wird. Automatische Felder werden von Regeln gesetzt, manuelle können überschrieben werden.
        </p>
      </div>

      {/* Automation Toggle */}
      <div className="border-t pt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h4 className="font-semibold text-[#1A1A1A] text-sm">Automation deaktivieren</h4>
            <p className="text-xs text-gray-500 mt-1">Wenn aktiviert: keine Syncs zu KlickTipp/Dialfire, keine Regeln-Ausführung</p>
          </div>
          <button
            onClick={() => handleUpdate({ automation_disabled: !data.automation_disabled })}
            disabled={saving}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              data.automation_disabled ? 'bg-red-500' : 'bg-gray-200'
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                data.automation_disabled ? 'translate-x-5.5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Dialfire Campaign */}
      <div className="border-t pt-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-[#1A1A1A] text-sm">Dialfire Kampagne</h4>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Auto</span>
              <button
                onClick={() => handleUpdate({ dialfire_campaign_auto: !data.dialfire_campaign_auto })}
                disabled={saving || data.automation_disabled}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  data.dialfire_campaign_auto ? 'bg-emerald-500' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    data.dialfire_campaign_auto ? 'translate-x-4.5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </div>

          {data.dialfire_campaign_auto ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700">
              {data.dialfire_campaign_id
                ? `✓ Wird per Regel gesetzt: ${data.dialfire_campaign_id}`
                : '○ Wird per Regel gesetzt (keine Regel aktiv)'}
            </div>
          ) : (
            <select
              value={data.dialfire_campaign_id || ''}
              onChange={(e) => handleUpdate({ dialfire_campaign_id: e.target.value || undefined })}
              disabled={saving || data.automation_disabled}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FFC300]"
            >
              <option value="">-- Keine Kampagne --</option>
              {config.dialfire_campaigns?.map((camp) => (
                <option key={camp.id} value={camp.id}>
                  {camp.label}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Dialfire Task */}
      <div className="border-t pt-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-[#1A1A1A] text-sm">Dialfire Task</h4>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Auto</span>
              <button
                onClick={() => handleUpdate({ dialfire_task_auto: !data.dialfire_task_auto })}
                disabled={saving || data.automation_disabled}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  data.dialfire_task_auto ? 'bg-emerald-500' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    data.dialfire_task_auto ? 'translate-x-4.5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </div>

          {data.dialfire_task_auto ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700">
              {data.dialfire_task_name_field
                ? `✓ Wird per Regel gesetzt: ${data.dialfire_task_name_field}`
                : '○ Wird per Regel gesetzt (keine Regel aktiv)'}
            </div>
          ) : (
            <select
              value={data.dialfire_task_name_field || ''}
              onChange={(e) => handleUpdate({ dialfire_task_name_field: e.target.value || undefined })}
              disabled={saving || data.automation_disabled}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FFC300]"
            >
              <option value="">-- Keine Task --</option>
              {config.dialfire_tasks?.map((task) => (
                <option key={task.task_name} value={task.task_name}>
                  {task.task_label}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* KlickTipp Tags */}
      <div className="border-t pt-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-[#1A1A1A] text-sm">KlickTipp Tags</h4>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Auto</span>
              <button
                onClick={() => handleUpdate({ klicktipp_tags_auto: !data.klicktipp_tags_auto })}
                disabled={saving || data.automation_disabled}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  data.klicktipp_tags_auto ? 'bg-emerald-500' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    data.klicktipp_tags_auto ? 'translate-x-4.5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </div>

          {data.klicktipp_tags_auto ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700">
              {data.klicktipp_tags_field && data.klicktipp_tags_field.length > 0
                ? `✓ Wird per Regel gesetzt: ${data.klicktipp_tags_field.join(', ')}`
                : '○ Wird per Regel gesetzt (keine Regel aktiv)'}
            </div>
          ) : (
            <select
              multiple
              value={data.klicktipp_tags_field || []}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions, (opt) => opt.value)
                handleUpdate({ klicktipp_tags_field: selected.length > 0 ? selected : undefined })
              }}
              disabled={saving || data.automation_disabled}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FFC300]"
              size={4}
            >
              {config.klicktipp_tags?.map((tag) => (
                <option key={tag.tag_id} value={tag.tag_name}>
                  {tag.tag_label}
                </option>
              ))}
            </select>
          )}
          {!data.klicktipp_tags_auto && (
            <p className="text-xs text-gray-400">💡 Halten Sie Ctrl/Cmd gedrückt um mehrere Tags auszuwählen</p>
          )}
        </div>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`p-3 rounded-lg text-sm ${
            message.startsWith('✅')
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message}
        </div>
      )}
    </div>
  )
}
