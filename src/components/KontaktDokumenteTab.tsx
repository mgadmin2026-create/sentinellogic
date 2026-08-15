'use client'

import { useState, useCallback, useEffect } from 'react'
import { formatBytes, formatDate } from '@/lib/utils'
import { BeitragsuebersichtUebernahmeForm, type BeitragsuebersichtUebernahmeWerte } from '@/components/BeitragsuebersichtUebernahmeForm'
import type { Zyklus } from '@/lib/beitragsuebersicht-zyklus'
import { findeKategorieFuerSparte } from '@/lib/sparte-kategorie-match'
import {
  DOKUMENTTYP_OPTIONEN,
  DOKUMENTTYP_FILTER_OPTIONEN,
  dokumenttypZuFilter,
  type DokumenttypFilter,
} from '@/lib/dokumenttyp'
import { ANGEBOT_STATUS_OPTIONEN, type AngebotStatus } from '@/lib/angebot-status'

interface Dokument {
  id: string
  file_id: string
  file_name: string
  kategorie?: string
  dokumenttyp?: string | null
  original_size: number
  compressed_size: number
  compression_ratio: number
  created_at: string
}

interface StrukturNode {
  name: string
  children?: StrukturNode[]
}

interface KontaktDokumenteTabProps {
  kontaktId: string
  /** Primäre Sparte des Kontakts (falls vorhanden) — steuert die automatische Vorbelegung der Ablage-Kategorie. */
  primarySparte?: string | null
  /** Öffnet eine vorbefüllte neue Aufgabe (Titel, Fälligkeit in N Tagen) — z.B. für "Angebot nachverfolgen". */
  onCreateFolgeaufgabe?: (titel: string, fälligInTagen: number) => void
  /** Wird nach einer bestätigten Sparten-Zuordnung aufgerufen, damit die übrige Kontaktseite (Sparten-Kachel, Erstgespräch) neu lädt. */
  onSparteZugeordnet?: () => void
  /** Wird nach einer Angebots-Übernahme aufgerufen, damit die Angebote-Kachel neu lädt. */
  onAngebotErstellt?: () => void
}

// Baum des Kontakt-Typs zu waehlbaren Pfaden flachklopfen (max. 2 Ebenen)
function flattenStruktur(nodes: StrukturNode[]): string[] {
  const paths: string[] = []
  for (const node of nodes) {
    paths.push(node.name)
    for (const child of node.children ?? []) {
      paths.push(`${node.name}/${child.name}`)
    }
  }
  return paths
}

export function KontaktDokumenteTab({ kontaktId, primarySparte, onCreateFolgeaufgabe, onSparteZugeordnet, onAngebotErstellt }: KontaktDokumenteTabProps) {
  const [dokumente, setDokumente] = useState<Dokument[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [stats, setStats] = useState({
    count: 0,
    totalSize: 0,
  })
  const [ordnerUrl, setOrdnerUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [kategorien, setKategorien] = useState<string[]>([])
  const [uploadKategorie, setUploadKategorie] = useState('Sonstiges')
  const [filterKategorie, setFilterKategorie] = useState<string>('alle')
  const [filterTyp, setFilterTyp] = useState<DokumenttypFilter>('alle')
  const [typConfirmations, setTypConfirmations] = useState<
    {
      dokumentId: string
      fileName: string
      dokumenttyp: string
      aufgabeStatus: 'idle' | 'angelegt'
      angebotStatus: AngebotStatus
      angebotUebernommen: boolean
    }[]
  >([])
  const [sparteConfirmation, setSparteConfirmation] = useState<{
    name: string
    sparteId: string | null
    rolle: 'primary' | 'zusaetzlich'
    speichert: boolean
  } | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [newFileName, setNewFileName] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [duplicateModal, setDuplicateModal] = useState<{
    duplicate: { id: string; first_name: string; last_name: string; email?: string }
    extracted: { first_name?: string; last_name?: string; email?: string; company_name?: string }
    pendingFile: File
  } | null>(null)
  const [editedName, setEditedName] = useState<{ first_name: string; last_name: string }>({ first_name: '', last_name: '' })
  const [confirming, setConfirming] = useState(false)
  const [beitragsuebersichtModal, setBeitragsuebersichtModal] = useState<{
    sparte: string
    beitrag: string
    versicherungsgesellschaft: string
    vertragsbeginn: string
    vertragsende: string
    werte: BeitragsuebersichtUebernahmeWerte
  } | null>(null)
  const [uebernahmeSpeichern, setUebernahmeSpeichern] = useState(false)

  // Fetch documents on mount
  useEffect(() => {
    loadDokumente()
  }, [kontaktId])

  const loadDokumente = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/kontakte/${kontaktId}/dokumente`, { cache: 'no-store' })
      const data = await res.json()

      if (data.success) {
        setDokumente(data.dokumente || [])
        setOrdnerUrl(data.kontakt.ordner_url || null)
        setStats({
          count: data.kontakt.dokumente_count,
          totalSize: data.kontakt.dokumente_total_size,
        })

        // Ordnerstruktur des Kontakt-Typs laden (privat/gewerbe)
        const typ = data.kontakt.kontakt_typ === 'privat' ? 'privat' : 'gewerbe'
        try {
          const strukturRes = await fetch('/api/dokument-kategorien')
          const strukturData = await strukturRes.json()
          if (strukturData.success) {
            const pfade = flattenStruktur(strukturData.data[typ] || [])
            setKategorien(pfade)
            // Ablage-Kategorie anhand der Kontakt-Sparte vorbelegen (bester Treffer, sonst
            // "Sonstiges") — der Nutzer kann die Vorbelegung jederzeit selbst überschreiben.
            setUploadKategorie(findeKategorieFuerSparte(primarySparte, pfade) ?? 'Sonstiges')
          }
        } catch {
          // Struktur nicht ladbar -> nur "Sonstiges"
        }
      }
    } catch (err) {
      setError('Fehler beim Laden der Dokumente')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleRename = async (dokumentId: string, currentName: string) => {
    setRenamingId(dokumentId)
    setNewFileName(currentName)
  }

  const commitRename = async (dokumentId: string) => {
    if (!newFileName.trim() || newFileName === dokumente.find(d => d.id === dokumentId)?.file_name) {
      setRenamingId(null)
      return
    }

    try {
      const res = await fetch(`/api/kontakte/${kontaktId}/dokumente`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dokumentId, newFileName: newFileName.trim() }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Fehler')
      await loadDokumente()
      setRenamingId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Umbenennen')
    }
  }

  const handleDelete = async (dokumentId: string) => {
    if (confirm('Dokument wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) {
      setDeletingId(dokumentId)
      setError(null)
      try {
        const res = await fetch(`/api/kontakte/${kontaktId}/dokumente`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dokumentId }),
        })
        const data = await res.json()
        if (!data.success) throw new Error(data.error || 'Fehler')
        setWarning(data.driveWarning ? `⚠️ ${data.driveWarning}` : null)
        await loadDokumente()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler beim Löschen')
      } finally {
        setDeletingId(null)
      }
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      uploadFiles(files)
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files
    if (files && files.length > 0) {
      uploadFiles(files)
    }
  }

  const uploadFiles = async (files: FileList) => {
    try {
      setUploading(true)
      setError(null)
      setWarning(null)

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const formData = new FormData()
        formData.append('file', file)
        formData.append('kategorie', uploadKategorie)

        const res = await fetch(`/api/kontakte/${kontaktId}/dokumente`, {
          method: 'POST',
          body: formData,
        })

        // Response einmal auslesen (kann nur einmal gelesen werden)
        const data = await res.json()

        if (!res.ok) {
          if (res.status === 409) {
            throw new Error(
              data?.error ||
                'Google Drive ist noch nicht verbunden. Bitte in Einstellungen → Dokumente verbinden.'
            )
          }
          throw new Error(data?.error || `Upload fehlgeschlagen: ${file.name}`)
        }

        // Duplikat erkannt: Datei wurde NICHT hochgeladen, Modal für Name-Bestätigung zeigen
        if (data.needsConfirmation) {
          setDuplicateModal({
            duplicate: data.nameDuplicate,
            extracted: data.extractedData,
            pendingFile: file,
          })
          setEditedName({
            first_name: data.extractedData?.first_name || '',
            last_name: data.extractedData?.last_name || '',
          })
          return // Nicht weiterfahren, bis User entscheidet
        }

        if (data.analyseWarnung) {
          setWarning(`⚠️ Dokument hochgeladen, aber KI-Analyse fehlgeschlagen: ${data.analyseWarnung}`)
        }

        // Dokumenttyp erkannt: Bestätigungs-/Korrektur-Karte einblenden
        if (data.dokument?.dokumenttyp) {
          setTypConfirmations((prev) => [
            ...prev,
            {
              dokumentId: data.dokument.id,
              fileName: data.dokument.file_name,
              dokumenttyp: data.dokument.dokumenttyp,
              aufgabeStatus: 'idle',
              angebotStatus: 'versendet',
              angebotUebernommen: false,
            },
          ])
        }

        // Vertrag/Angebot erkannt: Übernahme in Beitragsübersicht muss der Nutzer bestätigen
        if (data.beitragsuebersichtVorschlag) {
          const v = data.beitragsuebersichtVorschlag
          setBeitragsuebersichtModal({
            sparte: v.sparte,
            beitrag: v.beitrag,
            versicherungsgesellschaft: v.versicherungsgesellschaft,
            vertragsbeginn: v.vertragsbeginn,
            vertragsende: v.vertragsende,
            werte: { uebernehmen: true, spalte: v.vorschlagSpalte, zyklus: v.erkannterZyklus ?? '' },
          })
        }

        // Sparte erkannt und dem Kontakt noch nicht zugeordnet: Bestätigung einblenden
        if (data.sparteVorschlag) {
          const s = data.sparteVorschlag
          setSparteConfirmation({
            name: s.name,
            sparteId: s.sparteId,
            rolle: s.hatBereitsSparten ? 'zusaetzlich' : 'primary',
            speichert: false,
          })
        }
      }

      // Reload dokumente after successful upload
      await loadDokumente()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload fehlgeschlagen')
      console.error(err)
    } finally {
      setUploading(false)
    }
  }

  const confirmDuplicateUpload = async () => {
    if (!duplicateModal) return
    if (!editedName.first_name.trim() || !editedName.last_name.trim()) {
      setError('Vor- und Nachname erforderlich')
      return
    }

    setConfirming(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', duplicateModal.pendingFile)
      formData.append('kategorie', uploadKategorie)
      formData.append('overrideFirstName', editedName.first_name.trim())
      formData.append('overrideLastName', editedName.last_name.trim())

      const res = await fetch(`/api/kontakte/${kontaktId}/dokumente`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data?.error || 'Upload fehlgeschlagen')
      }

      setDuplicateModal(null)
      await loadDokumente()
      setWarning(`✓ Dokument hochgeladen (Name: ${editedName.first_name} ${editedName.last_name})`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload fehlgeschlagen')
    } finally {
      setConfirming(false)
    }
  }

  const dismissTypConfirmation = (dokumentId: string) => {
    setTypConfirmations((prev) => prev.filter((c) => c.dokumentId !== dokumentId))
  }

  const korrigiereDokumenttyp = async (dokumentId: string, neuerTyp: string) => {
    setTypConfirmations((prev) => prev.map((c) => (c.dokumentId === dokumentId ? { ...c, dokumenttyp: neuerTyp } : c)))
    setDokumente((prev) => prev.map((d) => (d.id === dokumentId ? { ...d, dokumenttyp: neuerTyp } : d)))
    try {
      await fetch(`/api/kontakte/${kontaktId}/dokumente`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dokumentId, dokumenttyp: neuerTyp }),
      })
    } catch (err) {
      setError('Dokumenttyp konnte nicht korrigiert werden')
    }
  }

  const handleAngebotFolgeaufgabe = (dokumentId: string) => {
    onCreateFolgeaufgabe?.('Angebot nachverfolgen', 3)
    dismissTypConfirmation(dokumentId)
  }

  const setAngebotStatusFuer = (dokumentId: string, status: AngebotStatus) => {
    setTypConfirmations((prev) => prev.map((c) => (c.dokumentId === dokumentId ? { ...c, angebotStatus: status } : c)))
  }

  const uebernehmeAlsAngebot = async (c: { dokumentId: string; fileName: string; angebotStatus: AngebotStatus }) => {
    try {
      const name = c.fileName.replace(/\.[^.]+$/, '')
      const res = await fetch('/api/angebote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_id: kontaktId,
          name,
          status: c.angebotStatus,
          dokument_id: c.dokumentId,
          created_by: 'dokument_upload',
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Angebot konnte nicht angelegt werden')
      setTypConfirmations((prev) => prev.map((x) => (x.dokumentId === c.dokumentId ? { ...x, angebotUebernommen: true } : x)))
      onAngebotErstellt?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Angebot konnte nicht angelegt werden')
    }
  }

  const bestaetigeSparteZuordnen = async () => {
    if (!sparteConfirmation) return
    setSparteConfirmation((c) => (c ? { ...c, speichert: true } : c))
    try {
      let sparteId = sparteConfirmation.sparteId
      if (!sparteId) {
        const createRes = await fetch('/api/sparten', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: sparteConfirmation.name }),
        })
        const createData = await createRes.json()
        if (!createData.success) throw new Error(createData.error || 'Sparte konnte nicht angelegt werden')
        sparteId = createData.data.id
      }

      const currentRes = await fetch(`/api/kontakte/${kontaktId}/sparten`, { cache: 'no-store' })
      const currentData = await currentRes.json()
      const currentZuordnung: { is_primary: boolean; sparte: { id: string } }[] = currentData.success ? currentData.data : []
      if (!currentZuordnung.some((z) => z.sparte.id === sparteId)) {
        const sparteIds = [...currentZuordnung.map((z) => z.sparte.id), sparteId]
        const bisherigePrimary = currentZuordnung.find((z) => z.is_primary)?.sparte.id
        const primarySparteId = sparteConfirmation.rolle === 'primary' || !bisherigePrimary ? sparteId : bisherigePrimary
        const putRes = await fetch(`/api/kontakte/${kontaktId}/sparten`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sparteIds, primarySparteId }),
        })
        const putData = await putRes.json()
        if (!putData.success) throw new Error(putData.error || 'Sparte konnte nicht zugeordnet werden')
      }

      setSparteConfirmation(null)
      setWarning(`✓ Sparte „${sparteConfirmation.name}" zugeordnet`)
      onSparteZugeordnet?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sparte konnte nicht zugeordnet werden')
      setSparteConfirmation((c) => (c ? { ...c, speichert: false } : c))
    }
  }

  const confirmBeitragsuebersicht = async () => {
    if (!beitragsuebersichtModal) return
    const { werte } = beitragsuebersichtModal
    if (!werte.uebernehmen || !werte.zyklus) {
      setBeitragsuebersichtModal(null)
      return
    }
    setUebernahmeSpeichern(true)
    setError(null)
    try {
      const res = await fetch(`/api/kontakte/${kontaktId}/beitragsuebersicht/uebernahme`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sparte: beitragsuebersichtModal.sparte,
          beitrag: beitragsuebersichtModal.beitrag,
          betragZyklus: werte.zyklus as Zyklus,
          spalte: werte.spalte,
          versicherungsgesellschaft: beitragsuebersichtModal.versicherungsgesellschaft,
          vertragsbeginn: beitragsuebersichtModal.vertragsbeginn,
          vertragsende: beitragsuebersichtModal.vertragsende,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Übernahme fehlgeschlagen')
      setWarning('✓ Beitrag in Beitragsübersicht übernommen')
      setBeitragsuebersichtModal(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Übernahme fehlgeschlagen')
    } finally {
      setUebernahmeSpeichern(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header with stats */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">📄 Dokumente</h3>
          <p className="text-xs text-gray-500">{stats.count} Dokumente, {formatBytes(stats.totalSize)} gespeichert</p>
        </div>
        {ordnerUrl && (
          <a
            href={ordnerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition"
          >
            📁 Google Drive →
          </a>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          {error}
        </div>
      )}

      {/* Warning message */}
      {warning && (
        <div className="p-3 bg-yellow-50 border border-yellow-300 rounded-lg text-yellow-800 text-sm">
          {warning}
        </div>
      )}

      {/* Ablage-Kategorie + Upload in einer schlanken Zeile statt zwei
          getrennten, hohen Blöcken — spart deutlich vertikalen Platz. */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`flex flex-wrap items-center gap-3 rounded-xl border-2 border-dashed px-4 py-2.5 transition-colors ${
          dragActive ? 'border-yellow-400 bg-yellow-50' : 'border-gray-300 bg-gray-50 hover:border-gray-400'
        }`}
      >
        <label className="flex items-center gap-2 text-sm text-gray-700 whitespace-nowrap">
          <span className="hidden sm:inline">🗂️ Ablegen unter:</span>
          <select
            value={uploadKategorie}
            onChange={(e) => setUploadKategorie(e.target.value)}
            disabled={uploading}
            className="max-w-[10rem] sm:max-w-xs px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400/40 bg-white"
          >
            {kategorien.map((pfad) => (
              <option key={pfad} value={pfad}>
                {pfad.replace('/', ' / ')}
              </option>
            ))}
            <option value="Sonstiges">Sonstiges</option>
          </select>
        </label>

        <span className="text-gray-300 hidden sm:inline">|</span>

        <input
          type="file"
          id="file-input"
          multiple
          onChange={handleFileInput}
          disabled={uploading}
          className="hidden"
        />
        <label
          htmlFor="file-input"
          className="flex-1 min-w-[10rem] cursor-pointer text-sm text-gray-600 hover:text-gray-900"
        >
          {uploading ? (
            <span className="text-yellow-600">⏳ KI analysiert Dokument…</span>
          ) : (
            <>📤 Datei wählen oder hierher ziehen</>
          )}
        </label>
      </div>

      {/* Dokumenttyp-Bestätigung nach Upload */}
      {typConfirmations.map((c) => (
        <div key={c.dokumentId} className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-sm space-y-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-indigo-900">
              📄 <strong className="truncate">{c.fileName}</strong> erkannt als:{' '}
              <select
                value={c.dokumenttyp}
                onChange={(e) => korrigiereDokumenttyp(c.dokumentId, e.target.value)}
                className="px-2 py-1 border border-indigo-300 rounded-lg text-sm bg-white focus:outline-none"
              >
                {DOKUMENTTYP_OPTIONEN.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </span>
            <div className="flex items-center gap-2">
              {c.dokumenttyp === 'angebot' && (
                <button
                  onClick={() => handleAngebotFolgeaufgabe(c.dokumentId)}
                  className="px-2.5 py-1 text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition-colors"
                >
                  + Aufgabe: Angebot nachverfolgen
                </button>
              )}
              <button
                onClick={() => dismissTypConfirmation(c.dokumentId)}
                className="px-2 py-1 text-xs text-indigo-400 hover:text-indigo-700"
                title="Ausblenden"
              >
                ✕
              </button>
            </div>
          </div>

          {c.dokumenttyp === 'angebot' && (
            c.angebotUebernommen ? (
              <p className="text-xs text-indigo-700">✓ Als Angebot in die Angebotsübersicht übernommen</p>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={c.angebotStatus}
                  onChange={(e) => setAngebotStatusFuer(c.dokumentId, e.target.value as AngebotStatus)}
                  className="px-2 py-1 border border-indigo-300 rounded-lg text-xs bg-white focus:outline-none"
                >
                  {ANGEBOT_STATUS_OPTIONEN.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <button
                  onClick={() => uebernehmeAlsAngebot(c)}
                  className="px-2.5 py-1 text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition-colors"
                >
                  Als Angebot übernehmen
                </button>
              </div>
            )
          )}
        </div>
      ))}

      {/* Sparten-Bestätigung nach Upload */}
      {sparteConfirmation && (
        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-sm space-y-2">
          <p className="text-indigo-900">
            🧭 Sparte „{sparteConfirmation.name}" erkannt
            {!sparteConfirmation.sparteId && (
              <span className="text-indigo-600"> (noch nicht in den Einstellungen angelegt, wird beim Übernehmen neu erstellt)</span>
            )}
            {' '}— diesem Kontakt zuordnen?
          </p>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 text-xs text-indigo-800">
                <input
                  type="radio"
                  checked={sparteConfirmation.rolle === 'primary'}
                  onChange={() => setSparteConfirmation((c) => (c ? { ...c, rolle: 'primary' } : c))}
                />
                Als Hauptsparte
              </label>
              <label className="flex items-center gap-1.5 text-xs text-indigo-800">
                <input
                  type="radio"
                  checked={sparteConfirmation.rolle === 'zusaetzlich'}
                  onChange={() => setSparteConfirmation((c) => (c ? { ...c, rolle: 'zusaetzlich' } : c))}
                />
                Als zusätzliche Sparte
              </label>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={bestaetigeSparteZuordnen}
                disabled={sparteConfirmation.speichert}
                className="px-2.5 py-1 text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition-colors"
              >
                {sparteConfirmation.speichert ? 'Wird zugeordnet…' : 'Übernehmen'}
              </button>
              <button
                onClick={() => setSparteConfirmation(null)}
                disabled={sparteConfirmation.speichert}
                className="px-2 py-1 text-xs text-indigo-400 hover:text-indigo-700"
                title="Ausblenden"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Documents list */}
      {loading ? (
        <div className="text-center py-8 text-gray-600">Wird geladen...</div>
      ) : dokumente.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-600">Keine Dokumente vorhanden</p>
          <p className="text-sm text-gray-500 mt-1">Laden Sie Ihr erstes Dokument oben hoch</p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-gray-900">
                📋 Alle Dokumente ({dokumente.length})
              </p>
              <select
                value={filterKategorie}
                onChange={(e) => setFilterKategorie(e.target.value)}
                className="px-2 py-1 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none"
              >
                <option value="alle">Alle Kategorien</option>
                {Array.from(new Set(dokumente.map((d) => d.kategorie || 'Sonstiges'))).sort().map((k) => (
                  <option key={k} value={k}>{k.replace('/', ' / ')}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {DOKUMENTTYP_FILTER_OPTIONEN.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setFilterTyp(o.value)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    filterTyp === o.value
                      ? 'bg-gray-900 text-white'
                      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div className="divide-y divide-gray-150">
            {dokumente
              .filter((doc) => filterKategorie === 'alle' || (doc.kategorie || 'Sonstiges') === filterKategorie)
              .filter((doc) => filterTyp === 'alle' || dokumenttypZuFilter(doc.dokumenttyp) === filterTyp)
              .map((doc) => (
              <div key={doc.id} className="px-4 py-2 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  {renamingId === doc.id ? (
                    <div className="flex-1 flex items-center gap-2 min-w-0">
                      <input
                        type="text"
                        value={newFileName}
                        onChange={(e) => setNewFileName(e.target.value)}
                        className="flex-1 min-w-0 px-2 py-1 text-sm border border-yellow-300 rounded focus:outline-none focus:ring-2 focus:ring-yellow-400"
                        autoFocus
                      />
                      <button
                        onClick={() => commitRename(doc.id)}
                        className="px-2 py-1 text-xs font-semibold bg-green-100 text-green-700 hover:bg-green-200 rounded"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => setRenamingId(null)}
                        className="px-2 py-1 text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 rounded"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center gap-2 min-w-0">
                      <a
                        href={`https://drive.google.com/file/d/${doc.file_id}/view`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-gray-900 truncate hover:text-blue-600 hover:underline"
                        title="In Google Drive öffnen"
                      >
                        📄 {doc.file_name}
                      </a>
                      <button
                        onClick={() => handleRename(doc.id, doc.file_name)}
                        className="flex-shrink-0 text-xs text-gray-400 hover:text-gray-700"
                        title="Umbenennen"
                      >
                        ✏️
                      </button>
                      <span className="inline-flex flex-shrink-0 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                        {(doc.kategorie || 'Sonstiges').replace('/', ' / ')}
                      </span>
                    </div>
                  )}

                  <select
                    value={doc.dokumenttyp || ''}
                    onChange={(e) => korrigiereDokumenttyp(doc.id, e.target.value)}
                    className="flex-shrink-0 px-2 py-1 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400/40"
                  >
                    <option value="">— nicht klassifiziert —</option>
                    {DOKUMENTTYP_OPTIONEN.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>

                  <p className="flex-shrink-0 text-xs text-gray-500 whitespace-nowrap">
                    {formatDate(doc.created_at)}
                  </p>

                  <button
                    onClick={() => handleDelete(doc.id)}
                    disabled={deletingId === doc.id}
                    className="flex-shrink-0 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 rounded transition"
                    title="Löschen"
                  >
                    {deletingId === doc.id ? '⏳' : '🗑️'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Duplicate Modal */}
      {duplicateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">⚠️ Kontakt-Duplikat erkannt</h2>
              <p className="text-sm text-gray-600 mt-2">
                Die Datei wurde noch <strong>nicht</strong> hochgeladen. Ein Kontakt mit dem im Dokument erkannten Namen existiert bereits:
              </p>
              <p className="text-sm font-semibold text-gray-900 mt-2">
                {duplicateModal.duplicate.first_name} {duplicateModal.duplicate.last_name}
                {duplicateModal.duplicate.email && ` (${duplicateModal.duplicate.email})`}
              </p>
            </div>

            <div className="border-t pt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Extrahierter Name (änderbar):
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editedName.first_name}
                    onChange={(e) => setEditedName({ ...editedName, first_name: e.target.value })}
                    placeholder="Vorname"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  />
                  <input
                    type="text"
                    value={editedName.last_name}
                    onChange={(e) => setEditedName({ ...editedName, last_name: e.target.value })}
                    placeholder="Nachname"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <button
                onClick={() => setDuplicateModal(null)}
                disabled={confirming}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-300 transition disabled:opacity-50"
              >
                Abbrechen
              </button>
              <button
                onClick={confirmDuplicateUpload}
                disabled={confirming}
                className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg transition"
              >
                {confirming ? '⏳ Wird hochgeladen…' : 'Trotzdem hochladen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Beitragsübersicht-Übernahme Modal */}
      {beitragsuebersichtModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">📊 Beitragsübersicht</h2>
              <p className="text-sm text-gray-600 mt-2">
                Im Dokument wurde ein Beitrag erkannt. Soll er in die Beitragsübersicht dieses Kontakts übernommen werden?
              </p>
            </div>

            <BeitragsuebersichtUebernahmeForm
              werte={beitragsuebersichtModal.werte}
              onChange={(werte) => setBeitragsuebersichtModal((m) => (m ? { ...m, werte } : m))}
              sparte={beitragsuebersichtModal.sparte}
              beitragText={beitragsuebersichtModal.beitrag}
            />

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setBeitragsuebersichtModal(null)}
                disabled={uebernahmeSpeichern}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-300 transition disabled:opacity-50"
              >
                Überspringen
              </button>
              <button
                onClick={confirmBeitragsuebersicht}
                disabled={uebernahmeSpeichern || (beitragsuebersichtModal.werte.uebernehmen && !beitragsuebersichtModal.werte.zyklus)}
                className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 rounded-lg transition"
              >
                {uebernahmeSpeichern ? '⏳ Wird gespeichert…' : 'Übernehmen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
