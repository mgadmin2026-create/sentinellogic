# Google Drive Dokumente-Integration — Konzept

**Status:** Konzipiert, noch nicht implementiert  
**Ziel:** Sichere, organisierte Dokument-Verwaltung mit KI-Suche (Phase 2)  
**Anfang:** Q3 2026

---

## 📋 Anforderungen

### Funktional
1. ✅ Jeder Kontakt → eigener Google Drive Ordner (`kontakt-ID_Name/`)
2. ✅ Drag & Drop Upload in Kontakt-Tab "Dokumente"
3. ✅ Alle Dokumente anzeigen in `/dokumente` Hauptseite
4. ✅ Automatische Datei-Komprimierung (30-40% Reduktion, mittel Level)
5. ✅ Ordner-Verwaltung (Archiv bei Kontakt-Löschung, Auto-Restore bei Recovery)
6. 🔮 KI-Suche: "Zeige mir Versicherungs-Police für Kontakt XYZ" (Phase 2)

### Nicht-funktional
- Google Drive native Permissions für Team-Zugriff
- Prozentuale Komprimierung (keine absoluten Limits)
- Auto-Recovery von archivierten Ordnern

---

## 🗂️ Google Drive Struktur

```
Root Ordner (GOOGLE_DRIVE_FOLDER_ID)
│
├── kontakt-12345_Musterfirma GmbH/
│   ├── 📄 police.pdf (original: 8MB → compressed: 5MB)
│   ├── 📄 rechnung-2026-01.pdf
│   ├── 🖼️ scan-dokument.jpg
│   └── 📝 notizen.docx
│
├── kontakt-67890_Beispiel AG/
│   └── 📄 vertrag.pdf
│
└── Archiv/
    ├── kontakt-11111_AlterKontakt/ (archived: 2026-01-15)
    │   └── 📄 alte_police.pdf
    └── kontakt-22222_GelöschtesFirma/ (archived: 2026-02-20)
        └── 📄 final_doc.pdf
```

---

## 📱 UI-Komponenten

### 1. Kontakt-Tab "Dokumente"
```
┌─────────────────────────────────────┐
│ 📄 Dokumente (3)                    │
├─────────────────────────────────────┤
│                                     │
│  [📁 Ordner öffnen in GDrive]       │
│                                     │
│  ╔═══════════════════════════════╗  │
│  ║ Datei hochladen               ║  │ ← Drag & Drop Zone
│  ║ (oder klicken zum Auswählen)  ║  │
│  ╚═══════════════════════════════╝  │
│                                     │
│  📄 police.pdf          5 MB  ✓     │
│  📄 rechnung.pdf        2 MB  ✓     │
│  🖼️ scan.jpg            1.5 MB ✓    │
│                                     │
└─────────────────────────────────────┘
```

### 2. Hauptseite "/dokumente"
```
┌──────────────────────────────────────────┐
│ 📚 Dokumente (45 gesamt)                 │
├──────────────────────────────────────────┤
│ [Kontakt 🔽] [Dateityp 🔽] [Suche..]   │
├──────────────────────────────────────────┤
│                                          │
│ 📄 police.pdf           Musterfirma GmbH │
│    5 MB · 2026-01-10 · Kompression: 37% │
│                                          │
│ 📄 rechnung.pdf         Musterfirma GmbH │
│    2 MB · 2026-01-05                     │
│                                          │
│ 🖼️ scan.jpg             Beispiel AG      │
│    1.5 MB · 2026-01-08                   │
│                                          │
└──────────────────────────────────────────┘
```

---

## ⚙️ Workflows

### Workflow 1: Dokument-Upload

```
1. User zieht Datei in Kontakt-Tab
   ↓
2. Sentinel prüft Ordner in GDrive:
   ├─ Existiert aktiv? → nutze
   ├─ Existiert archiviert? → RESTORE (aus Archiv zurück)
   └─ Nicht vorhanden? → CREATE mit Name "kontakt-ID_Kontaktname"
   ↓
3. KOMPRIMIERUNG (alle Dateitypen):
   ├─ PDF: pdfjs/pdf-lib
   ├─ Bilder (JPG/PNG/WebP): sharp
   ├─ Word/Excel: streaming compress
   └─ Ziel: 30-40% Größenreduktion
   ↓
4. Upload komprimierte Datei zu Google Drive
   ↓
5. Speichere Metadaten in DB:
   ├─ file_id (GDrive ID)
   ├─ file_name
   ├─ original_size (8 MB)
   ├─ compressed_size (5 MB)
   ├─ compression_ratio (37.5%)
   └─ kontakt_id, ordner_id, created_at
   ↓
6. ✅ Dokument in Kontakt-Tab sichtbar
```

### Workflow 2: Kontakt-Löschung

```
1. User löscht Kontakt
   ↓
2. Sentinel markiert Kontakt als "deleted"
   ↓
3. Google Drive Ordner ARCHIVIEREN:
   └─ Verschiebe Ordner von Root → "Archiv/" Folder
   ↓
4. DB aktualisieren:
   ├─ ordner_archived = true
   └─ kontakt_deleted_at = NOW()
   ↓
5. Ordner & Dokumente bleiben erhalten (Backup)
```

### Workflow 3: Kontakt-Recovery (Reaktivierung)

```
1. User reaktiviert gelöschten Kontakt
   ↓
2. Sentinel prüft:
   ├─ Existiert archivierter Ordner?
   │  └─ JA: RESTORE (verschiebe aus Archiv zu Root)
   └─ NEIN: CREATE neuer Ordner
   ↓
3. DB aktualisieren:
   ├─ ordner_archived = false
   └─ kontakt_deleted_at = NULL
   ↓
4. ✅ Kontakt + alle alten Dokumente wieder sichtbar
```

---

## 🗄️ Database Schema

### Neue Tabelle: `dokumente_metadata`

```sql
CREATE TABLE dokumente_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Zuordnung
  kontakt_id UUID NOT NULL REFERENCES contacts(id),
  ordner_id TEXT NOT NULL,  -- Google Drive Folder ID
  ordner_name TEXT NOT NULL,  -- z.B. "kontakt-12345_Musterfirma"
  
  -- Datei-Info
  file_id TEXT NOT NULL,  -- Google Drive File ID
  file_name TEXT NOT NULL,
  file_type TEXT,  -- MIME type oder Extension
  
  -- Größen & Komprimierung
  original_size INTEGER,  -- Bytes
  compressed_size INTEGER,  -- Bytes nach Komprimierung
  compression_ratio NUMERIC(5, 2),  -- 37.5 = 37.5% Ersparnis
  
  -- Status
  ordner_archived BOOLEAN DEFAULT false,
  kontakt_deleted_at TIMESTAMP,  -- Wann wurde Kontakt gelöscht?
  
  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  created_by TEXT,
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT file_id_unique UNIQUE(file_id),
  INDEX idx_kontakt_id (kontakt_id),
  INDEX idx_ordner_id (ordner_id),
  INDEX idx_ordner_archived (ordner_archived)
);
```

### Erweiterung: `contacts` Tabelle

```sql
ALTER TABLE contacts ADD COLUMN (
  google_drive_ordner_id TEXT,  -- Folder ID
  google_drive_ordner_name TEXT,  -- "kontakt-ID_Name"
  dokumente_count INTEGER DEFAULT 0,
  dokumente_total_size INTEGER DEFAULT 0,  -- Bytes (nach Komprimierung)
  dokumente_last_upload TIMESTAMP
);
```

---

## 📡 API Endpoints

### Upload Dokument
```
POST /api/kontakte/[id]/dokumente
Content-Type: multipart/form-data

Request:
- file: <binary> (any type)
- description?: string (optional)

Response:
{
  "success": true,
  "dokument": {
    "id": "uuid",
    "file_id": "google-drive-id",
    "file_name": "police.pdf",
    "original_size": 8388608,
    "compressed_size": 5242880,
    "compression_ratio": 37.5,
    "created_at": "2026-01-10T14:22:00Z"
  }
}
```

### Liste Dokumente pro Kontakt
```
GET /api/kontakte/[id]/dokumente

Response:
{
  "success": true,
  "ordner": {
    "id": "google-drive-id",
    "name": "kontakt-12345_Musterfirma",
    "archived": false
  },
  "dokumente": [
    {
      "id": "uuid",
      "file_name": "police.pdf",
      "compressed_size": 5242880,
      "compression_ratio": 37.5,
      "created_at": "2026-01-10"
    }
  ],
  "total": 3,
  "total_size": 8388608
}
```

### Alle Dokumente (mit Filter)
```
GET /api/dokumente?kontakt_id=&dateityp=&search=

Response:
{
  "dokumente": [
    {
      "id": "uuid",
      "file_name": "police.pdf",
      "kontakt_id": "kontakt-12345",
      "kontakt_name": "Musterfirma GmbH",
      "compressed_size": 5242880,
      "created_at": "2026-01-10"
    }
  ],
  "total": 45,
  "compression_total_saved": 1073741824  -- 1 GB gespart
}
```

### Dokument löschen
```
DELETE /api/kontakte/[id]/dokumente/[file_id]

Response:
{
  "success": true,
  "message": "Dokument gelöscht"
}
```

---

## 🛠️ Technische Details

### Komprimierung-Strategie

| Dateityp | Tool | Reduktion | Qualität | Notizen |
|----------|------|-----------|----------|---------|
| PDF | pdfjs/pdf-lib | 30-40% | Sehr gut | Bilder komprimieren, Metadaten löschen |
| JPG/PNG | sharp | 30-40% | Gut | WebP konvertieren, Qualität 70-80% |
| WebP | sharp | 15-25% | Sehr gut | Nur leichte Komprimierung |
| GIF | sharp | 20-30% | Akzeptabel | Zu WEBP konvertieren |
| Word/Excel | zlib | 40-60% | Perfekt | Zippen, sind ja ZIPs |
| Text (TXT, CSV) | gzip | 50-80% | Perfekt | Text komprimiert sehr gut |

### Libraries
```json
{
  "pdf-lib": "^1.17.1",  // PDF Manipulation
  "pdfjs-dist": "^3.0.0",  // PDF Rendering/Parsing
  "sharp": "^0.32.0",  // Image Komprimierung
  "zlib": "built-in",  // Generische Komprimierung
  "googleapis": "^118.0.0"  // Google Drive API
}
```

---

## 🔐 Google Drive Setup

### Service Account benötigt:
1. Google Cloud Projekt erstellen
2. Google Drive API aktivieren
3. Service Account erstellen
4. JSON Key herunterladen → `GOOGLE_SERVICE_ACCOUNT_KEY`
5. Root Folder mit Service Account teilen

### Permissions:
- Service Account: `editor` auf Root Folder
- Kontakt-Ordner: Team-Mitglieder via Google Drive Sharing
- Archiv-Ordner: `viewer` oder `editor` (User-abhängig)

---

## ⚠️ Error Handling

| Fehler | Status | Aktion |
|--------|--------|--------|
| File zu groß (>500MB) | 413 | Ablehnen, User informieren |
| GDrive API Fehler | 500 | Retry mit Exponential Backoff |
| Ordner-Erstellung schlägt fehl | 500 | Rollback, neu versuchen |
| Komprimierung schlägt fehl | 400 | Datei unverarbeitet speichern |
| Archiv-Ordner existiert nicht | 500 | Auto-erstellen |

---

## 📊 Phase 2: KI-Suche

**Später (Q4 2026):**
- OCR auf Bildern/PDFs → Fulltext-Index
- pgvector Embeddings von Dokumenten-Inhalten
- Natural Language Query: "Zeige mir Police zu Haftpflicht"
- Crosstalk mit Kontakt-Metadaten: "von Kontakt XYZ"

---

## 🚀 Implementation Roadmap

### Sprint 1: Core Upload & Verwaltung
- [ ] DB Schema (dokumente_metadata Tabelle)
- [ ] Google Service Account Setup
- [ ] Upload Endpoint + Komprimierung
- [ ] Ordner Auto-Erstellung (Lazy)
- [ ] Kontakt-Tab "Dokumente" UI

### Sprint 2: Archivierung & Recovery
- [ ] Archive-Ordner Logik
- [ ] Kontakt-Löschung → Archivierung
- [ ] Auto-Restore bei Recovery
- [ ] Archiv-Status Tracking

### Sprint 3: Globale Dokumente-Seite
- [ ] GET /api/dokumente mit Filter
- [ ] UI `/dokumente` mit Search/Filter
- [ ] Komprimierungs-Statistiken anzeigen

### Phase 2: KI-Suche (später)
- [ ] OCR Implementation
- [ ] pgvector Embeddings
- [ ] Natural Language Query
- [ ] Kontakt-Crossreferencing

---

## 📝 Notizen

- **Migrationen:** Bestehende Kontakte-Ordner? Lazy Approach spart Arbeit
- **Versioning:** Momentan keine Versioning (v1, v2, etc.) - nur neue Dateien
- **Sharing:** Google Drive native Permissions nutzen (weniger Code)
- **Backup:** Google Drive ist schon Backup, aber 30-Tage Trash für Recovery
