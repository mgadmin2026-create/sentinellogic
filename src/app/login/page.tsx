import { LoginForm } from './LoginForm'

export default function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2">
            <span className="w-9 h-9 rounded-lg bg-yellow-400 flex items-center justify-center font-bold text-gray-900">SL</span>
            <span className="font-bold text-lg text-gray-900">Sentimental Logic</span>
          </div>
        </div>
        <LoginForm next={searchParams.next || '/dashboard'} />
      </div>
    </div>
  )
}
