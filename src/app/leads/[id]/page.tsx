'use client'
// Lead-Profil — alle Details, Notizen, Versicherungsstatus, KI-Gesprächsvorbereitung
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { STATUS_LABELS, STATUS_COLORS, SOURCE_LABELS, type MockLead } from '@/data/mock'
import { mergeSteps, DEFAULT_STAGES, type PipelineStage } from '@/lib/pipeline'
import { ProcessStepper } from '@/components/ProcessStepper'

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  sync: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  ),
  research: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  ai_prep: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  status_change: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
}

const INSURANCE_BADGES = ['BHV', 'KFZ', 'Rechtsschutz', 'Kranken', 'Leben', 'Rente', 'Cyber', 'D&O', 'Berufshaftpflicht', 'Bauleistung', 'Inhaltsversicherung', 'Betriebsunterbrechung', 'Praxisausfall']

export default function LeadDetailPage() {
  const params = useParams()
  const router = useRouter()

  // Lead aus echter Datenbank laden
  const [lead, setLead] = useState<MockLead | null>(null)
  const [loadingLead, setLoadingLead] = useState(true)
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>(DEFAULT_STAGES)
  const [notes, setNotes] = useState('')
  const [notesTimestamp, setNotesTimestamp] = useState<string | undefined>()
  const [prepModalOpen, setPrepModalOpen] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch(`/api/leads/${params.id}`).then((r) => r.json()),
      fetch('/api/pipeline-stages').then((r) => r.json())
    ])
      .then(([leadRes, stagesRes]) => {
        if (leadRes.success) {
          setLead(leadRes.data)
          setNotes(leadRes.data.notes ?? '')
          setNotesTimestamp(leadRes.data.notes_updated_at)
        }
        if (stagesRes.success) {
          setPipelineStages(stagesRes.data)
        }
      })
      .catch(console.error)
      .finally(() => setLoadingLead(false))
  }, [params.id])

  if (loadingLead) {
    return (
      <div className="p-8 flex items-center justify-center text-gray-400 text-sm">
        Lead wird geladen…
      </div>
    )
  }

  if (!lead) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Lead nicht gefunden.</p>
        <button onClick={() => router.push('/leads')} className="mt-4 text-sm text-[#FFC300] hover:underline">
          ← Zurück zur Lead-Liste
        </button>
      </div>
    )
  }

  async function saveQuickNote() {
    const ts = new Date().toISOString()
    // Notiz in Datenbank speichern
    await fetch(`/api/leads/${lead!.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    }).catch(console.error)
    setNotesTimestamp(ts)
    setLead((prev) => prev ? { ...prev, notes, notes_updated_at: ts } : prev)
  }

  async function handlePipelineStageChange(newStageKey: string) {
    if (!lead) return
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipeline_stage: newStageKey }),
      })
      const data = await res.json()
      if (data.success) {
        setLead(data.data)
      }
    } catch (err) {
      console.error('Fehler beim Ändern des Prozessschritts:', err)
    }
  }

  async function handlePipelineStepsUpdate(
    steps: Array<{ key: string; done: boolean; completed_at?: string; due_date?: string }>
  ) {
    if (!lead) return
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipeline_steps: steps }),
      })
      const data = await res.json()
      if (data.success) {
        setLead(data.data)
      }
    } catch (err) {
      console.error('Fehler beim Aktualisieren der Prozessschritte:', err)
    }
  }

  const sectionCard = (title: string, children: React.ReactNode) => (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-4">
      <h2 className="text-sm font-bold text-[#1A1A1A] uppercase tracking-wide mb-4 pb-3 border-b border-gray-100">
        {title}
      </h2>
      {children}
    </div>
  )

  const field = (label: string, value?: string | number | null) => (
    <div key={label}>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm text-[#1A1A1A] font-medium">{value || '—'}</p>
    </div>
  )

  const grid = (cols: number, children: React.ReactNode) => (
    <div className={`grid grid-cols-${cols} gap-x-6 gap-y-4`}>{children}</div>
  )

  // KI-Gesprächsvorbereitung (statischer Platzhalter, realistisch formuliert)
  const aiPrep = `
**Gesprächseinstieg**
Guten Tag ${lead.first_name === 'Sabine' || lead.first_name === 'Jana' || lead.first_name === 'Maria' || lead.first_name === 'Christine' ? 'Frau' : 'Herr'} ${lead.last_name}, herzlichen Dank, dass Sie sich über ${SOURCE_LABELS[lead.source]} bei uns gemeldet haben. Sie ${lead.company_name ? `betreiben ${lead.company_name}` : 'sind'} seit ${lead.founded_year ?? '2019'} ${lead.industry ? `in der Branche ${lead.industry}` : 'selbstständig tätig'}${lead.employees ? ` und beschäftigen ${lead.employees} Mitarbeiter` : ''}. Ich freue mich, Ihnen heute einen Überblick über mögliche Optimierungen in Ihrem Versicherungsschutz geben zu können.

**Identifizierte Versicherungslücken**
${lead.coverage_gaps || 'Basierend auf der Unternehmensgröße und Branche wurden folgende Lücken identifiziert.'}

**Empfohlene Produkte**
${lead.existing_insurances.includes('BHV') ? '' : '• Betriebshaftpflicht (BHV): Pflicht für jeden Gewerbetreibenden — schützt vor Schadensersatzansprüchen Dritter.\n'}${lead.existing_insurances.includes('Cyber') ? '' : '• Cyber-Versicherung: Schutz vor Datenverlust, Betriebsunterbrechung durch Hackerangriffe und DSGVO-Bußgeldern.\n'}${lead.existing_insurances.includes('Rechtsschutz') ? '' : '• Gewerblicher Rechtsschutz: Absicherung bei arbeitsrechtlichen Auseinandersetzungen und Vertragsstreitigkeiten.\n'}• Betriebsunterbrechungsversicherung: Bei Ausfall durch Krankheit, Schaden oder externe Ereignisse.

**Mögliche Einwände und Antworten**

Einwand: "Ich bin schon ausreichend versichert."
→ Antwort: "Das freut mich zu hören. Ich würde Ihnen gerne einen kurzen Vergleich erstellen — oft gibt es Optimierungspotenzial bei Preis oder Deckungsumfang, ohne mehr zu bezahlen."

Einwand: "Das ist mir zu teuer."
→ Antwort: "Ich verstehe. Lassen Sie uns zunächst die wirklich notwendigen Bausteine identifizieren. Ein Gewerbepaket ab 80–120 €/Monat deckt die wichtigsten Risiken ab — das ist oft günstiger als erwartet."

Einwand: "Ich muss das erst mit meinem Steuerberater besprechen."
→ Antwort: "Sehr gerne. Ich kann Ihnen ein schriftliches Angebot vorbereiten, das Sie Ihrem Steuerberater vorlegen können. Versicherungsbeiträge sind als Betriebsausgaben absetzbar."
  `.trim()

  return (
    <div className="p-8 max-w-5xl">
      {/* Back + Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/leads')}
          className="text-gray-400 hover:text-[#1A1A1A] transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[#1A1A1A]">
            {lead.first_name} {lead.last_name}
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[lead.status]}`}>
              {STATUS_LABELS[lead.status]}
            </span>
            <span className="text-xs text-gray-400">via {SOURCE_LABELS[lead.source]}</span>
            <span className="text-xs text-gray-400">·</span>
            <span className="text-xs text-gray-400">
              {new Date(lead.created_at).toLocaleDateString('de-DE')}
            </span>
          </div>
        </div>
        <button
          onClick={() => setPrepModalOpen(true)}
          className="flex items-center gap-2 bg-[#FFC300] hover:bg-[#e6b000] text-[#1A1A1A] font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          Gesprächsvorbereitung
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Linke Spalte (2/3) */}
        <div className="col-span-2 space-y-4">

          {/* PROZESS-STEPPER — ganz oben */}
          {lead.pipeline_stage && (
            <ProcessStepper
              mergedSteps={mergeSteps(pipelineStages, (lead as any).pipeline_steps ?? [])}
              currentStageKey={lead.pipeline_stage}
              onStageChange={handlePipelineStageChange}
              onStepsUpdate={handlePipelineStepsUpdate}
              loading={loadingLead}
            />
          )}

          {/* NOTIZEN — ganz oben, prominent */}
          {sectionCard('Notizen', (
            <div className="space-y-3">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notizen zu diesem Lead eingeben…"
                rows={4}
                className="w-full text-sm border border-gray-200 rounded-lg px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-[#FFC300]/40 focus:border-[#FFC300] placeholder-gray-300"
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  {notesTimestamp
                    ? `Zuletzt gespeichert: ${new Date(notesTimestamp).toLocaleDateString('de-DE')}, ${new Date(notesTimestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`
                    : 'Noch nicht gespeichert'}
                </p>
                <button
                  onClick={saveQuickNote}
                  className="flex items-center gap-1.5 bg-[#1A1A1A] hover:bg-[#333] text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Schnell-Notiz speichern
                </button>
              </div>
            </div>
          ))}

          {/* PERSÖNLICHE DATEN */}
          {sectionCard('Persönliche Daten', (
            <div className="grid grid-cols-3 gap-x-6 gap-y-4">
              {field('Vorname', lead.first_name)}
              {field('Nachname', lead.last_name)}
              {field('Geburtsdatum', lead.birth_date ? new Date(lead.birth_date).toLocaleDateString('de-DE') : null)}
              {field('Familienstand', lead.marital_status)}
              {field('Kinder', lead.children !== undefined ? `${lead.children} ${lead.children === 1 ? 'Kind' : 'Kinder'}` : null)}
              {field('Beruf', lead.profession)}
              {field('Berufsgruppe', lead.profession_group)}
              {field('Position', lead.position)}
              {field('Telefon Mobil', lead.phone_mobile)}
              {field('Telefon Büro', lead.phone_office)}
              {field('E-Mail', lead.email)}
              {field('Adresse', lead.address)}
            </div>
          ))}

          {/* UNTERNEHMENSDATEN */}
          {lead.company_name && sectionCard('Unternehmensdaten', (
            <div className="grid grid-cols-3 gap-x-6 gap-y-4">
              {field('Firma', lead.company_name)}
              {field('Rechtsform', lead.legal_form)}
              {field('Gründungsjahr', lead.founded_year)}
              {field('Mitarbeiter', lead.employees)}
              {field('Jahresumsatz (ca.)', lead.annual_revenue)}
              {field('Handelsregister-Nr.', lead.trade_register)}
              {field('USt-IdNr.', lead.vat_id)}
              {field('Branche', lead.industry)}
              {field('Website', lead.website)}
              {field('Hauptsitz', lead.headquarters)}
              <div className="col-span-3">
                <p className="text-xs text-gray-400 mb-0.5">Tätigkeitsbeschreibung</p>
                <p className="text-sm text-[#1A1A1A]">{lead.business_description || '—'}</p>
              </div>
            </div>
          ))}

          {/* GEWERBEDATEN */}
          {lead.research && sectionCard('Gewerbedaten (automatisch recherchiert)', (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">
                  ✓ Recherche abgeschlossen
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-500 font-bold text-sm">✓</span>
                    <span className="text-sm font-medium text-[#1A1A1A]">Handelsregister</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 ml-5">{lead.trade_register || 'Geprüft'}</p>
                </div>
                {lead.research.google_rating && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-yellow-400 font-bold text-sm">★</span>
                      <span className="text-sm font-medium text-[#1A1A1A]">Google Bewertung</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 ml-5">{lead.research.google_rating}</p>
                  </div>
                )}
                {lead.research.website_info && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-blue-400 font-bold text-sm">●</span>
                      <span className="text-sm font-medium text-[#1A1A1A]">Website-Info</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 ml-5">{lead.research.website_info}</p>
                  </div>
                )}
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <span className={`font-bold text-sm ${lead.research.bundesanzeiger_checked ? 'text-emerald-500' : 'text-gray-300'}`}>
                      {lead.research.bundesanzeiger_checked ? '✓' : '–'}
                    </span>
                    <span className="text-sm font-medium text-[#1A1A1A]">Bundesanzeiger</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 ml-5">
                    {lead.research.bundesanzeiger_checked ? 'Geprüft' : 'Nicht verfügbar'}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {/* VERSICHERUNGSSTATUS */}
          {sectionCard('Versicherungsstatus', (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-400 mb-2">Bestehende Versicherungen</p>
                <div className="flex flex-wrap gap-2">
                  {INSURANCE_BADGES.map((ins) => {
                    const active = lead.existing_insurances.includes(ins)
                    return (
                      <span
                        key={ins}
                        className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
                          active
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-gray-50 text-gray-300 border-gray-200'
                        }`}
                      >
                        {active && '✓ '}{ins}
                      </span>
                    )
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                {field('Aktuelle Gesellschaften', lead.current_providers)}
                {field('Monatsbeitrag gesamt (ca.)', lead.monthly_premium)}
              </div>
              {lead.next_renewals && lead.next_renewals.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-2">Nächste Vertragsverlängerungen</p>
                  <div className="flex flex-wrap gap-2">
                    {lead.next_renewals.map((r) => (
                      <span key={r.type} className="text-xs bg-yellow-50 text-yellow-800 border border-yellow-200 px-2.5 py-1 rounded-full">
                        {r.type}: {r.date}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {lead.coverage_gaps && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Lücken / Potenzial</p>
                  <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-3">
                    <p className="text-sm text-red-800">{lead.coverage_gaps}</p>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* GESPRÄCHSHISTORIE */}
          {sectionCard('Gesprächshistorie', (
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              {field('Erstkontakt Datum', lead.first_contact_date ? new Date(lead.first_contact_date).toLocaleDateString('de-DE') : null)}
              {field('Kanal', lead.first_contact_channel)}
              {field('Letzter Kontakt', lead.last_contact_date ? new Date(lead.last_contact_date).toLocaleDateString('de-DE') : null)}
              {field('Anzahl Gespräche', lead.contact_count)}
              {lead.next_contact && (
                <>
                  {field('Nächster Kontakt', new Date(lead.next_contact.date).toLocaleDateString('de-DE'))}
                  {field('Uhrzeit', `${lead.next_contact.time} Uhr`)}
                </>
              )}
            </div>
          ))}

        </div>

        {/* Rechte Spalte (1/3) */}
        <div className="space-y-4">

          {/* Status */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Status</h3>
            <div className="space-y-1.5">
              {(['new', 'contacted', 'qualified', 'customer'] as const).map((s) => (
                <div
                  key={s}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all ${
                    lead.status === s
                      ? `${STATUS_COLORS[s]} ring-2 ring-offset-1 ring-current`
                      : 'text-gray-400 hover:bg-gray-50'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${
                    s === 'new' ? 'bg-blue-400' :
                    s === 'contacted' ? 'bg-yellow-400' :
                    s === 'qualified' ? 'bg-emerald-400' : 'bg-purple-400'
                  }`} />
                  {STATUS_LABELS[s]}
                  {lead.status === s && <span className="ml-auto text-xs">←</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Kontakt */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Kontakt</h3>
            <div className="space-y-2">
              <a href={`tel:${lead.phone_mobile}`} className="flex items-center gap-2 text-sm text-[#1A1A1A] hover:text-[#FFC300] transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13 19.79 19.79 0 0 1 1.61 4.27 2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.08 6.08l1.97-1.97a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                {lead.phone_mobile}
              </a>
              {lead.phone_office && (
                <a href={`tel:${lead.phone_office}`} className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#FFC300] transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                  {lead.phone_office}
                </a>
              )}
              <a href={`mailto:${lead.email}`} className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#FFC300] transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                {lead.email}
              </a>
              {lead.website && (
                <a href={`https://${lead.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#FFC300] transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                  {lead.website}
                </a>
              )}
            </div>
          </div>

          {/* Aktivitäten-Timeline */}
          {lead.activities && lead.activities.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Aktivitäten</h3>
              <div className="space-y-3">
                {lead.activities.map((act, i) => (
                  <div key={act.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-6 h-6 rounded-full bg-[#FFC300]/10 flex items-center justify-center text-[#b88c00] flex-shrink-0">
                        {ACTIVITY_ICONS[act.type] ?? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="4" /></svg>
                        )}
                      </div>
                      {i < (lead.activities?.length ?? 0) - 1 && (
                        <div className="w-px h-full bg-gray-100 mt-1" />
                      )}
                    </div>
                    <div className="pb-3">
                      <p className="text-xs font-medium text-[#1A1A1A]">{act.description}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(act.date).toLocaleDateString('de-DE')},{' '}
                        {new Date(act.date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Gesprächsvorbereitung Modal */}
      {prepModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-[#1A1A1A]">Gesprächsvorbereitung</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  KI-Unterlage für {lead.first_name} {lead.last_name} · erstellt {new Date().toLocaleDateString('de-DE')}
                </p>
              </div>
              <button onClick={() => setPrepModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="space-y-5">
                {aiPrep.split('\n\n').map((block, i) => {
                  const lines = block.split('\n')
                  const title = lines[0].replace(/\*\*/g, '')
                  const content = lines.slice(1).join('\n')
                  return (
                    <div key={i} className="bg-gray-50 rounded-xl p-4">
                      <h3 className="text-sm font-bold text-[#1A1A1A] mb-2 flex items-center gap-2">
                        <span className="w-5 h-5 bg-[#FFC300]/20 rounded text-[#b88c00] flex items-center justify-center text-xs font-bold">
                          {i + 1}
                        </span>
                        {title}
                      </h3>
                      <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                        {content}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setPrepModalOpen(false)}
                className="flex-1 border border-gray-200 text-gray-600 font-medium text-sm px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Schließen
              </button>
              <button className="flex items-center justify-center gap-2 flex-1 bg-[#1A1A1A] hover:bg-[#333] text-white font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Als PDF exportieren
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
