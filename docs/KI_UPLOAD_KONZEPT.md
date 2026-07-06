# KI-Upload-Konzept (rekonstruiert aus Planungs-Session Juni 2026)

> Status: Konzept — noch nicht implementiert. Wiederhergestellt am 2026-07-06.

# Plan: KI Assistent für Versicherungs-Dokument-Upload & Auto-Kontakt-Erstellung

---

# Plan: KI Assistent für Versicherungs-Dokument-Upload & Auto-Kontakt-Erstellung

## Kontext

**Ziel:** KI-gestützte Upload-Funktion für Versicherungs-Policen/Angebote (PDF, CSV, Excel).
- Dokumente hochladen
- Claude KI extrahiert Versicherungs-Daten automatisch
- Neue Kontakte werden erstellt (Duplikate überspringen)
- Automationen triggern (KlickTipp sync, Tagging, etc.)
- Chat-ähnliche UI für Benutzer-Feedback

**Nutzen:** Maschinelle Datenextraktion statt manueller Dateneingabe → 10x schneller.

**Architektur:**
- Neue Seite: `/ki-assistent` (Chat-Interface)
- Neuer Endpoint: `/api/ki-assistent/upload` (File-Parsing + Claude API)
- Bulk-Kontakt-Erstellung mit Automations-Integration
- Activity-Logging für Audit-Trail

---

## Versicherungs-Felder (relevante Daten)

Claude soll folgende Felder aus Policen extrahieren:

| Feld | Zuordnung | Pflicht? |
|------|-----------|---------|
| Versicherter Name | `first_name` + `last_name` | ✓ |
| E-Mail | `email` | ✗ (optional) |
| Telefon | `phone_mobile` | ✗ |
| Straße | `street` | ✗ |
| PLZ | `postcode` | ✗ |
| Stadt | `city` | ✗ |
| Land | `country` | ✗ |
| **Versicherungsnummer** | `policy_number` (neue DB-Spalte) | ✓ |
| **Versicherungstyp** | `insurance_type` (z.B. "KFZ", "Haftpflicht", "Krankenversicherung") (neue DB-Spalte) | ✓ |
| **Prämie/Jahresbeitrag** | `premium_amount` (neue DB-Spalte) | ✗ |
| **Kundennummer** | `customer_id_insurance` (neue DB-Spalte) | ✗ |
| **Versicherungsbeginn** | `policy_start_date` (neue DB-Spalte) | ✗ |
| **Versicherungsende** | `policy_end_date` (neue DB-Spalte) | ✗ |
| **Makler/Vermittler** | `broker_name` | ✗ |

**Duplikat-Handling:** Wenn Email + Name existiert → **Überspringen** (keinen neuen Kontakt erstellen)

---

## Dateien zu modifizieren / erstellen

### 🆕 NEUE DATEIEN

**1. Seite: `/src/app/ki-assistent/page.tsx`**
- Chat-ähnliche UI mit:
  - File-Upload Area (Drag & Drop für PDF, CSV, Excel)
  - Message-Liste (Verlauf)
  - Input für Nutzer-Fragen
  - Progress-Bar während Upload
  - Ergebnis-Summary (X Kontakte erstellt, Y übersprungen, Z Fehler)

**2. API-Endpoint: `/src/app/api/ki-assistent/upload/route.ts`**
- POST Handler: File-Upload + Parsing
- Logik:
  1. File hochladen (PDF/CSV/Excel)
  2. **Daten extrahieren:**
     - CSV/Excel: Direktes Parsing (`csv-parser`, `xlsx` Package)
     - PDF: PDF lesen + Claude Sonnet API zum Extrahieren
  3. Daten validieren (Pflichtfelder prüfen)
  4. Duplikate prüfen (Email + Name in Supabase)
  5. Bulk-Kontakte erstellen
  6. Automationen triggern (Rule-Engine)
  7. Activity-Logging
  8. JSON Response: `{ created: 10, skipped: 2, errors: [], summary: "..." }`

**3. KI-Integration Utility: `/src/lib/integrations/insurance-extractor.ts`**
```typescript
// Interface
interface InsuranceData {
  first_name: string
  last_name: string
  email?: string
  phone_mobile?: string
  street?: string
  postcode?: string
  city?: string
  country?: string
  policy_number: string
  insurance_type: string
  premium_amount?: number
  customer_id_insurance?: string
  policy_start_date?: string
  policy_end_date?: string
  broker_name?: string
}

// Exports
export async function extractFromPDF(pdfBuffer: Buffer): Promise<InsuranceData[]>
export async function extractFromCSV(csvText: string): Promise<InsuranceData[]>
export async function extractFromExcel(excelBuffer: Buffer): Promise<InsuranceData[]>
```

**4. Supabase Migration: `supabase/migrations/add_insurance_fields.sql`**
```sql
ALTER TABLE public.contacts
  ADD COLUMN policy_number TEXT,
  ADD COLUMN insurance_type TEXT,
  ADD COLUMN premium_amount DECIMAL(10, 2),
  ADD COLUMN customer_id_insurance TEXT,
  ADD COLUMN policy_start_date DATE,
  ADD COLUMN policy_end_date DATE,
  ADD COLUMN broker_name TEXT,
  ADD COLUMN upload_batch_id TEXT;  -- Für Tracking welche Kontakte zusammen hochgeladen wurden

CREATE INDEX idx_contacts_policy_number ON public.contacts(policy_number);
CREATE INDEX idx_contacts_insurance_type ON public.contacts(insurance_type);
CREATE INDEX idx_contacts_upload_batch_id ON public.contacts(upload_batch_id);
```

### ✏️ DATEIEN ZU ÄNDERN

**1. `/src/types/index.ts`**
- Erweitere `Contact` Interface mit neuen Feldern:
```typescript
interface Contact {
  // ... existing fields
  policy_number?: string
  insurance_type?: string
  premium_amount?: number
  customer_id_insurance?: string
  policy_start_date?: string
  policy_end_date?: string
  broker_name?: string
  upload_batch_id?: string
}
```

**2. `/src/app/api/kontakte/route.ts` — POST Handler**
- Aktualisiere duplikat-Prüfung (nutze bestehende Logik Zeile 106-146)
- Erweitere ALLOWED_FIELDS für neue Versicherungs-Spalten
- Nach Kontakt-Erstellung: `executeRules()` aufrufen (bestehende Rule-Engine)

**3. `/src/app/api/kontakte/[id]/route.ts` — PATCH Handler**
- Erweitere `ALLOWED_UPDATE_FIELDS` mit allen neuen Versicherungs-Feldern

**4. Sidebar Navigation: `/src/components/Sidebar.tsx`**
- Neuer NAV_ITEM:
  ```typescript
  {
    icon: Brain,  // oder ChatBubble, Sparkles
    label: 'KI Assistent',
    href: '/ki-assistent'
  }
  ```

**5. `/src/lib/activities-logger.ts`**
- Neuer Activity-Type: `upload_batch_created`
- Log-Beschreibung: "Versicherungs-Bulk-Upload: {count} Kontakte erstellt, {skipped} übersprungen"

---

## Datenfluss

```
1. User öffnet /ki-assistent
   ↓
2. Drag & Drop oder Klick File-Upload
   ↓
3. POST /api/ki-assistent/upload
   ↓
4. Backend:
   a. File-Type erkennen (PDF/CSV/Excel)
   b. Inhalt lesen + Claude API aufrufen
   c. InsuranceData[] extrahieren
   d. Duplikate prüfen (Email + Name in Supabase)
   e. Neue Kontakte mit policy_number, insurance_type, etc. erstellen
   f. Für jeden Kontakt: executeRules() (triggert Automationen: KlickTipp sync, Tags, etc.)
   g. Activity-Logging: "Batch-Upload: 10 Kontakte erstellt"
   ↓
5. Response an Frontend:
   {
     success: true,
     batch_id: "upload-2026-06-25-12-30",
     created: 10,
     skipped: 2,
     errors: [],
     summary: "10 neue Kontakte angelegt, 2 übersprungen (Duplikate)"
   }
   ↓
6. Chat-Message an User: "✅ Upload erfolgreich! 10 Kontakte erstellt."
```

---

## Claude API Prompts (Sonnet)

### PDF/Freitext-Extraktion:
```
Du bist ein Versicherungs-Datenextraktor. Lies das folgende Versicherungsdokument 
und extrahiere alle relevanten Kontakt- und Versicherungsdaten im JSON-Format:

{
  "first_name": "...",
  "last_name": "...",
  "email": "...",
  "phone_mobile": "...",
  "street": "...",
  "postcode": "...",
  "city": "...",
  "country": "...",
  "policy_number": "...",
  "insurance_type": "...",
  "premium_amount": ...,
  "customer_id_insurance": "...",
  "policy_start_date": "YYYY-MM-DD",
  "policy_end_date": "YYYY-MM-DD",
  "broker_name": "..."
}

Nur die gefundenen Felder eintragen. Falls Feld nicht vorhanden → Feld auslassen.
```

### CSV/Excel-Mapping:
```
Mapping-Regeln (case-insensitive):
- "first_name", "vorname", "fname" → first_name
- "last_name", "nachname", "lname" → last_name
- "email", "e-mail", "mail" → email
- "phone", "telefon", "mobile" → phone_mobile
- "policy_number", "policennummer", "vertragsnummer" → policy_number
- "insurance_type", "versicherungsart", "produkttyp" → insurance_type
- "premium", "beitrag", "jahresbeitrag" → premium_amount
- etc.
```

---

## Fehlerbehandlung

| Fehlerfall | Verhalten |
|----------|----------|
| **PDF nicht lesbar** | Skip + log error: "PDF nicht extrahierbar" |
| **CSV mit falschen Spalten** | Mapping-Warnung in Chat: "Spalten-Namen unbekannt, bitte manuell prüfen" |
| **Pflichtfeld (policy_number) fehlt** | Skip Kontakt + log error: "policy_number fehlt" |
| **Email existiert schon** | Überspringen (duplikat) + log: "Kontakt existiert bereits" |
| **Claude API Fehler (403, 429, 500)** | Retry 2x, dann abort + error-Message an User |

---

## Environment Variablen

- `ANTHROPIC_API_KEY` — bereits in `.env.local` vorhanden
- `NEXT_PUBLIC_SUPABASE_URL` — existiert
- `SUPABASE_SERVICE_ROLE_KEY` — existiert

---

## Testing Plan

**Manual Testing:**
1. ✅ Upload PDF → Kontakte extrahieren + erstellen
2. ✅ Upload CSV → Spalten-Mapping + Erstellen
3. ✅ Duplikate überspringen
4. ✅ Automationen triggern (KlickTipp sync sichtbar)
5. ✅ Chat-Messages zeigen Fortschritt
6. ✅ Activity-Log trackert Bulk-Upload
7. ✅ Upload-Batch-ID speichert zusammenhängende Kontakte

---

## Packages zu installieren

```bash
npm install pdf-parse xlsx csv-parser
```

---

## Unterschied zu bestehender Lösung

| Feature | Vorher | Nachher |
|---------|--------|---------|
| **Datei-Upload** | Nicht vorhanden | ✅ PDF/CSV/Excel |
| **Datenextraktion** | Manuell | ✅ Claude KI (PDF), Auto-Mapping (CSV) |
| **Bulk-Erstellung** | Einzeln via Webhook | ✅ Batch mit Duplikat-Check |
| **Automationen** | ✅ Rule-Engine existiert | ✅ Wird pro Kontakt triggert |
| **Chat-Interface** | Nicht vorhanden | ✅ Neue Seite `/ki-assistent` |
| **Audit-Trail** | ✅ Activity-Log existiert | ✅ Batch-Tracking mit `upload_batch_id` |

---

**Ist dieser Plan okay? Oder brauchst du Anpassungen?**