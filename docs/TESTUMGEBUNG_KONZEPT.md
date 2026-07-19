# Playwright-Tests in der Live-Umgebung

**Stand:** 17. Juli 2026
**Status:** Technische Grundlage implementiert, Datenbankmigration noch nicht angewendet

## Ziel

Playwright läuft gegen die reale Anwendung und dieselbe Supabase-Datenbank. Reguläre Kontakte und Kundendaten dürfen dabei weder verändert noch gelöscht werden.

Vor jedem Testlauf werden ausschließlich technisch markierte Testdaten älterer Läufe entfernt. Die neuen Testdaten bleiben nach der Durchführung bis zum nächsten Lauf erhalten, damit Fehler analysiert werden können.

## Sichtbare Testdaten-Konvention

Ein Kontakt gilt nur dann als Testdatensatz, wenn alle drei sichtbaren Merkmale vorhanden sind:

```text
Vorname: [TEST]
Firma:   [TESTDATEN] <Szenario>
E-Mail:  pw+<lauf-id>@example.invalid
```

Beispiel:

```text
[TEST] Lead-Anlage
[TESTDATEN] Automatischer Regressionstest
pw+pw-20260717-001@example.invalid
```

`example.invalid` ist eine reservierte, nicht zustellbare Domain. Es werden keine realen Namen, Telefonnummern, Adressen oder E-Mail-Adressen verwendet.

Zusätzlich speichert die Datenbank:

- `is_test_data = true`
- `test_run_id = <lauf-id>`

Ein einzelnes sichtbares Merkmal reicht nicht aus. Dadurch kann ein regulärer Kontakt nicht versehentlich als Testkontakt bereinigt werden.

## Schutz externer Systeme

Für vollständig erkannte Testkontakte deaktiviert die Kontakt-API automatisch:

- Automationsregeln,
- Klicktipp-Synchronisation,
- Dialfire-Synchronisation.

Weitere Integrationen müssen vor Aufnahme in einen Testfall ebenfalls auf Testdatenmarker prüfen oder im Test simuliert werden.

## Ablauf je Testlauf

1. Playwright erzeugt eine eindeutige Lauf-ID.
2. `globalSetup` ruft den geschützten Bereinigungsendpunkt auf.
3. API und Datenbank prüfen Projekt, Token und Guard-ID.
4. Die Datenbank löscht ausschließlich Kontakte mit `is_test_data = true` und gesetzter `test_run_id`.
5. Abhängige Aufgaben, Opportunities, Verträge, Notizen und Audit-Einträge werden über Foreign-Key-Cascades entfernt.
6. Playwright legt neue, sichtbar gekennzeichnete Testkontakte an.
7. Nach dem Lauf findet keine Bereinigung statt.
8. Der Datenstand bleibt bis zum nächsten Testlauf analysierbar.

## Was niemals geschieht

- kein `TRUNCATE`
- keine generische Tabellenleerung
- keine Löschung nach Namen allein
- keine Löschung nach E-Mail-Domain allein
- keine Veränderung regulärer Live-Kontakte
- keine Verwendung echter personenbezogener Testdaten

## Einmalige Aktivierung

### 1. Migration anwenden

Die Migration [0039_test_environment_guard.sql](../supabase/migrations/0039_test_environment_guard.sql) in Supabase ausführen. Sie ist standardmäßig gesperrt.

### 2. Bereinigungs-Guard freigeben

```sql
UPDATE public.test_data_guard
SET cleanup_allowed = TRUE,
    updated_at = NOW()
WHERE singleton = TRUE
RETURNING guard_id;
```

Die zurückgegebene `guard_id` wird als Server-Secret `TEST_DATA_GUARD_ID` gespeichert.

### 3. Servervariablen setzen

```text
TEST_DATA_CLEANUP_ENABLED=true
TEST_SUPABASE_PROJECT_REF=<Ref des bestehenden Live-Projekts>
TEST_DATA_GUARD_ID=<ID aus test_data_guard>
TEST_DATA_CLEANUP_TOKEN=<zufälliges Secret mit mindestens 32 Zeichen>
```

Guard-ID, Bereinigungs-Token und Service-Role-Key dürfen niemals als `NEXT_PUBLIC_*` Variablen gesetzt werden.

### 4. Technischen Testbenutzer anlegen

Der Auth-Testbenutzer wird einmalig angelegt und nicht bereinigt. Auch sein sichtbarer Name muss `[TEST] Playwright` lauten. Seine Zugangsdaten werden ausschließlich als Vercel-/GitHub-Secrets gespeichert.

## Aufruf durch Playwright

```ts
const runId = `pw-${Date.now()}`
const response = await fetch(`${process.env.PLAYWRIGHT_BASE_URL}/api/test-environment`, {
  method: 'POST',
  headers: {
    'x-test-cleanup-token': process.env.TEST_DATA_CLEANUP_TOKEN ?? '',
    'x-test-run-id': runId,
  },
})

if (!response.ok) {
  throw new Error('Die alten Testdaten konnten nicht sicher bereinigt werden.')
}
```

Schlägt die Bereinigung fehl, wird der Testlauf abgebrochen.

## Notfallabschaltung

Deployment:

```text
TEST_DATA_CLEANUP_ENABLED=false
```

Datenbank:

```sql
UPDATE public.test_data_guard
SET cleanup_allowed = FALSE,
    updated_at = NOW()
WHERE singleton = TRUE;
```

Die Datenbanksperre wirkt unabhängig von der Deployment-Konfiguration.
