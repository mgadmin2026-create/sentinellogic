'use client'
// Sidebar-Navigation — Desktop: statisch links. Mobile: Drawer mit Hamburger.
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { logout } from '@/app/login/actions'
import type { CurrentUser } from '@/lib/auth'
import { isAdmin } from '@/lib/roles'
import { useHelp } from '@/components/help/HelpProvider'

const MENTIONS_ICON = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
  </svg>
)

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  /** Nur für Admins sichtbar (z.B. Testdashboard, Einstellungen) */
  adminOnly?: boolean
  /** Weitere Routen, die denselben Sidebar-Eintrag aktiv markieren (z.B. /sync
   *  gehört zur Automatisierungen-Gruppe, hat aber weiterhin eine eigene Route). */
  alsoActiveFor?: string[]
}

const NAV_ITEMS: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    href: '/kontakte',
    label: 'Kontakte',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    href: '/angebote',
    label: 'Angebote',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="4" height="16" />
        <rect x="10" y="8" width="4" height="12" />
        <rect x="17" y="12" width="4" height="8" />
      </svg>
    ),
  },
  {
    href: '/aufgaben',
    label: 'Aufgaben',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    href: '/kalender',
    label: 'Kalender',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    href: '/kommunikation',
    label: 'Kommunikation',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a4 4 0 01-4 4H8l-5 3v-7a4 4 0 01-1-2.7V7a4 4 0 014-4h11a4 4 0 014 4z" />
        <path d="M7 8h10M7 12h7" />
      </svg>
    ),
  },
  {
    href: '/postfach',
    label: 'E-Mail',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" />
        <polyline points="22 6 12 13 2 6" />
      </svg>
    ),
  },
  {
    href: '/dokumente',
    label: 'Dokumente',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    ),
  },
  {
    href: '/ki-upload',
    label: 'KI Upload',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a7 7 0 0 1 7 7c0 2.4-1.2 4.5-3 5.7V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.3C6.2 13.5 5 11.4 5 9a7 7 0 0 1 7-7z" />
        <line x1="9" y1="22" x2="15" y2="22" />
      </svg>
    ),
  },
  {
    href: '/regeln',
    label: 'Automatisierungen',
    alsoActiveFor: ['/sync'],
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
  },
  {
    href: '/reporting',
    label: 'Selektion',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    href: '/testdashboard',
    label: 'Testdashboard',
    adminOnly: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12a9 9 0 1 1-5.3-8.2" />
      </svg>
    ),
  },
  {
    href: '/hilfe',
    label: 'Hilfe',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 015.83 1c0 2-3 2-3 4" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  {
    href: '/einstellungen',
    label: 'Einstellungen',
    adminOnly: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m6.08 0l4.24-4.24M1 12h6m6 0h6m-1.78 7.78l-4.24-4.24m-6.08 0l-4.24 4.24" />
      </svg>
    ),
  },
]

interface SidebarProps {
  currentUser: CurrentUser | null
}

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed'

export default function Sidebar({ currentUser }: SidebarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [unreadMentions, setUnreadMentions] = useState(0)
  // Default ausgeklappt (Nutzer-Entscheidung, docs/UI_UX_KONZEPT.md) — erst nach dem Mount aus
  // localStorage übernehmen, damit Server-/Client-Render beim ersten Paint identisch sind.
  const [collapsed, setCollapsed] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const { openPageDefault } = useHelp()

  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
    if (stored === 'true') setCollapsed(true)
  }, [])

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next))
      return next
    })
  }

  useEffect(() => {
    if (!currentUser) return
    let cancelled = false
    async function loadUnreadCount() {
      try {
        const res = await fetch('/api/mentions?unread=true')
        const json = await res.json()
        if (!cancelled && json.success) setUnreadMentions(json.unreadCount ?? 0)
      } catch (err) {
        console.error('Fehler beim Laden der Erwähnungen:', err)
      }
    }
    loadUnreadCount()
    const interval = setInterval(loadUnreadCount, 60000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, pathname])

  const matchesRoute = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href))

  const isActive = (item: NavItem) =>
    matchesRoute(item.href) || (item.alsoActiveFor ?? []).some((href) => matchesRoute(href))

  // Auf der Kontaktdetailseite führt auch der dauerhaft sichtbare Menüpunkt
  // „Kontakte“ zurück in die zuvor verwendete Listenansicht. Ohne diese
  // Sonderbehandlung würde er immer /kontakte und damit „Alle Kontakte“ öffnen.
  const navHref = (item: NavItem): string => {
    if (item.href !== '/kontakte' || !/^\/kontakte\/[^/]+$/.test(pathname)) return item.href
    const requestedReturnTo = searchParams.get('returnTo')
    if (requestedReturnTo === '/kontakte' || requestedReturnTo?.startsWith('/kontakte?')) {
      return requestedReturnTo
    }
    return item.href
  }

  // Drawer bei Navigation schließen
  useEffect(() => {
    setOpen(false)
    setProfileMenuOpen(false)
  }, [pathname])

  // Profil-Menü bei Klick außerhalb schließen
  useEffect(() => {
    if (!profileMenuOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [profileMenuOpen])

  // Auf der Login-Seite und der öffentlichen Datenschutzerklärung gibt es
  // keine Navigation — Seite füllt den ganzen Viewport
  if (pathname === '/login' || pathname === '/datenschutz') return null

  return (
    <>
      {/* Mobile Top-Bar (nur < md) */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 h-14 bg-brand-dark flex items-center gap-3 px-4">
        <button
          onClick={() => setOpen(true)}
          aria-label="Menü öffnen"
          className="text-white/80 hover:text-white -ml-1 p-2 rounded-lg hover:bg-white/10"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div className="w-6 h-6 rounded bg-brand flex items-center justify-center flex-shrink-0">
          <span className="text-gray-900 font-bold text-[11px]">SL</span>
        </div>
        <span className="text-white font-semibold text-sm">Sentimental Logic</span>
      </div>

      {/* Scrim (nur < md, wenn offen) */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-brand-dark flex flex-col h-screen
          transform transition-transform duration-200 ease-out
          ${open ? 'translate-x-0' : '-translate-x-full'}
          md:static md:translate-x-0 md:flex-shrink-0 md:z-auto md:sticky md:top-0
          md:transition-[width] md:duration-200 md:ease-out
          ${collapsed ? 'md:w-16' : 'md:w-56'}
        `}
      >
        {/* Logo + Schließen (mobil) / Einklappen-Toggle (Desktop) */}
        <div className={`py-6 border-b border-white/10 flex items-center ${collapsed ? 'md:justify-center md:px-2' : 'px-5 justify-between'}`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded bg-brand flex items-center justify-center flex-shrink-0">
              <span className="text-gray-900 font-bold text-xs">SL</span>
            </div>
            <span className={`text-white font-semibold text-sm leading-tight ${collapsed ? 'md:hidden' : ''}`}>
              Sentimental<br />Logic
            </span>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Menü schließen"
            className="md:hidden text-white/60 hover:text-white p-1"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Einklappen/Ausklappen-Toggle (nur Desktop) */}
        <button
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Sidebar ausklappen' : 'Sidebar einklappen'}
          title={collapsed ? 'Sidebar ausklappen' : 'Sidebar einklappen'}
          className={`hidden md:flex items-center gap-2 px-3 py-2 mx-3 mt-3 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-colors ${collapsed ? 'justify-center' : ''}`}
        >
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={`transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`}
          >
            <polyline points="11 17 6 12 11 7" />
            <polyline points="18 17 13 12 18 7" />
          </svg>
          {!collapsed && <span className="text-xs font-medium">Einklappen</span>}
        </button>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin(currentUser?.role)).map((item) => {
          const active = isActive(item)
          return (
            <Link
              key={item.href}
              href={navHref(item)}
              title={collapsed ? item.label : undefined}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                ${collapsed ? 'md:justify-center' : ''}
                ${active
                  ? 'bg-brand/10 text-brand'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
                }
              `}
            >
              <span className={active ? 'text-brand' : 'text-white/40'}>
                {item.icon}
              </span>
              <span className={collapsed ? 'md:hidden' : ''}>{item.label}</span>
              {active && (
                <span className={`ml-auto w-1 h-4 rounded-full bg-brand ${collapsed ? 'md:hidden' : ''}`} />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className={`py-4 border-t border-white/10 space-y-3 ${collapsed ? 'md:px-2' : 'px-5'}`}>
        {currentUser && (
          <div ref={profileMenuRef} className="relative pb-3 border-b border-white/10">
            <button
              onClick={() => setProfileMenuOpen((v) => !v)}
              title={collapsed ? currentUser.name : undefined}
              className={`w-full flex items-center gap-2 text-left ${collapsed ? 'md:justify-center' : 'justify-between'}`}
            >
              <div className={`min-w-0 flex items-center gap-2 ${collapsed ? 'md:justify-center' : ''}`}>
                <div className={`flex-shrink-0 w-6 h-6 rounded-full bg-white/10 items-center justify-center text-white/70 text-[11px] font-semibold ${collapsed ? 'flex' : 'hidden'}`}>
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <div className={`min-w-0 ${collapsed ? 'md:hidden' : ''}`}>
                  <p className="text-white/80 text-xs font-semibold truncate">{currentUser.name}</p>
                  <p className="text-white/30 text-[11px] truncate">{currentUser.email}</p>
                </div>
                {unreadMentions > 0 && (
                  <span className={`flex-shrink-0 bg-brand text-gray-900 text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 items-center justify-center ${collapsed ? 'md:hidden' : 'flex'}`}>
                    {unreadMentions > 99 ? '99+' : unreadMentions}
                  </span>
                )}
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-white/40 flex-shrink-0 ${collapsed ? 'md:hidden' : ''}`}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {profileMenuOpen && (
              <div className="absolute bottom-full mb-2 left-0 w-48 md:w-full bg-[#242424] border border-white/10 rounded-lg overflow-hidden shadow-xl z-10">
                <Link
                  href="/profil"
                  className="flex items-center gap-2 px-3 py-2.5 text-xs text-white/75 hover:bg-white/5 transition-colors"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  Mein Profil
                </Link>
                <div className="h-px bg-white/10" />
                <Link
                  href="/erwaehnungen"
                  className="flex items-center gap-2 px-3 py-2.5 text-xs text-white/75 hover:bg-white/5 transition-colors"
                >
                  <span className="flex-shrink-0">{MENTIONS_ICON}</span>
                  <span className="flex-1">Erwähnungen</span>
                  {unreadMentions > 0 && (
                    <span className="flex-shrink-0 bg-brand text-gray-900 text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                      {unreadMentions > 99 ? '99+' : unreadMentions}
                    </span>
                  )}
                </Link>
                <div className="h-px bg-white/10" />
                <form action={logout}>
                  <button
                    type="submit"
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-white/75 hover:bg-white/5 transition-colors"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    Abmelden
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
        <div className={collapsed ? 'md:hidden' : ''}>
          <p className="text-white/30 text-xs font-medium">Sentimental Logic</p>
          <div className="flex items-center gap-2 mt-1.5">
            <p className="text-white/20 text-xs">v0.11.0</p>
            <button
              type="button"
              onClick={openPageDefault}
              aria-label="Hilfe anzeigen (Taste ?)"
              title="Hilfe (Taste ?)"
              className="text-white/40 hover:text-brand transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 015.83 1c0 2-3 2-3 4" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </button>
            <a
              href="/release-notes"
              className="text-white/40 hover:text-brand transition-colors group relative"
              title="Was ist neu?"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-brand rounded-full group-hover:animate-pulse" />
            </a>
          </div>
        </div>
      </div>
      </aside>
    </>
  )
}
