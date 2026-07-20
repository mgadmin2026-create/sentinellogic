'use client'
// Gemeinsames CSV-Import-Modal für Kontakte — genutzt von /dashboard und /kontakte
import { useRef, useState } from 'react'

// Spalten-Mapping für CSV-Import — alle mappbaren Kontaktfelder, gruppiert.
// Bewusst ausgeschlossen: system-/sync-verwaltete Felder (id, created_at, is_test_data,
// test_run_id, archived_at, klicktipp_*/dialfire_* Sync-Ausgabefelder außer den beiden
// echten Konfigurationsfeldern, pipeline_stage/pipeline_steps, Google-Drive-/Dokumente-
// Zählfelder, AMIS-Felder, automation_disabled).
const SYSTEM_FIELDS: { value: string; label: string; group: string }[] = [
  // Kontakt
  { value: 'first_name', label: 'Vorname', group: 'Kontakt' },
  { value: 'last_name', label: 'Nachname', group: 'Kontakt' },
  { value: 'email', label: 'E-Mail', group: 'Kontakt' },
  { value: 'phone_mobile', label: 'Telefon Mobil', group: 'Kontakt' },
  { value: 'phone_office', label: 'Telefon Büro', group: 'Kontakt' },
  { value: 'anrede', label: 'Anrede', group: 'Kontakt' },

  // Firma
  { value: 'company_name', label: 'Firma', group: 'Firma' },
  { value: 'industry', label: 'Branche', group: 'Firma' },
  { value: 'position', label: 'Position', group: 'Firma' },
  { value: 'website', label: 'Website', group: 'Firma' },
  { value: 'jahresumsatz', label: 'Jahresumsatz', group: 'Firma' },
  { value: 'mitarbeitanzahl', label: 'Mitarbeiteranzahl', group: 'Firma' },
  { value: 'rechtsform', label: 'Rechtsform', group: 'Firma' },
  { value: 'versicherungstyp', label: 'Versicherungstyp', group: 'Firma' },

  // Adresse
  { value: 'street', label: 'Straße', group: 'Adresse' },
  { value: 'hausnummer', label: 'Hausnummer', group: 'Adresse' },
  { value: 'postal_code', label: 'PLZ', group: 'Adresse' },
  { value: 'city', label: 'Ort', group: 'Adresse' },
  { value: 'country', label: 'Land', group: 'Adresse' },

  // Klassifikation
  { value: 'source', label: 'Quelle', group: 'Klassifikation' },
  { value: 'status', label: 'Status', group: 'Klassifikation' },
  { value: 'kontakt_typ', label: 'Kontakt-Typ', group: 'Klassifikation' },
  { value: 'sparte', label: 'Sparte', group: 'Klassifikation' },
  { value: 'qualität', label: 'Qualität', group: 'Klassifikation' },
  { value: 'bestandskunde', label: 'Bestandskunde', group: 'Klassifikation' },
  { value: 'prüfung_grund', label: 'Prüfungsgrund', group: 'Klassifikation' },

  // Notizen
  { value: 'notes', label: 'Notizen', group: 'Notizen' },
  { value: 'bemerkung', label: 'Bemerkung', group: 'Notizen' },
  { value: 'notizen_2', label: 'Notizen 2', group: 'Notizen' },

  // Person (PKV)
  { value: 'geburtstag', label: 'Geburtstag', group: 'Person (PKV)' },
  { value: 'geschlecht', label: 'Geschlecht', group: 'Person (PKV)' },
  { value: 'jahreseinkommen', label: 'Jahreseinkommen', group: 'Person (PKV)' },
  { value: 'groesse', label: 'Größe', group: 'Person (PKV)' },
  { value: 'gewicht', label: 'Gewicht', group: 'Person (PKV)' },
  { value: 'gesundheitszustand', label: 'Gesundheitszustand', group: 'Person (PKV)' },
  { value: 'seit_wann_selbststaendig', label: 'Selbstständig seit', group: 'Person (PKV)' },
  { value: 'dienstverhaltnis', label: 'Dienstverhältnis', group: 'Person (PKV)' },
  { value: 'krankenversicherung_status', label: 'Krankenversicherungsstatus', group: 'Person (PKV)' },
  { value: 'situation', label: 'Situation', group: 'Person (PKV)' },

  // Gewerbe
  { value: 'versicherungsgesellschaft', label: 'Versicherungsgesellschaft', group: 'Gewerbe' },
  { value: 'zahlweise', label: 'Zahlweise', group: 'Gewerbe' },
  { value: 'kontoinhaber', label: 'Kontoinhaber', group: 'Gewerbe' },
  { value: 'iban', label: 'IBAN', group: 'Gewerbe' },
  { value: 'inhaltssumme', label: 'Inhaltssumme', group: 'Gewerbe' },
  { value: 'beitrag_vorsorge', label: 'Beitrag Vorsorge', group: 'Gewerbe' },
  { value: 'geburtstag_gf_inhaber', label: 'Geburtstag GF/Inhaber', group: 'Gewerbe' },
  { value: 'geschaeftsfuehrer_anzahl', label: 'Anzahl Geschäftsführer', group: 'Gewerbe' },
  { value: 'seit_wann_gewerbe', label: 'Gewerbe seit', group: 'Gewerbe' },

  // Versicherung 1-5
  ...[1, 2, 3, 4, 5].flatMap((n) => [
    { value: `versicherungsgesellschaft_${n}`, label: `Versicherungsgesellschaft ${n}`, group: `Versicherung ${n}` },
    { value: `leistungen_${n}`, label: `Leistungen ${n}`, group: `Versicherung ${n}` },
    { value: `aktueller_beitrag_${n}`, label: `Aktueller Beitrag ${n}`, group: `Versicherung ${n}` },
    { value: `kontoinhaber_${n}`, label: `Kontoinhaber ${n}`, group: `Versicherung ${n}` },
    { value: `iban_${n}`, label: `IBAN ${n}`, group: `Versicherung ${n}` },
  ]),

  // Konfiguration
  { value: 'dialfire_campaign_id', label: 'Dialfire-Kampagnen-ID', group: 'Konfiguration' },
  { value: 'dialfire_task_name_field', label: 'Dialfire-Task-Namensfeld', group: 'Konfiguration' },
]

const FIELD_GROUPS = Array.from(new Set(SYSTEM_FIELDS.map((f) => f.group)))

interface KontaktImportModalProps {
  isOpen: boolean
  onClose: () => void
  onImported: () => void
}

export function KontaktImportModal({ isOpen, onClose, onImported }: KontaktImportModalProps) {
  const [dragOver, setDragOver] = useState(false)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvPreview, setCsvPreview] = useState<string[][]>([])
  const [csvAllRows, setCsvAllRows] = useState<string[][]>([])
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [importDone, setImportDone] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [importCount, setImportCount] = useState(0)
  const [importDuplicates, setImportDuplicates] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  function parseCSV(text: string) {
    const lines = text.trim().split('\n')
    return lines.map((line) => line.split(',').map((v) => v.trim().replace(/^"|"$/g, '')))
  }

  function handleFile(file: File) {
    setCsvFile(file)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const rows = parseCSV(text)
      const headers = rows[0] ?? []
      const dataRows = rows.slice(1).filter((r) => r.some((c) => c.trim()))
      setCsvHeaders(headers)
      setCsvPreview(dataRows.slice(0, 3))
      setCsvAllRows(dataRows)
      // Auto-Mapping: CSV-Header auf System-Felder mappen
      const autoMap: Record<string, string> = {}
      headers.forEach((h) => {
        const match = SYSTEM_FIELDS.find(
          (f) => f.label.toLowerCase() === h.toLowerCase()
        )
        autoMap[h] = match?.value ?? 'ignore'
      })
      setMapping(autoMap)
    }
    reader.readAsText(file, 'UTF-8')
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  async function handleImport() {
    if (csvAllRows.length === 0) return
    setImportLoading(true)
    let count = 0
    let duplicates = 0
    const createdIds: string[] = []
    const createdNames: string[] = []

    // Alle Zeilen mit Duplikatprüfung in DB schreiben
    for (const row of csvAllRows) {
      const lead: Record<string, string> = {}
      csvHeaders.forEach((header, i) => {
        const field = mapping[header]
        if (field && field !== 'ignore') lead[field] = row[i]?.trim() ?? ''
      })
      if (!lead.first_name || !lead.last_name) continue
      if (!lead.source) lead.source = 'csv'

      try {
        const res = await fetch('/api/kontakte', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(lead),
        })
        const data = await res.json()
        if (res.status === 409 && data.duplicate) {
          duplicates++
        } else if (res.ok && data.success) {
          count++
          createdIds.push(data.data.id)
          createdNames.push(`${data.data.first_name} ${data.data.last_name}`)
        }
      } catch { /* einzelne Fehler überspringen */ }
    }

    // Sync-Log Eintrag schreiben
    const status = duplicates > 0 && count === 0 ? 'warning' : 'success'
    const message = duplicates > 0
      ? `${count} importiert, ${duplicates} Duplikat${duplicates > 1 ? 'e' : ''} übersprungen`
      : `${count} Leads aus CSV importiert`

    fetch('/api/sync-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'CSV-Import',
        count, duplicates_skipped: duplicates,
        status, message,
        lead_ids: createdIds,
        lead_names: createdNames,
      }),
    }).catch(() => {})

    setImportCount(count)
    setImportDuplicates(duplicates)
    setImportLoading(false)
    setImportDone(true)
    onImported()
  }

  function closeModal() {
    setCsvFile(null)
    setCsvPreview([])
    setCsvHeaders([])
    setMapping({})
    setImportDone(false)
    setImportDuplicates(0)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Kontakte importieren (CSV)</h2>
          <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {!importDone ? (
            <>
              {/* Drag & Drop Zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                  dragOver
                    ? 'border-yellow-400 bg-yellow-400/5'
                    : csvFile
                    ? 'border-emerald-400 bg-emerald-50'
                    : 'border-gray-300 hover:border-yellow-400 hover:bg-gray-50'
                }`}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
                />
                {csvFile ? (
                  <div>
                    <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <p className="font-semibold text-gray-900">{csvFile.name}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{csvPreview.length + 1} Zeilen erkannt</p>
                  </div>
                ) : (
                  <div>
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                    </div>
                    <p className="font-medium text-gray-900">CSV-Datei hier ablegen oder klicken</p>
                    <p className="text-sm text-gray-400 mt-1">Unterstützt: .csv mit Komma-Trennung</p>
                  </div>
                )}
              </div>

              {/* Beispiel-CSV Download */}
              <a
                href="/leads-beispiel.csv"
                download
                className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Beispiel-CSV herunterladen
              </a>

              {/* Vorschau erste 3 Zeilen */}
              {csvPreview.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Vorschau (erste 3 Zeilen)</h3>
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          {csvHeaders.map((h) => (
                            <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvPreview.map((row, i) => (
                          <tr key={i} className="border-t border-gray-100">
                            {row.map((cell, j) => (
                              <td key={j} className="px-3 py-2 text-gray-700">{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Spalten-Mapping */}
              {csvHeaders.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Spalten zuordnen</h3>
                  <div className="space-y-2">
                    {csvHeaders.map((h) => (
                      <div key={h} className="flex items-center gap-3">
                        <span className="text-sm text-gray-600 w-32 flex-shrink-0 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200 truncate">
                          {h}
                        </span>
                        <svg width="14" height="14" className="text-gray-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                        <select
                          value={mapping[h] ?? 'ignore'}
                          onChange={(e) => setMapping({ ...mapping, [h]: e.target.value })}
                          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400/40"
                        >
                          <option value="ignore">— ignorieren —</option>
                          {FIELD_GROUPS.map((group) => (
                            <optgroup key={group} label={group}>
                              {SYSTEM_FIELDS.filter((f) => f.group === group).map((f) => (
                                <option key={f.value} value={f.value}>{f.label}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Import Button */}
              <div className="flex gap-3 pt-2">
                <button onClick={closeModal} className="flex-1 border border-gray-200 text-gray-600 font-medium text-sm px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors">
                  Abbrechen
                </button>
                <button
                  onClick={handleImport}
                  disabled={!csvFile || importLoading}
                  className="flex-1 bg-yellow-400 hover:bg-yellow-500 disabled:opacity-40 disabled:cursor-not-allowed text-gray-900 font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors"
                >
                  {importLoading
                    ? 'Importiere…'
                    : `${csvAllRows.length} Leads importieren`}
                </button>
              </div>
            </>
          ) : (
            // Erfolgsmeldung
            <div className="text-center py-10">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {importCount} Leads importiert
              </h3>
              <p className="text-gray-500 text-sm mb-3">
                Leads übernommen und Automatisierungsregeln ausgeführt.
              </p>
              {importDuplicates > 0 && (
                <p className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 mb-4">
                  ⚠️ {importDuplicates} Duplikat{importDuplicates > 1 ? 'e' : ''} übersprungen — bereits im System vorhanden
                </p>
              )}
              <button
                onClick={closeModal}
                className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors"
              >
                Fertig
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
