'use client'
// Vollständiges durchsuchbares Hilfe-Handbuch — gruppiert nach Bereich (Sidebar-Reihenfolge).
// Erreichbar über den Sidebar-Nav-Eintrag, das Hilfe-Symbol im Footer, die Taste "?" (Seiten-
// Standardhilfe) und "Vollständige Hilfe öffnen →" aus jedem Kachel-Hilfe-Drawer heraus.
import { useEffect, useState } from 'react'
import { HELP_ARTICLES_BY_AREA } from '@/data/help'
import { HELP_AREA_LABELS, HELP_AREA_ORDER, type HelpArticle } from '@/types/help'
import { HelpArticleBody } from '@/components/help/HelpArticleBody'

export default function HilfePage() {
  const [query, setQuery] = useState('')

  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (!hash) return
    const el = document.getElementById(hash)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    el.classList.add('ring-2', 'ring-yellow-400')
    const timeout = setTimeout(() => el.classList.remove('ring-2', 'ring-yellow-400'), 2000)
    return () => clearTimeout(timeout)
  }, [])

  const normalizedQuery = query.trim().toLowerCase()

  function matches(article: HelpArticle): boolean {
    if (!normalizedQuery) return true
    const haystack = [article.title, article.body, ...(article.keywords ?? [])].join(' ').toLowerCase()
    return haystack.includes(normalizedQuery)
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Hilfe</h1>
        <p className="text-sm text-gray-500 mb-6">
          Anleitung für Sentimental Logic — durchsuchbar, oder direkt über das ❓-Symbol neben jeder
          Kachel bzw. die Taste <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs">?</kbd> aufrufbar.
        </p>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Hilfe durchsuchen…"
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/40 text-sm mb-8"
        />

        <div className="space-y-10">
          {HELP_AREA_ORDER.map((area) => {
            const articles = (HELP_ARTICLES_BY_AREA[area] ?? []).filter(matches)
            if (articles.length === 0) return null

            return (
              <div key={area}>
                <h2 className="text-lg font-bold text-gray-900 mb-3 pb-2 border-b border-gray-200">
                  {HELP_AREA_LABELS[area]}
                </h2>
                <div className="space-y-6">
                  {articles.map((article) => (
                    <div
                      key={article.id}
                      id={article.id}
                      className="bg-white rounded-xl border border-gray-200 p-4 scroll-mt-4 transition-shadow"
                    >
                      <h3 className="text-sm font-semibold text-gray-900 mb-2">{article.title}</h3>
                      <HelpArticleBody article={article} />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {normalizedQuery &&
            HELP_AREA_ORDER.every((area) => (HELP_ARTICLES_BY_AREA[area] ?? []).every((a) => !matches(a))) && (
              <p className="text-sm text-gray-400 text-center py-12">Keine Treffer für „{query}".</p>
            )}
        </div>
      </div>
    </div>
  )
}
