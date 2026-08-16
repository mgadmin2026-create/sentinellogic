'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ReleaseNote } from '@/data/release-notes'

interface Props {
  release: ReleaseNote
  onDismiss: () => void
  onViewFull?: () => void
}

export function ReleaseNotificationBanner({ release, onDismiss, onViewFull }: Props) {
  const [isClosing, setIsClosing] = useState(false)

  const handleDismiss = () => {
    setIsClosing(true)
    setTimeout(() => {
      onDismiss()
    }, 200)
  }

  return (
    <div
      className={`bg-gradient-to-r from-brand to-yellow-300 text-gray-900 px-6 py-4 flex items-center justify-between shadow-lg transition-all duration-200 ${
        isClosing ? 'opacity-0 -translate-y-2' : 'opacity-100 translate-y-0'
      }`}
    >
      <div className="flex items-center gap-4 flex-1">
        <div className="text-2xl">🎉</div>
        <div className="flex-1">
          <p className="font-semibold text-sm">{release.title}</p>
          <p className="text-xs text-gray-800 mt-0.5">{release.summary}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 ml-4 flex-shrink-0">
        <Link
          href="/release-notes"
          className="text-xs font-semibold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors"
        >
          Details →
        </Link>
        <button
          onClick={handleDismiss}
          className="text-gray-900 hover:text-gray-700 text-lg font-bold transition-colors"
          title="Schließen"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
