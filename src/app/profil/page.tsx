'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  mitarbeiter: 'Mitarbeiter',
}

interface CurrentUser {
  id: string
  email: string
  name: string
  role: string
  active: boolean
}

export default function ProfilPage() {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    loadUser()
  }, [])

  async function loadUser() {
    try {
      const res = await fetch('/api/me')
      const data = await res.json()
      if (data.success) {
        setUser(data.data)
        setName(data.data.name)
        setEmail(data.data.email)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSavingProfile(true)
    setProfileMessage(null)
    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Fehler beim Speichern')
      const emailChanged = user && email !== user.email
      setProfileMessage({
        type: 'success',
        text: emailChanged
          ? 'Gespeichert. Zur Bestätigung der neuen E-Mail-Adresse wurde ein Link an die neue Adresse gesendet.'
          : 'Gespeichert.',
      })
      await loadUser()
    } catch (err) {
      setProfileMessage({ type: 'error', text: err instanceof Error ? err.message : 'Fehler beim Speichern' })
    } finally {
      setSavingProfile(false)
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setSavingPassword(true)
    setPasswordMessage(null)
    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Fehler beim Ändern')
      setPasswordMessage({ type: 'success', text: 'Passwort geändert.' })
      setCurrentPassword('')
      setNewPassword('')
    } catch (err) {
      setPasswordMessage({ type: 'error', text: err instanceof Error ? err.message : 'Fehler beim Ändern' })
    } finally {
      setSavingPassword(false)
    }
  }

  if (loading) {
    return <p className="text-gray-500 text-sm py-8 text-center">Lädt…</p>
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-600">Nicht angemeldet.</p>
        <Link href="/login" className="text-yellow-600 hover:underline text-sm mt-2 inline-block">Zum Login</Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mein Profil</h1>
        <p className="text-gray-600 text-sm mt-0.5">Persönliche Daten und Passwort verwalten</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Name</label>
            <input
              type="text"
              name="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">E-Mail</label>
            <input
              type="email"
              name="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">Bei Änderung ist eine Bestätigung über einen Link an die neue Adresse nötig.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-yellow-50 text-yellow-700 px-3 py-1 text-xs font-medium">
              Rolle: {ROLE_LABELS[user.role] ?? user.role}
            </span>
          </div>

          {profileMessage && (
            <div className={`text-sm px-3 py-2 rounded-lg border ${
              profileMessage.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-700'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}>
              {profileMessage.text}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingProfile}
              className="bg-yellow-400 hover:bg-yellow-500 disabled:opacity-50 text-gray-900 font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors"
            >
              {savingProfile ? 'Speichert…' : 'Speichern'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Passwort ändern</h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Aktuelles Passwort</label>
            <input
              type="password"
              name="currentPassword"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Neues Passwort</label>
            <input
              type="password"
              name="newPassword"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">Mindestens 8 Zeichen. Ein Admin kann dein Passwort alternativ über die Team-Verwaltung zurücksetzen.</p>
          </div>

          {passwordMessage && (
            <div className={`text-sm px-3 py-2 rounded-lg border ${
              passwordMessage.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-700'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}>
              {passwordMessage.text}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingPassword}
              className="bg-yellow-400 hover:bg-yellow-500 disabled:opacity-50 text-gray-900 font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors"
            >
              {savingPassword ? 'Ändert…' : 'Passwort ändern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
