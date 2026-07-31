// Datumshilfen für den Kalender (Tag/Arbeitswoche/Woche/Monat/Jahr-Ansichten).
// Woche startet Montag (deutsche Konvention), KW nach ISO-8601.

export function istGleicherTag(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function istHeute(d: Date): boolean {
  return istGleicherTag(d, new Date())
}

export function tageAddieren(d: Date, n: number): Date {
  const copy = new Date(d)
  copy.setDate(copy.getDate() + n)
  return copy
}

export function monateAddieren(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

// Montag der Woche, in der `d` liegt.
export function wochenStart(d: Date): Date {
  const copy = new Date(d)
  const tag = copy.getDay() // 0 = So, 1 = Mo, ...
  const diff = tag === 0 ? -6 : 1 - tag
  copy.setDate(copy.getDate() + diff)
  copy.setHours(0, 0, 0, 0)
  return copy
}

export function wochenTage(d: Date): Date[] {
  const start = wochenStart(d)
  return Array.from({ length: 7 }, (_, i) => tageAddieren(start, i))
}

export function arbeitsWochenTage(d: Date): Date[] {
  return wochenTage(d).slice(0, 5)
}

// ISO-8601 Kalenderwoche.
export function kalenderwoche(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

// 6×7-Raster für die Monatsansicht: führende/nachfolgende Tage aus
// Nachbarmonaten sind enthalten (grau dargestellt), damit das Raster immer
// volle Wochen zeigt — wie bei STRATO.
export function monatsRaster(d: Date): Date[] {
  const ersterDesMonats = new Date(d.getFullYear(), d.getMonth(), 1)
  const start = wochenStart(ersterDesMonats)
  return Array.from({ length: 42 }, (_, i) => tageAddieren(start, i))
}

export function istImMonat(d: Date, monat: Date): boolean {
  return d.getMonth() === monat.getMonth() && d.getFullYear() === monat.getFullYear()
}

const WOCHENTAGE_KURZ = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
export function wochentagKurz(d: Date): string {
  const idx = d.getDay() === 0 ? 6 : d.getDay() - 1
  return WOCHENTAGE_KURZ[idx]
}

export function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Lokale Zeit → "YYYY-MM-DDTHH:mm" für <input type="datetime-local">.
export function toDatetimeLocalValue(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day}T${h}:${min}`
}

export const STUNDEN = Array.from({ length: 24 }, (_, i) => i)

// Vertikale Position (px) eines Zeitpunkts im Stundenraster.
export function minutenSeitMitternacht(d: Date): number {
  return d.getHours() * 60 + d.getMinutes()
}
