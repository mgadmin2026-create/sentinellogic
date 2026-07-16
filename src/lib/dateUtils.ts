export function calculateAge(birthDate: string | Date | null): number | null {
  if (!birthDate) return null

  const birth = new Date(birthDate)
  const today = new Date()

  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }

  return age
}

export function daysUntilBirthday(birthDate: string | Date | null): number {
  if (!birthDate) return -1

  const birth = new Date(birthDate)
  const today = new Date()

  let nextBirthday = new Date(today.getFullYear(), birth.getMonth(), birth.getDate())

  if (nextBirthday < today) {
    nextBirthday = new Date(today.getFullYear() + 1, birth.getMonth(), birth.getDate())
  }

  const diffMs = nextBirthday.getTime() - today.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  return diffDays
}

export function isBirthdaySoon(birthDate: string | Date | null, daysThreshold: number = 7): boolean {
  if (!birthDate) return false
  const days = daysUntilBirthday(birthDate)
  return days >= 0 && days <= daysThreshold
}

export function formatDate(date: string | Date | null, format: 'de' | 'iso' = 'de'): string {
  if (!date) return '—'

  const d = new Date(date)

  if (format === 'de') {
    return d.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  return d.toISOString().split('T')[0]
}
