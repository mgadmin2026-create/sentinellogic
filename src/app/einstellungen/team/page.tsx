'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface TeamMember {
  id: string
  email: string
  name: string
  role: string
  active: boolean
  created_at: string
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  mitarbeiter: 'Mitarbeiter',
}

function generateTempPassword(): string {
  // Ausreichend zufällig für ein Temp-Passwort, das der Mitarbeiter beim
  // ersten Login selbst ändert — keine hohen Anforderungen an Merkbarkeit nötig.
  return Math.random().toString(36).slice(-6) + Math.random().toString(36).slice(-6).toUpperCase()
}

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [forbidden, setForbidden] = useState(false)

  const [addModalOpen, setAddModalOpen] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', email: '', role: 'mitarbeiter', password: generateTempPassword() })
  const [adding, setAdding] = useState(false)
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null)

  const [resetPasswordFor, setResetPasswordFor] = useState<TeamMember | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    loadMembers()
  }, [])

  async function loadMembers() {
    try {
      setLoading(true)
      const res = await fetch('/api/team')
      if (res.status === 403) {
        setForbidden(true)
        return
      }
      const data = await res.json()
      if (data.success) setMembers(data.data)
    } catch (err) {
      setError('Team konnte nicht geladen werden')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    setError(null)
    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Fehler beim Anlegen')
      setCreatedCredentials({ email: addForm.email, password: addForm.password })
      setAddForm({ name: '', email: '', role: 'mitarbeiter', password: generateTempPassword() })
      await loadMembers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Anlegen')
    } finally {
      setAdding(false)
    }
  }

  async function toggleActive(member: TeamMember) {
    try {
      const res = await fetch(`/api/team/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !member.active }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Fehler')
      await loadMembers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Ändern')
    }
  }

  async function changeRole(member: TeamMember, role: string) {
    try {
      const res = await fetch(`/api/team/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Fehler')
      await loadMembers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Ändern')
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!resetPasswordFor) return
    setResetting(true)
    try {
      const res = await fetch(`/api/team/${resetPasswordFor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: resetPassword }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Fehler')
      setResetPasswordFor(null)
      setResetPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Zurücksetzen')
    } finally {
      setResetting(false)
    }
  }

  async function handleDelete(member: TeamMember) {
    if (!confirm(`Konto von ${member.name} wirklich entfernen? Das kann nicht rückgängig gemacht werden.`)) return
    try {
      const res = await fetch(`/api/team/${member.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Fehler')
      await loadMembers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Löschen')
    }
  }

  if (forbidden) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-600">Diese Seite ist nur für Admins zugänglich.</p>
        <Link href="/einstellungen" className="text-yellow-600 hover:underline text-sm mt-2 inline-block">← Zurück zu Einstellungen</Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/einstellungen" className="text-sm text-gray-500 hover:text-gray-900">← Einstellungen</Link>
      <div className="flex items-center justify-between mt-2 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team</h1>
          <p className="text-gray-600 text-sm mt-0.5">Mitarbeiter-Konten verwalten</p>
        </div>
        <button
          onClick={() => setAddModalOpen(true)}
          className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors"
        >
          + Mitarbeiter hinzufügen
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm py-8 text-center">Lädt…</p>
      ) : members.length === 0 ? (
        <p className="text-gray-500 text-sm py-8 text-center">Noch keine Mitarbeiter angelegt.</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {members.map((member) => (
            <div key={member.id} className="p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium text-gray-900 truncate">
                  {member.name}
                  {!member.active && (
                    <span className="ml-2 inline-flex rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-600">
                      Deaktiviert
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500 truncate">{member.email}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <select
                  value={member.role}
                  onChange={(e) => changeRole(member, e.target.value)}
                  className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400/40"
                >
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <button
                  onClick={() => setResetPasswordFor(member)}
                  title="Passwort zurücksetzen"
                  className="px-2 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  🔑
                </button>
                <button
                  onClick={() => toggleActive(member)}
                  title={member.active ? 'Deaktivieren' : 'Aktivieren'}
                  className="px-2 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  {member.active ? '⏸️' : '▶️'}
                </button>
                <button
                  onClick={() => handleDelete(member)}
                  title="Löschen"
                  className="px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mitarbeiter hinzufügen */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            {createdCredentials ? (
              <div className="p-6 text-center space-y-4">
                <div className="text-4xl">✅</div>
                <h3 className="text-lg font-bold text-gray-900">Konto angelegt</h3>
                <p className="text-sm text-gray-600">
                  Gib diese Zugangsdaten an {createdCredentials.email} weiter — das Passwort wird nur jetzt einmal angezeigt.
                </p>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-left space-y-2">
                  <div>
                    <p className="text-xs text-gray-500">E-Mail</p>
                    <p className="text-sm font-mono text-gray-900">{createdCredentials.email}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Temporäres Passwort</p>
                    <p className="text-sm font-mono text-gray-900">{createdCredentials.password}</p>
                  </div>
                </div>
                <button
                  onClick={() => { setCreatedCredentials(null); setAddModalOpen(false) }}
                  className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors"
                >
                  Fertig
                </button>
              </div>
            ) : (
              <form onSubmit={handleAdd} className="p-6 space-y-4">
                <h3 className="text-lg font-bold text-gray-900">Mitarbeiter hinzufügen</h3>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Name</label>
                  <input
                    type="text"
                    required
                    value={addForm.name}
                    onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">E-Mail</label>
                  <input
                    type="email"
                    required
                    value={addForm.email}
                    onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Rolle</label>
                  <select
                    value={addForm.role}
                    onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 text-sm"
                  >
                    {Object.entries(ROLE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Temporäres Passwort</label>
                  <input
                    type="text"
                    required
                    minLength={8}
                    value={addForm.password}
                    onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 text-sm font-mono"
                  />
                  <p className="text-xs text-gray-500 mt-1">Automatisch generiert, kann angepasst werden. Wird nach dem Anlegen einmalig angezeigt.</p>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setAddModalOpen(false)}
                    disabled={adding}
                    className="flex-1 border border-gray-200 text-gray-600 font-medium text-sm px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    disabled={adding}
                    className="flex-1 bg-yellow-400 hover:bg-yellow-500 disabled:opacity-50 text-gray-900 font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors"
                  >
                    {adding ? 'Anlegen…' : 'Anlegen'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Passwort zurücksetzen */}
      {resetPasswordFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Passwort zurücksetzen</h3>
            <p className="text-sm text-gray-600 mb-4">Für {resetPasswordFor.name} ({resetPasswordFor.email})</p>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <input
                type="text"
                required
                minLength={8}
                placeholder="Neues Passwort"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 text-sm font-mono"
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setResetPasswordFor(null); setResetPassword('') }}
                  disabled={resetting}
                  className="flex-1 border border-gray-200 text-gray-600 font-medium text-sm px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={resetting}
                  className="flex-1 bg-yellow-400 hover:bg-yellow-500 disabled:opacity-50 text-gray-900 font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors"
                >
                  {resetting ? 'Speichert…' : 'Passwort setzen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
