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
  placetel_sipuid: string | null
  show_test_data: boolean
}

interface SipUser {
  sipuid: string
  name: string | null
  online: boolean | null
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

  const [sipUsers, setSipUsers] = useState<SipUser[]>([])
  const [sipError, setSipError] = useState<string | null>(null)
  const [autoAssigning, setAutoAssigning] = useState(false)

  useEffect(() => {
    loadMembers()
    loadSipUsers()
  }, [])

  async function loadSipUsers() {
    try {
      const res = await fetch('/api/placetel/sip-users', { cache: 'no-store' })
      const data = await res.json()
      if (data.success) {
        setSipUsers(data.data)
        setSipError(null)
      } else {
        setSipError(data.error || 'Placetel-Nebenstellen nicht verfügbar')
      }
    } catch {
      setSipError('Placetel-Nebenstellen konnten nicht geladen werden')
    }
  }

  async function changeSipuid(member: TeamMember, sipuid: string) {
    try {
      const res = await fetch(`/api/team/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placetel_sipuid: sipuid }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Zuordnung fehlgeschlagen')
      setError(null)
      await loadMembers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Zuordnung fehlgeschlagen')
    }
  }

  /**
   * Ordnet Nebenstellen zu, deren Name exakt einem Mitarbeiter entspricht.
   * Bewusst nur bei eindeutiger Übereinstimmung — Geräte wie „Melih Mobil"
   * bleiben unzugeordnet und laufen über den Standard-Benutzer.
   */
  async function autoAssignSipUsers() {
    setAutoAssigning(true)
    setError(null)
    try {
      const normalize = (value: string) => value.trim().toLowerCase()
      let assigned = 0

      for (const member of members) {
        if (member.placetel_sipuid) continue
        const matches = sipUsers.filter(
          (sip) => sip.name && normalize(sip.name) === normalize(member.name)
        )
        if (matches.length !== 1) continue
        const alreadyTaken = members.some((m) => m.placetel_sipuid === matches[0].sipuid)
        if (alreadyTaken) continue

        const res = await fetch(`/api/team/${member.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ placetel_sipuid: matches[0].sipuid }),
        })
        if ((await res.json()).success) assigned++
      }

      await loadMembers()
      setError(assigned === 0 ? 'Keine eindeutige Namensübereinstimmung gefunden.' : null)
    } finally {
      setAutoAssigning(false)
    }
  }

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

  async function toggleTestDataVisibility(member: TeamMember) {
    try {
      const res = await fetch(`/api/team/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ show_test_data: !member.show_test_data }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Fehler')
      await loadMembers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Testdaten-Sichtbarkeit konnte nicht geändert werden')
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
      <div className="p-4 sm:p-6 lg:p-8 max-w-2xl text-center">
        <p className="text-gray-600">Diese Seite ist nur für Admins zugänglich.</p>
        <Link href="/einstellungen" className="text-yellow-600 hover:underline text-sm mt-2 inline-block">← Zurück zu Einstellungen</Link>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl">
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
            <div key={member.id} className="p-4">
              <div className="flex items-center justify-between gap-4">
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

              {/* Telefon-Nebenstelle: bestimmt, über welches Gerät dieser
                  Mitarbeiter telefoniert und wem ein Anruf zugeordnet wird. */}
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
                <span className="text-xs text-gray-500">☎️ Nebenstelle</span>
                {sipUsers.length > 0 ? (
                  <select
                    value={member.placetel_sipuid ?? ''}
                    onChange={(e) => changeSipuid(member, e.target.value)}
                    data-testid={`sip-select-${member.id}`}
                    className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400/40"
                  >
                    <option value="">— Standard-Nebenstelle —</option>
                    {sipUsers.map((sip) => (
                      <option key={sip.sipuid} value={sip.sipuid}>
                        {sip.name || sip.sipuid}
                        {sip.online === false ? ' (offline)' : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs text-gray-400">
                    {sipError ? 'nicht verfügbar' : 'lädt…'}
                  </span>
                )}
                {!member.placetel_sipuid && (
                  <span className="text-[11px] text-gray-400">
                    telefoniert über die gemeinsame Standard-Nebenstelle
                  </span>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
                <div>
                  <p className="text-xs font-semibold text-gray-700">Testdaten sehen</p>
                  <p className="text-[11px] text-gray-400">Markierte Testkontakte und zugehörige Aufgaben anzeigen</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={member.show_test_data}
                  onClick={() => toggleTestDataVisibility(member)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${member.show_test_data ? 'bg-yellow-400' : 'bg-gray-200'}`}
                  title={member.show_test_data ? 'Testdaten ausblenden' : 'Testdaten anzeigen'}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${member.show_test_data ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Hinweis + Sammelaktion für die Telefonie-Zuordnung */}
      {!loading && members.length > 0 && (
        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">Telefonie-Zuordnung</p>
              <p className="mt-0.5 text-xs text-gray-500">
                Jeder Mitarbeiter telefoniert über seine eigene Nebenstelle. Ohne Zuordnung läuft der
                Anruf über die gemeinsame Standard-Nebenstelle und lässt sich nicht eindeutig zuordnen.
              </p>
              {sipError && (
                <p className="mt-1.5 text-xs text-red-600">{sipError}</p>
              )}
            </div>
            <button
              onClick={autoAssignSipUsers}
              disabled={autoAssigning || sipUsers.length === 0}
              className="flex-shrink-0 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {autoAssigning ? 'Ordnet zu…' : 'Nach Namen zuordnen'}
            </button>
          </div>
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
