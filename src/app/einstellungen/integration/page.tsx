'use client'

import { useState, useEffect } from 'react'

interface IntegrationConfig {
  dialfire_campaigns?: Array<{ id: string; name: string; label: string }>
  dialfire_tasks?: Array<{ task_name: string; task_label: string; description: string }>
  klicktipp_tags?: Array<{ tag_id: number; tag_name: string; tag_label: string }>
}

export default function IntegrationSetupPage() {
  const [config, setConfig] = useState<IntegrationConfig>({})
  const [campaignsText, setCampaignsText] = useState('')
  const [tasksText, setTasksText] = useState('')
  const [tagsText, setTagsText] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  // Load current config
  useEffect(() => {
    fetch('/api/config?key=system_config')
      .then(r => r.json())
      .then(data => {
        if (data.success && data.data) {
          const sysConfig = data.data
          setConfig(sysConfig)

          // Format for textareas
          if (sysConfig.dialfire_campaigns) {
            setCampaignsText(
              sysConfig.dialfire_campaigns
                .map((c: any) => `${c.id} | ${c.name}`)
                .join('\n')
            )
          }
          if (sysConfig.dialfire_tasks) {
            setTasksText(
              sysConfig.dialfire_tasks
                .map((t: any) => `${t.task_name} | ${t.task_label} | ${t.description}`)
                .join('\n')
            )
          }
          if (sysConfig.klicktipp_tags) {
            setTagsText(
              sysConfig.klicktipp_tags
                .map((t: any) => `${t.tag_id} | ${t.tag_name}`)
                .join('\n')
            )
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setMessage('')

    try {
      // Parse inputs
      const campaigns = campaignsText
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [id, name] = line.split('|').map(s => s.trim())
          return { id, name, label: `${name} (ID: ${id})` }
        })

      const tasks = tasksText
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [task_name, task_label, description] = line.split('|').map(s => s.trim())
          return { task_name, task_label, description }
        })

      const tags = tagsText
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [tag_id, tag_name] = line.split('|').map(s => s.trim())
          return { tag_id: parseInt(tag_id), tag_name, tag_label: `${tag_name} (ID: ${tag_id})` }
        })

      // Update system_config
      const response = await fetch('/api/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'system_config',
          value: {
            dialfire_campaigns: campaigns,
            dialfire_tasks: tasks,
            klicktipp_tags: tags,
          },
        }),
      })

      const data = await response.json()
      if (data.success) {
        setMessage('✅ Einstellungen gespeichert')
      } else {
        setMessage(`❌ Fehler: ${data.error}`)
      }
    } catch (error) {
      setMessage(`❌ Fehler: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-8 text-center">Lädt...</div>
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#1A1A1A] mb-2">Integration Setup</h1>
          <p className="text-gray-500">
            Konfiguriere verfügbare Werte für Dialfire Kampagnen, Tasks und KlickTipp Tags
          </p>
        </div>

        <div className="space-y-8">
          {/* Dialfire Campaigns */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-xl font-semibold text-[#1A1A1A] mb-3">Dialfire Kampagnen</h2>
            <p className="text-sm text-gray-500 mb-4">
              Format: ID | Name (eine pro Zeile)
              <br />
              Beispiel: GENS85UE5SU4SSC7 | Kampagne XY
            </p>
            <textarea
              value={campaignsText}
              onChange={(e) => setCampaignsText(e.target.value)}
              className="w-full h-32 p-3 border border-gray-200 rounded-lg font-mono text-sm focus:outline-none focus:border-[#FFC300]"
              placeholder="ID | Name"
            />
          </div>

          {/* Dialfire Tasks */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-xl font-semibold text-[#1A1A1A] mb-3">Dialfire Tasks</h2>
            <p className="text-sm text-gray-500 mb-4">
              Format: task_name | Label | Description (eine pro Zeile)
              <br />
              Beispiel: call | Anruf | Standard Anruf
            </p>
            <textarea
              value={tasksText}
              onChange={(e) => setTasksText(e.target.value)}
              className="w-full h-32 p-3 border border-gray-200 rounded-lg font-mono text-sm focus:outline-none focus:border-[#FFC300]"
              placeholder="task_name | Label | Description"
            />
          </div>

          {/* KlickTipp Tags */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-xl font-semibold text-[#1A1A1A] mb-3">KlickTipp Tags</h2>
            <p className="text-sm text-gray-500 mb-4">
              Format: Tag_ID | Tag_Name (eine pro Zeile)
              <br />
              Beispiel: 123 | Lead
            </p>
            <textarea
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              className="w-full h-32 p-3 border border-gray-200 rounded-lg font-mono text-sm focus:outline-none focus:border-[#FFC300]"
              placeholder="Tag_ID | Tag_Name"
            />
          </div>

          {/* Message */}
          {message && (
            <div className={`p-4 rounded-lg ${
              message.startsWith('✅')
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {message}
            </div>
          )}

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-[#FFC300] hover:bg-[#e6b000] disabled:opacity-50 text-[#1A1A1A] font-semibold py-3 rounded-lg transition-colors"
          >
            {saving ? 'Speichert...' : 'Einstellungen speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}
