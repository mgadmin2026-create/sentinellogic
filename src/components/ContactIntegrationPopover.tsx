'use client'

import { useEffect, useRef, useState } from 'react'

interface ContactIntegrationPopoverProps {
  contact: {
    first_name?: string
    last_name?: string
    email?: string
    phone_mobile?: string
    phone_office?: string
    facebook_id?: string | null
    dialfire_id?: string | null
    dialfire_campaign_id?: string | null
    dialfire_campaign?: string | null
    dialfire_sync_error?: string | null
    klicktipp_id?: string | null
    klicktipp_tags?: string[] | null
    superchat_id?: string | null
    superchat_labels?: string[] | null
    superchat_sync_error?: string | null
  }
}

interface IntegrationRowProps {
  name: string
  connected: boolean
  error?: boolean
  detailLabel: string
  detail?: string | null
  tags?: string[] | null
  tagLabel?: string
  href?: string | null
}

function shortened(value: string, maxLength = 24) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value
}

function IntegrationRow({ name, connected, error, detailLabel, detail, tags, tagLabel, href }: IntegrationRowProps) {
  const visibleTags = (tags ?? []).slice(0, 2)
  const remainingTags = Math.max((tags?.length ?? 0) - visibleTags.length, 0)

  return (
    <div className="border-b border-gray-100 px-3 py-2.5 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`h-2 w-2 shrink-0 rounded-full ${error ? 'bg-orange-400' : connected ? 'bg-emerald-500' : 'bg-gray-300'}`} />
          <span className="truncate text-xs font-semibold text-gray-800">{name}</span>
        </div>
        <span className={`text-[10px] font-medium ${error ? 'text-orange-600' : connected ? 'text-emerald-700' : 'text-gray-400'}`}>
          {error ? 'Prüfen' : connected ? 'Verbunden' : 'Nicht verbunden'}
        </span>
      </div>

      {connected && detail && (
        <div className="mt-1.5 flex items-center justify-between gap-2 pl-4">
          <span className="shrink-0 text-[10px] text-gray-400">{detailLabel}</span>
          <span className="truncate font-mono text-[10px] text-gray-600" title={detail}>{shortened(detail)}</span>
        </div>
      )}

      {connected && visibleTags.length > 0 && (
        <div className="mt-2 pl-4">
          <p className="mb-1 text-[10px] text-gray-400">{tagLabel || 'Tags'}</p>
          <div className="flex flex-wrap gap-1">
            {visibleTags.map((tag) => (
              <span key={tag} title={tag} className="max-w-[145px] truncate rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">
                {tag}
              </span>
            ))}
            {remainingTags > 0 && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">+{remainingTags}</span>
            )}
          </div>
        </div>
      )}

      {connected && href && (
        <div className="mt-2 text-right">
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-[10px] font-semibold text-yellow-700 hover:underline">
            In SuperChat öffnen ↗
          </a>
        </div>
      )}
    </div>
  )
}

function buildSuperchatUrl(contact: ContactIntegrationPopoverProps['contact']) {
  if (!contact.superchat_id) return null
  const params = new URLSearchParams()
  const mobile = contact.phone_mobile?.trim()
  const office = contact.phone_office?.trim()
  const email = contact.email?.trim().toLowerCase()
  if (mobile) params.set('sms', mobile.replace(/^\+/, ''))
  else if (office) params.set('sms', office.replace(/^\+/, ''))
  else if (email) params.set('email', email)
  else return null
  if (contact.first_name?.trim()) params.set('firstname', contact.first_name.trim())
  if (contact.last_name?.trim()) params.set('lastname', contact.last_name.trim())
  return `https://app.superchat.de/inbox/find/?${params.toString()}`
}

export function ContactIntegrationPopover({ contact }: ContactIntegrationPopoverProps) {
  const [open, setOpen] = useState(false)
  const [locked, setLocked] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const connectedCount = [contact.facebook_id, contact.dialfire_id, contact.klicktipp_id, contact.superchat_id].filter(Boolean).length
  const hasError = Boolean(contact.dialfire_sync_error || contact.superchat_sync_error)
  const campaign = contact.dialfire_campaign || contact.dialfire_campaign_id

  function updatePosition() {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    const width = 288
    setPosition({
      top: Math.min(rect.bottom + 8, window.innerHeight - 390),
      left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)),
    })
  }

  function show() {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    updatePosition()
    setOpen(true)
  }

  function hideSoon() {
    if (locked) return
    closeTimer.current = setTimeout(() => setOpen(false), 140)
  }

  useEffect(() => {
    if (!open) return
    function closeOnOutsideClick(event: MouseEvent) {
      const target = event.target as Node
      if (!buttonRef.current?.contains(target) && !popoverRef.current?.contains(target)) {
        setLocked(false)
        setOpen(false)
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setLocked(false)
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    window.addEventListener('resize', updatePosition)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('resize', updatePosition)
    }
  }, [open])

  const tooltip = connectedCount > 0
    ? `${connectedCount} von 4 Integrationen verbunden${hasError ? ' – eine Verbindung prüfen' : ''}`
    : 'Keine Integration verbunden'

  return (
    <div className="relative shrink-0" onMouseEnter={show} onMouseLeave={hideSoon}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={tooltip}
        aria-expanded={open}
        onFocus={show}
        onBlur={hideSoon}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          const nextLocked = !locked
          setLocked(nextLocked)
          if (nextLocked) show()
          else setOpen(false)
        }}
        className={`relative flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${hasError ? 'border-orange-200 bg-orange-50 text-orange-600' : connectedCount > 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white text-gray-400 hover:bg-gray-50'}`}
        title={tooltip}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
        </svg>
        {connectedCount > 0 && (
          <span className={`absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white ring-2 ring-white ${hasError ? 'bg-orange-500' : 'bg-emerald-600'}`}>
            {connectedCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Integrationsverbindungen"
          onMouseEnter={show}
          onMouseLeave={hideSoon}
          className="fixed z-[80] w-72 overflow-hidden rounded-xl border border-gray-200 bg-white text-left shadow-xl"
          style={{ top: position.top, left: position.left }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-3 py-2">
            <span className="text-xs font-bold text-gray-800">Verbindungen</span>
            <span className="text-[10px] text-gray-400">{connectedCount}/4 verbunden</span>
          </div>
          <IntegrationRow name="Facebook Lead" connected={Boolean(contact.facebook_id)} detailLabel="Lead-ID" detail={contact.facebook_id} />
          <IntegrationRow name="Dialfire" connected={Boolean(contact.dialfire_id)} error={Boolean(contact.dialfire_sync_error)} detailLabel="Kampagne" detail={campaign} />
          <IntegrationRow name="KlickTipp" connected={Boolean(contact.klicktipp_id)} detailLabel="Kontakt-ID" detail={contact.klicktipp_id} tags={contact.klicktipp_tags} tagLabel="Tags" />
          <IntegrationRow name="SuperChat" connected={Boolean(contact.superchat_id)} error={Boolean(contact.superchat_sync_error)} detailLabel="Kontakt-ID" detail={contact.superchat_id} tags={contact.superchat_labels} tagLabel="Gesprächslabels" href={buildSuperchatUrl(contact)} />
        </div>
      )}
    </div>
  )
}
