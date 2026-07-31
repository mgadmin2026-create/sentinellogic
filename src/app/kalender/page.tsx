'use client'
// Kalender — nachgebaut nach dem STRATO-Webmail-Kalender des Kunden:
// Tag/Arbeitswoche/Woche/Monat/Jahr-Ansichten, Mini-Kalender-Navigator links,
// "Meine Kalender"-Sidebar mit togglebaren Quellen. Zeigt echte Termine
// (termine-Tabelle, Uhrzeit-basiert) zusammen mit Aufgaben-Fälligkeiten und
// Geburtstagen (aus contacts.geburtstag) im selben Raster — jede Quelle ist
// einzeln aus-/einblendbar, wie bei STRATO die einzelnen Kalender.
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { HelpButton } from '@/components/help/HelpButton'
import { TerminEditModal, type Termin } from '@/components/TerminEditModal'
import { MiniMonat } from '@/components/kalender/MiniMonat'
import { ZeitrasterView } from '@/components/kalender/ZeitrasterView'
import { MonatsView } from '@/components/kalender/MonatsView'
import { JahresView } from '@/components/kalender/JahresView'
import type { KalenderEintrag, KalenderQuelle } from '@/types/kalender'
import { QUELLEN_FARBEN, QUELLEN_LABEL } from '@/types/kalender'
import {
  arbeitsWochenTage,
  wochenTage,
  monateAddieren,
  monatsRaster,
  tageAddieren,
  toDateKey,
  kalenderwoche,
} from '@/lib/kalender-helpers'

type Ansicht = 'tag' | 'arbeitswoche' | 'woche' | 'monat' | 'jahr'

interface TerminApi extends Termin {
  id: string
  contact?: { id: string; first_name: string; last_name: string } | null
}

interface Aufgabe {
  id: string
  titel: string
  fällig: string
  status: string
  contact?: { first_name: string; last_name: string } | null
}

interface KontaktMitGeburtstag {
  id: string
  first_name: string
  last_name: string
  geburtstag?: string
}

const ANSICHT_LABEL: Record<Ansicht, string> = {
  tag: 'Tag', arbeitswoche: 'Arbeitswoche', woche: 'Woche', monat: 'Monat', jahr: 'Jahr',
}

function aufgabenZuEintraegen(aufgaben: Aufgabe[], von: Date, bis: Date): KalenderEintrag[] {
  return aufgaben
    .filter((a) => a.status !== 'erledigt' && a.fällig)
    .map((a) => {
      const d = new Date(`${a.fällig}T00:00:00`)
      return { d, a }
    })
    .filter(({ d }) => d >= von && d < bis)
    .map(({ d, a }) => ({
      id: `auf-${a.id}`,
      quelle: 'aufgaben' as const,
      titel: a.titel,
      start: d,
      end: d,
      ganztaegig: true,
      farbe: '',
      contactName: a.contact ? `${a.contact.first_name} ${a.contact.last_name}` : undefined,
      raw: a,
    }))
}

function geburtstageZuEintraegen(kontakte: KontaktMitGeburtstag[], von: Date, bis: Date): KalenderEintrag[] {
  const ergebnisse: KalenderEintrag[] = []
  for (const k of kontakte) {
    if (!k.geburtstag) continue
    const geb = new Date(`${k.geburtstag}T00:00:00`)
    if (isNaN(geb.getTime())) continue
    for (let jahr = von.getFullYear(); jahr <= bis.getFullYear(); jahr++) {
      const anlass = new Date(jahr, geb.getMonth(), geb.getDate())
      if (anlass >= von && anlass < bis) {
        const alter = jahr - geb.getFullYear()
        ergebnisse.push({
          id: `geb-${k.id}-${jahr}`,
          quelle: 'geburtstage',
          titel: `🎂 ${k.first_name} ${k.last_name} (${alter})`,
          start: anlass,
          end: anlass,
          ganztaegig: true,
          farbe: '',
          contactName: `${k.first_name} ${k.last_name}`,
          raw: k,
        })
      }
    }
  }
  return ergebnisse
}

function terminZuEintrag(t: TerminApi): KalenderEintrag {
  return {
    id: t.id!,
    quelle: 'termine',
    titel: t.titel,
    start: new Date(t.start_zeit),
    end: new Date(t.end_zeit),
    ganztaegig: !!t.ganztaegig,
    farbe: '',
    ort: t.ort,
    contactName: t.contact ? `${t.contact.first_name} ${t.contact.last_name}` : undefined,
    raw: t,
  }
}

function berechneTitel(ansicht: Ansicht, currentDate: Date, tage: Date[]): string {
  if (ansicht === 'tag') {
    return currentDate.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric' })
  }
  if (ansicht === 'arbeitswoche' || ansicht === 'woche') {
    const start = tage[0]
    const end = tage[tage.length - 1]
    if (start.getMonth() === end.getMonth()) return start.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
    if (start.getFullYear() === end.getFullYear()) {
      return `${start.toLocaleDateString('de-DE', { month: 'long' })} – ${end.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}`
    }
    return `${start.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })} – ${end.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}`
  }
  if (ansicht === 'monat') return currentDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
  return String(currentDate.getFullYear())
}

export default function KalenderPage() {
  const router = useRouter()
  const [ansicht, setAnsicht] = useState<Ansicht>('woche')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [termine, setTermine] = useState<TerminApi[]>([])
  const [aufgaben, setAufgaben] = useState<Aufgabe[]>([])
  const [kontakte, setKontakte] = useState<KontaktMitGeburtstag[]>([])
  const [loading, setLoading] = useState(true)
  const [quellenAktiv, setQuellenAktiv] = useState<Record<KalenderQuelle, boolean>>({
    termine: true,
    aufgaben: true,
    geburtstage: true,
  })
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTermin, setEditingTermin] = useState<TerminApi | null>(null)
  const [neuerStart, setNeuerStart] = useState<Date | null>(null)
  const [stratoSyncLaeuft, setStratoSyncLaeuft] = useState(false)
  const [stratoSyncMeldung, setStratoSyncMeldung] = useState<string | null>(null)

  const tage = useMemo(() => {
    if (ansicht === 'tag') return [currentDate]
    if (ansicht === 'arbeitswoche') return arbeitsWochenTage(currentDate)
    if (ansicht === 'woche') return wochenTage(currentDate)
    return []
  }, [ansicht, currentDate])

  const { von, bis } = useMemo(() => {
    if (ansicht === 'tag') {
      const start = new Date(currentDate)
      start.setHours(0, 0, 0, 0)
      return { von: start, bis: tageAddieren(start, 1) }
    }
    if (ansicht === 'arbeitswoche' || ansicht === 'woche') {
      const start = new Date(tage[0])
      start.setHours(0, 0, 0, 0)
      return { von: start, bis: tageAddieren(tage[tage.length - 1], 1) }
    }
    if (ansicht === 'monat') {
      const raster = monatsRaster(currentDate)
      return { von: raster[0], bis: tageAddieren(raster[raster.length - 1], 1) }
    }
    // jahr
    return { von: new Date(currentDate.getFullYear(), 0, 1), bis: new Date(currentDate.getFullYear() + 1, 0, 1) }
  }, [ansicht, currentDate, tage])

  const ladeTermine = useCallback(async () => {
    try {
      const res = await fetch(`/api/termine?von=${von.toISOString()}&bis=${bis.toISOString()}`)
      const json = await res.json()
      if (json.success) setTermine(json.data)
    } catch (err) {
      console.error('Fehler beim Laden der Termine:', err)
    }
  }, [von, bis])

  useEffect(() => {
    setLoading(true)
    Promise.all([
      ladeTermine(),
      fetch('/api/aufgaben?limit=1000').then((r) => r.json()).then((j) => { if (j.success) setAufgaben(j.data) }),
      fetch('/api/kontakte?limit=1000').then((r) => r.json()).then((j) => { if (j.success) setKontakte(j.data) }),
    ]).finally(() => setLoading(false))
  }, [ladeTermine])

  const eintraege: KalenderEintrag[] = useMemo(() => {
    const alle: KalenderEintrag[] = []
    if (quellenAktiv.termine) alle.push(...termine.map(terminZuEintrag))
    if (quellenAktiv.aufgaben) alle.push(...aufgabenZuEintraegen(aufgaben, von, bis))
    if (quellenAktiv.geburtstage) alle.push(...geburtstageZuEintraegen(kontakte, von, bis))
    return alle
  }, [termine, aufgaben, kontakte, quellenAktiv, von, bis])

  const markierteTage = useMemo(() => new Set(eintraege.map((e) => toDateKey(e.start))), [eintraege])

  function navigiere(richtung: 1 | -1) {
    if (ansicht === 'tag') setCurrentDate((d) => tageAddieren(d, richtung))
    else if (ansicht === 'arbeitswoche' || ansicht === 'woche') setCurrentDate((d) => tageAddieren(d, richtung * 7))
    else if (ansicht === 'monat') setCurrentDate((d) => monateAddieren(d, richtung))
    else setCurrentDate((d) => new Date(d.getFullYear() + richtung, d.getMonth(), 1))
  }

  function heute() {
    setCurrentDate(new Date())
  }

  function neuerTermin(start: Date) {
    setEditingTermin(null)
    setNeuerStart(start)
    setModalOpen(true)
  }

  function eventKlick(e: KalenderEintrag) {
    if (e.quelle === 'termine') {
      setEditingTermin(e.raw as TerminApi)
      setNeuerStart(null)
      setModalOpen(true)
    } else if (e.quelle === 'aufgaben') {
      router.push(`/aufgaben/${(e.raw as Aufgabe).id}`)
    } else {
      const k = e.raw as KontaktMitGeburtstag
      router.push(`/kontakte/${k.id}`)
    }
  }

  async function handleSave(form: Termin) {
    const url = editingTermin ? `/api/termine/${editingTermin.id}` : '/api/termine'
    const method = editingTermin ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => null)
      throw new Error(json?.error || 'Fehler beim Speichern')
    }
    await ladeTermine()
  }

  async function handleDelete() {
    if (!editingTermin) return
    await fetch(`/api/termine/${editingTermin.id}`, { method: 'DELETE' })
    await ladeTermine()
  }

  function tagKlickMonat(datum: Date) {
    setCurrentDate(datum)
    setAnsicht('tag')
  }

  function tagKlickJahr(datum: Date) {
    setCurrentDate(datum)
    setAnsicht('monat')
  }

  function tagKlickMini(datum: Date) {
    setCurrentDate(datum)
  }

  async function stratoSynchronisieren() {
    setStratoSyncLaeuft(true)
    setStratoSyncMeldung(null)
    try {
      const res = await fetch('/api/termine/sync-strato', { method: 'POST' })
      const json = await res.json()
      if (!json.success) {
        setStratoSyncMeldung(`❌ ${json.error}`)
        return
      }
      const { neu, aktualisiert, unveraendert, fehler } = json.data
      setStratoSyncMeldung(
        `✅ ${neu} neu, ${aktualisiert} aktualisiert, ${unveraendert} unverändert` +
        (fehler > 0 ? `, ${fehler} Fehler` : '')
      )
      await ladeTermine()
    } catch (err) {
      setStratoSyncMeldung('❌ Synchronisation fehlgeschlagen')
    } finally {
      setStratoSyncLaeuft(false)
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-1.5">
          <h1 className="text-2xl font-bold text-gray-900">Kalender</h1>
          <HelpButton articleId="kalender.overview" />
        </div>
        <button
          onClick={() => neuerTermin(new Date())}
          className="flex items-center gap-2 bg-[#FFC300] hover:bg-[#e6b000] text-[#1A1A1A] font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Neuer Termin
        </button>
      </div>

      <div className="grid lg:grid-cols-[240px_1fr] gap-6 items-start">
        {/* Sidebar */}
        <div className="space-y-6">
          <MiniMonat monat={currentDate} ausgewaehlt={currentDate} onTagClick={tagKlickMini} markierteTage={markierteTage} kompakt />

          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Meine Kalender</p>
              <HelpButton articleId="kalender.meine-kalender" />
            </div>
            <div className="space-y-1.5">
              {(Object.keys(QUELLEN_LABEL) as KalenderQuelle[]).map((quelle) => (
                <label key={quelle} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={quellenAktiv[quelle]}
                    onChange={(e) => setQuellenAktiv((prev) => ({ ...prev, [quelle]: e.target.checked }))}
                    className="rounded border-gray-300 text-yellow-500 focus:ring-yellow-400"
                  />
                  <span className={`w-2.5 h-2.5 rounded-full ${QUELLEN_FARBEN[quelle].punkt}`} />
                  <span className="text-gray-700">{QUELLEN_LABEL[quelle]}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">STRATO-Synchronisation</p>
              <HelpButton articleId="kalender.strato-sync" />
            </div>
            <button
              onClick={stratoSynchronisieren}
              disabled={stratoSyncLaeuft}
              className="w-full text-xs font-semibold px-3 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 rounded-lg transition-colors"
            >
              {stratoSyncLaeuft ? '⏳ Synchronisiert…' : '🔄 Jetzt von STRATO holen'}
            </button>
            {stratoSyncMeldung && (
              <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed">{stratoSyncMeldung}</p>
            )}
            <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">
              Neue/bearbeitete Termine gehen sofort automatisch zu STRATO. Änderungen von STRATO-Seite
              holt dieser Button — Löschungen auf STRATO werden bewusst nicht automatisch im CRM entfernt.
            </p>
          </div>
        </div>

        {/* Hauptbereich */}
        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden">
                <button onClick={() => navigiere(-1)} className="p-2 hover:bg-gray-100 transition-colors" aria-label="Zurück">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <button onClick={heute} className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 border-x border-gray-200 transition-colors">
                  Heute
                </button>
                <button onClick={() => navigiere(1)} className="p-2 hover:bg-gray-100 transition-colors" aria-label="Weiter">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>
              <h2 className="text-lg font-bold text-gray-900">{berechneTitel(ansicht, currentDate, tage)}</h2>
              {ansicht !== 'jahr' && (
                <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-2 py-1 rounded">KW {kalenderwoche(currentDate)}</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <HelpButton articleId="kalender.ansicht" />
              <select
                value={ansicht}
                onChange={(e) => setAnsicht(e.target.value as Ansicht)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-yellow-400/40"
              >
                {(Object.keys(ANSICHT_LABEL) as Ansicht[]).map((a) => (
                  <option key={a} value={a}>{ANSICHT_LABEL[a]}</option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="border border-gray-200 rounded-xl bg-white p-12 text-center text-gray-400 text-sm">Lädt…</div>
          ) : (
            <>
              {(ansicht === 'tag' || ansicht === 'arbeitswoche' || ansicht === 'woche') && (
                <ZeitrasterView tage={tage} eintraege={eintraege} onSlotClick={neuerTermin} onEventClick={eventKlick} />
              )}
              {ansicht === 'monat' && (
                <MonatsView monat={currentDate} eintraege={eintraege} onTagClick={tagKlickMonat} onEventClick={eventKlick} />
              )}
              {ansicht === 'jahr' && (
                <JahresView jahr={currentDate.getFullYear()} markierteTage={markierteTage} onTagClick={tagKlickJahr} />
              )}
            </>
          )}
        </div>
      </div>

      <TerminEditModal
        termin={editingTermin}
        initialStart={neuerStart}
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingTermin(null); setNeuerStart(null) }}
        onSave={handleSave}
        onDelete={editingTermin ? handleDelete : undefined}
      />
    </div>
  )
}
