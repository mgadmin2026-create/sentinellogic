'use client'
// Kachel-genauer Hilfe-Auslöser: kleines "?"-Icon neben einer Kachel-Überschrift.
// Unbekannte articleId bricht die Seite nicht — Hilfe ist unterstützend, nicht kritisch.
import { useHelp } from '@/components/help/HelpProvider'
import { HELP_ARTICLES_BY_ID } from '@/data/help'

interface HelpButtonProps {
  articleId: string
  className?: string
}

export function HelpButton({ articleId, className }: HelpButtonProps) {
  const { openArticle } = useHelp()
  const article = HELP_ARTICLES_BY_ID[articleId]

  if (!article && process.env.NODE_ENV !== 'production') {
    console.warn(`HelpButton: unbekannte articleId "${articleId}"`)
  }

  return (
    <button
      type="button"
      onClick={() => openArticle(articleId)}
      aria-label={`Hilfe: ${article?.title ?? articleId}`}
      title="Hilfe anzeigen"
      className={className ?? 'text-gray-300 hover:text-yellow-600 transition-colors flex-shrink-0'}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 015.83 1c0 2-3 2-3 4" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    </button>
  )
}
