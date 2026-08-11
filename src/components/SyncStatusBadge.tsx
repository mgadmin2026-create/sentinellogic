'use client'

// Status-Badge für sync_runs-Zeilen — angelehnt an SyncMarke aus
// RegelLaufHistorie.tsx, aber mit der vollen Zustandsvielfalt (siehe
// src/lib/sync-runs/status.ts).
import { classifyRunStatus } from '@/lib/sync-runs/status'

const TONE_KLASSE: Record<string, string> = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  error: 'bg-red-50 text-red-700 border-red-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  neutral: 'bg-gray-100 text-gray-500 border-gray-200',
}

export function SyncStatusBadge({ status, detail }: { status: string; detail?: string | null }) {
  const { label, tone } = classifyRunStatus(status)
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] whitespace-nowrap ${TONE_KLASSE[tone]}`}
      title={detail || undefined}
    >
      {label}
    </span>
  )
}
