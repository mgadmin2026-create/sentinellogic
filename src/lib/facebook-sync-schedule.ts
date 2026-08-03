// Berechnet next_sync_at für die Facebook-Auto-Sync-Konfiguration.
// Geteilt zwischen der manuellen Config-Route (/api/sync-config) und dem
// Cron-Trigger (/api/cron/facebook-sync), damit beide dieselbe Zeitlogik
// verwenden -- vorher war die Berechnung in /api/sync-config dupliziert und
// wurde vom Cron-Trigger (der es damals noch gar nicht gab) nie erreicht.
export type IntervalType = '15min' | '30min' | '60min' | 'daily' | 'weekly'

export function berechneNaechstenSync(intervalType: IntervalType, von: Date = new Date()): Date {
  switch (intervalType) {
    case '15min':
      return new Date(von.getTime() + 15 * 60 * 1000)
    case '30min':
      return new Date(von.getTime() + 30 * 60 * 1000)
    case '60min':
      return new Date(von.getTime() + 60 * 60 * 1000)
    case 'daily': {
      const next = new Date(von)
      next.setUTCHours(8, 0, 0, 0)
      if (next <= von) next.setUTCDate(next.getUTCDate() + 1)
      return next
    }
    case 'weekly': {
      const next = new Date(von)
      const currentDay = next.getUTCDay()
      const daysUntilMonday = currentDay === 1 ? 7 : (1 - currentDay + 7) % 7 || 7
      next.setUTCDate(next.getUTCDate() + daysUntilMonday)
      next.setUTCHours(8, 0, 0, 0)
      return next
    }
  }
}
