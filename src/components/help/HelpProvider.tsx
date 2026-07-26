'use client'
// Globaler Kontext für das Hilfe-System: hält den aktuell offenen Artikel, rendert den
// gemeinsamen Hilfe-Drawer und registriert den "?"-Tastatur-Shortcut (Seiten-Standardhilfe).
// Erster React-Context der App — siehe src/app/layout.tsx für die Einbindung.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Drawer } from '@/components/kontakt/Drawer'
import { HelpArticleBody } from '@/components/help/HelpArticleBody'
import { HELP_ARTICLES_BY_ID, resolvePageDefaultArticle } from '@/data/help'
import type { HelpArticle } from '@/types/help'

interface HelpContextValue {
  openArticle: (articleId: string) => void
  openPageDefault: () => void
  closeHelp: () => void
  isOpen: boolean
  activeArticle: HelpArticle | null
}

const HelpContext = createContext<HelpContextValue | null>(null)

export function useHelp(): HelpContextValue {
  const ctx = useContext(HelpContext)
  if (!ctx) throw new Error('useHelp() muss innerhalb von <HelpProvider> aufgerufen werden')
  return ctx
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

export function HelpProvider({ children }: { children: ReactNode }) {
  const [activeArticleId, setActiveArticleId] = useState<string | null>(null)
  const pathname = usePathname()

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== '?') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (isEditableTarget(e.target) || isEditableTarget(document.activeElement)) return
      // Ein anderer Drawer/Modal ist bereits offen (setzt exakt dieses Flag) — kein zweites Overlay stapeln.
      if (document.body.style.overflow === 'hidden') return

      e.preventDefault()
      const fallback = resolvePageDefaultArticle(pathname)
      if (fallback) setActiveArticleId(fallback.id)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [pathname])

  const activeArticle = activeArticleId ? HELP_ARTICLES_BY_ID[activeArticleId] ?? null : null

  const value: HelpContextValue = {
    openArticle: setActiveArticleId,
    openPageDefault: () => {
      const fallback = resolvePageDefaultArticle(pathname)
      if (fallback) setActiveArticleId(fallback.id)
    },
    closeHelp: () => setActiveArticleId(null),
    isOpen: !!activeArticle,
    activeArticle,
  }

  return (
    <HelpContext.Provider value={value}>
      {children}
      <Drawer
        isOpen={!!activeArticle}
        title={activeArticle ? `❓ ${activeArticle.title}` : 'Hilfe'}
        onClose={() => setActiveArticleId(null)}
        widthClass="max-w-md"
        footer={
          activeArticle && (
            <Link
              href={`/hilfe#${activeArticle.id}`}
              onClick={() => setActiveArticleId(null)}
              className="text-xs font-semibold text-yellow-600 hover:text-yellow-700"
            >
              Vollständige Hilfe öffnen →
            </Link>
          )
        }
      >
        {activeArticle && <HelpArticleBody article={activeArticle} />}
      </Drawer>
    </HelpContext.Provider>
  )
}
