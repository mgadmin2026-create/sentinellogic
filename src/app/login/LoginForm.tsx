'use client'
import { useFormState, useFormStatus } from 'react-dom'
import { login } from './actions'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-yellow-400 hover:bg-yellow-500 disabled:opacity-50 text-gray-900 font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors"
    >
      {pending ? 'Anmelden…' : 'Anmelden'}
    </button>
  )
}

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useFormState(login, {})

  return (
    <form action={formAction} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
      <input type="hidden" name="next" value={next} />
      {state?.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
          {state.error}
        </div>
      )}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1.5">E-Mail</label>
        <input
          type="email"
          name="email"
          required
          autoComplete="username"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Passwort</label>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400/40 text-sm"
        />
      </div>
      <SubmitButton />
    </form>
  )
}
