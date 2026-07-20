# Konzept: Placetel-Telefonie-Integration in Sentimental Logic

**Projekt:** Sentimental Logic
**Stand:** 20. Juli 2026
**Status:** Technisch geprüfter Entwurf für Phase 2
**Grundlage:** bereitgestellte Placetel-Swagger-Spezifikation, API-Version 2.0.0

### Implementierungsstand im Branch `feature/placetel-integration`

- [x] Migration für `call_logs` und idempotente Webhook-Events erstellt
- [x] Serverseitiger API-Client für `POST /v2/calls` erstellt
- [x] Authentifizierte Click-to-Call-, Historien- und Ergebnisrouten erstellt
- [x] Abgesicherter Callback-Endpunkt mit konservativem Parser erstellt
- [x] Kontakt-UI mit Nummernauswahl, Historie, Polling und Ergebniserfassung ergänzt
- [x] TypeScript-Prüfung und Produktions-Build erfolgreich
- [ ] Migration auf Supabase anwenden
- [ ] Rotierten API-Token, SIPUID und Callback-Secret in Vercel hinterlegen
- [ ] Callback-Payload und `service`-Wert durch echten Placetel-Pilot bestätigen
- [ ] Subscription registrieren und CDR-Reconciliation implementieren
- [ ] Ergebnis-Automationen und vollständige E2E-Regression ergänzen

## 1. Ergebnis der Prüfung

Die Integration ist mit der bereitgestellten Placetel-API grundsätzlich umsetzbar. Das ursprüngliche Konzept beschreibt die richtige Zielrichtung, muss aber an mehreren Stellen korrigiert und ergänzt werden:

- Die aktuelle Anwendung arbeitet mit `contacts`, nicht mit `leads`. Neue Telefoniedaten werden deshalb über `contact_id` verknüpft.
- Click-to-Call erfolgt laut Swagger über `POST https://api.placetel.de/v2/calls` mit `sipuid` und `target`.
- Placetel-Callbacks werden laut Swagger über `PUT /v2/subscriptions` registriert. Unterstützte Kategorien sind `incoming`, `outgoing`, `accepted`, `hungup` und optional `phone`.
- Die Swagger-Datei dokumentiert weder das Callback-Payload noch eine HMAC-Signatur. Die im ersten Entwurf angenommene Signaturprüfung mit `x-placetel-signature` ist daher nicht belegt und darf nicht ungeprüft implementiert werden.
- Das automatische Öffnen eines Ergebnisdialogs benötigt im Browser zusätzlich Supabase Realtime oder Polling. Ein serverseitig empfangener Webhook allein kann keinen bereits geöffneten Browserdialog anzeigen.
- Die bestehende Automation reagiert derzeit auf neu angelegte Kontakte und die Merkmale Quelle/Sparte. Gesprächsergebnisse sind noch kein vorhandener Regel-Trigger und müssen ergänzt werden.
- Der vorhandene „Anrufen“-Link öffnet aktuell nur ein lokales `tel:`-Ziel. Für Placetel muss daraus eine authentifizierte Serveraktion werden.

## 2. Ziel und Umfang

Melih und später weitere berechtigte Benutzer sollen:

1. einen Kontakt direkt aus Sentimental Logic über Placetel anrufen,
2. ein- und ausgehende Anrufe automatisch dem passenden Kontakt zuordnen,
3. Status, Dauer und Ergebnis des Gesprächs in der Kontakthistorie sehen,
4. nach Gesprächsende ein Ergebnis mit Notiz erfassen,
5. über das Ergebnis vorhandene oder neue Automationen auslösen können und
6. nicht zugeordnete Anrufe nachträglich einem Kontakt zuweisen können.

Nicht Bestandteil des ersten Ausbaus sind Gesprächsaufzeichnung, Transkription, KI-Auswertung, SMS und die Synchronisation des Placetel-Adressbuchs.

## 3. Verifizierte Placetel-API

### 3.1 Authentifizierung und Basis-URL

- Basis-URL: `https://api.placetel.de/v2`
- Authentifizierung: `Authorization: Bearer <API-Token>`
- Der Token bleibt ausschließlich in einer serverseitigen Umgebungsvariable. Er darf weder mit `NEXT_PUBLIC_` beginnen noch an den Browser übertragen werden.
- Die API liefert Rate-Limit-Informationen über `RateLimit-Remaining` und `RateLimit-Reset`. Bei HTTP 429 ist `Retry-After` zu beachten.

### 3.2 Click-to-Call

`POST /calls`

```json
{
  "sipuid": "7771234567@fpbx.de",
  "target": "+491701234567",
  "from_name": "Optionaler Anzeigename"
}
```

Pflichtfelder sind `sipuid` und `target`. Laut Swagger antwortet Placetel bei Erfolg mit HTTP 201 und einem `Call`-Objekt. Der dokumentierte `Call`-Typ enthält unter anderem `id`, `type`, `from_number`, `to_number`, `duration` und `received_at`. Da dieser Typ zugleich für eingehende Anrufe verwendet wird, muss die echte Antwort eines initiierten Testanrufs vor Festlegung des finalen Mappings aufgezeichnet werden — ohne personenbezogene Daten oder Token zu loggen.

### 3.3 Callbacks/Subscriptions

`PUT /subscriptions`

```json
{
  "service": "<im Pilot zu bestätigender Placetel-Servicewert>",
  "url": "https://sentinellogic.vercel.app/api/webhooks/placetel?token=<secret>",
  "incoming": true,
  "outgoing": true,
  "accepted": true,
  "hungup": true,
  "phone": false,
  "numbers": ["+49..."]
}
```

`service` und `url` sind Pflichtfelder. Der zulässige Wert für `service` ist im Swagger nicht beschrieben. Auch Format, Content-Type, Eventnamen, Wiederholungslogik und Signatur des Callback-Payloads fehlen. Diese Punkte müssen mit einem kontrollierten Test-Callback oder ergänzender Placetel-Dokumentation bestätigt werden.

Bis eine native Placetel-Signatur nachgewiesen ist, wird der Endpoint mindestens durch ein langes zufälliges Callback-Token geschützt. Da Query-Parameter in Infrastruktur-Logs auftauchen können, ist eine von Placetel gesetzte Signatur oder ein konfigurierbarer Authentifizierungsheader klar vorzuziehen. Wenn Placetel beides nicht unterstützt, müssen Log-Redaktion, Tokenrotation, Payload-Validierung, Rate-Limiting und eine enge Nummern-Allowlist zusammen eingesetzt werden.

Subscriptions können über `GET /subscriptions` kontrolliert und über `DELETE /subscriptions/{id}` entfernt werden.

### 3.4 Abgleich und Reparatur

- `GET /calls` liefert Anrufe eines Tages und kann nach Datum, Nummer und Typ gefiltert werden. Dokumentierte Typen sind `voicemail`, `missed`, `blocked` und `accepted`.
- `GET /call_detail_records?date=YYYY-MM-DD` liefert abrechnungsnahe Datensätze mit `from`, `to`, `length`, `answer_uri`, `received_at`, Beschreibung und Betrag.
- Ein geplanter Vercel-Cronjob soll mindestens täglich die letzten zwei Kalendertage abgleichen. Dadurch werden verlorene oder verspätete Webhooks erkannt und Dauer/Endstatus repariert.
- Call-Detail-Records besitzen im gelieferten Schema keine eigene ID. Die Zuordnung muss deshalb vorsichtig über normalisierte Nummern, Zeitfenster, Richtung und SIP-Benutzer erfolgen. Mehrdeutige Treffer bleiben zur manuellen Prüfung offen.

## 4. Zielarchitektur

```text
Kontaktseite
  -> POST /api/calls/initiate (Login erforderlich)
  -> Placetel POST /v2/calls
  -> call_logs: initiated

Placetel Subscription
  -> POST /api/webhooks/placetel (öffentlich, separat abgesichert)
  -> Ereignis validieren und idempotent speichern
  -> Kontakt über normalisierte Gegenstelle zuordnen
  -> call_logs / activities aktualisieren

Browser
  <- Supabase Realtime oder kurzes Polling
  <- Gespräch beendet: Ergebnisdialog anzeigen
  -> PATCH /api/calls/{id}/result
  -> Aktivität + Automation auslösen

Vercel Cron
  -> GET /v2/calls und /v2/call_detail_records
  -> fehlende bzw. unvollständige Datensätze abgleichen
```

## 5. Datenmodell

Für die Umsetzung wird eine neue Migration nach dem aktuell höchsten Migrationsstand angelegt. Das folgende Schema ist der Zielentwurf; Eventfelder werden nach dem Callback-Pilottest finalisiert.

```sql
create table public.call_logs (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts(id) on delete set null,
  initiated_by_user_id uuid references public.users(id) on delete set null,

  placetel_call_id text,
  direction text not null check (direction in ('incoming', 'outgoing')),
  status text not null check (status in (
    'initiated', 'ringing', 'accepted', 'completed',
    'missed', 'blocked', 'voicemail', 'failed'
  )),

  from_number text,
  to_number text,
  remote_number_normalized text,
  sipuid text,

  started_at timestamptz not null,
  accepted_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),

  result text check (result is null or result in (
    'termin', 'wiedervorlage', 'kein_interesse',
    'nicht_erreicht', 'falsche_nummer', 'sonstiges'
  )),
  notes text,
  result_recorded_by uuid references public.users(id) on delete set null,
  result_recorded_at timestamptz,

  provider_payload jsonb,
  reconciliation_state text not null default 'pending'
    check (reconciliation_state in ('pending', 'matched', 'ambiguous', 'reconciled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index call_logs_placetel_call_id_unique
  on public.call_logs (placetel_call_id)
  where placetel_call_id is not null;
create index call_logs_contact_created_idx
  on public.call_logs (contact_id, created_at desc);
create index call_logs_remote_number_idx
  on public.call_logs (remote_number_normalized, started_at desc);
create index call_logs_unassigned_idx
  on public.call_logs (created_at desc)
  where contact_id is null;

create table public.placetel_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_fingerprint text not null unique,
  event_type text,
  placetel_call_id text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text
);
```

`provider_payload` darf nur die für Diagnose und Zuordnung erforderlichen, redigierten Felder enthalten. Eine kurze Aufbewahrungsfrist ist festzulegen. Das separate Eventregister verhindert doppelte Verarbeitung bei Callback-Wiederholungen. Wenn Placetel eine stabile Event-ID liefert, ersetzt diese den aus dem kanonisierten Payload gebildeten Fingerprint.

Für mehrere Sentimental-Logic-Benutzer wird zusätzlich eine Zuordnung `user_id -> sipuid` benötigt. Für den ersten Einzelbenutzer kann die SIPUID zunächst als serverseitige Umgebungsvariable geführt werden; ein SIP-Passwort wird für `POST /calls` laut Swagger nicht benötigt und darf nicht gespeichert werden.

## 6. Telefonnummern und Kontaktzuordnung

Die vorhandene `src/lib/phone.ts` deckt nur die WhatsApp-Ausgabe ab und reicht für ein belastbares Matching nicht aus. Es wird eine zentrale Normalisierung benötigt:

1. Leerzeichen, Klammern, Bindestriche und Durchwahltrennzeichen bereinigen.
2. Deutsche nationale Nummern mit konfiguriertem Standardland in E.164 überführen.
3. `00` als internationale Vorwahl behandeln.
4. Mobil- und Büronummer (`phone_mobile`, `phone_office`) vergleichen.
5. Keine unsichere Suffix-Suche als automatischen Treffer verwenden.

Bei genau einem Treffer wird `contact_id` gesetzt. Bei keinem Treffer bleibt der Anruf unzugeordnet. Bei mehreren Treffern wird `reconciliation_state = 'ambiguous'` gesetzt; es erfolgt keine automatische Auswahl.

Für gute Performance empfiehlt sich später eine persistierte normalisierte Mobil- und Büronummer in `contacts` mit Indizes. Vorher müssen bestehende Dubletten ausgewertet werden.

## 7. Interne API-Routen

### `POST /api/calls/initiate`

Die Route ist durch die bestehende Supabase-Session geschützt. Der Browser sendet nur:

```json
{ "contactId": "<uuid>", "phoneField": "phone_mobile" }
```

Der Server lädt den Kontakt und die Nummer selbst. Damit kann ein Benutzer nicht beliebige kostenpflichtige Ziele im Request einschleusen. Zusätzlich erforderlich:

- UUID, erlaubtes Telefonfeld und normalisierte Zielnummer validieren,
- archivierte Kontakte und unzulässige Länder-/Sonderrufnummern ablehnen,
- SIPUID serverseitig aus Benutzerzuordnung oder Konfiguration ermitteln,
- pro Benutzer und Kontakt Rate-Limits setzen,
- Timeout und Abbruchsignal für den Placetel-Aufruf verwenden,
- HTTP 201 explizit als Erfolg behandeln,
- 401/403, 400, 429 und 5xx in sichere Fehlermeldungen übersetzen,
- Token, vollständige Telefonnummern und Payloads nicht loggen,
- zunächst einen `initiated`-Datensatz speichern und später idempotent mit Callback/CDR zusammenführen.

### `POST /api/webhooks/placetel`

Diese Route liegt wegen der bestehenden Middleware unter `/api/webhooks/` öffentlich und muss daher selbst vollständig absichern:

- Authentizität vor dem JSON-/Form-Parsing prüfen,
- maximale Body-Größe begrenzen,
- Content-Type und striktes Runtime-Schema validieren,
- Eventtyp-Allowlist verwenden,
- Zeitstempel auf Plausibilität prüfen,
- Callback idempotent speichern,
- schnell mit 2xx antworten und langsame Folgearbeit entkoppeln,
- niemals personenbezogene Payloads vollständig loggen.

Das endgültige Parsing wird erst nach Erfassung eines echten, redigierten Beispiel-Callbacks implementiert. Die im alten Entwurf genannten Namen `NewCall`, `CallAccepted` und `CallHungup` sind durch den Swagger nicht bestätigt.

### Weitere Routen

- `GET /api/calls?contactId=...` — Anrufhistorie eines Kontakts
- `PATCH /api/calls/{id}/result` — Ergebnis und Notiz speichern
- `PATCH /api/calls/{id}/contact` — unzugeordneten Anruf manuell verknüpfen
- `GET /api/calls/unassigned` — nicht bzw. mehrdeutig zugeordnete Anrufe
- interne geschützte Reconciliation-Route für den Cronjob

Alle mutierenden Routen prüfen Login, Rolle und Datensatzberechtigung. Eingabefelder werden serverseitig auf eine Allowlist reduziert.

## 8. UI und Aktivitäten

- Der vorhandene `tel:`-Link im `StickyContactHeader` wird bei aktivierter Integration durch einen Placetel-Button ergänzt oder ersetzt.
- Wenn Mobil- und Büronummer vorhanden sind, wählt der Benutzer das Ziel bewusst aus.
- Während der Initiierung zeigt der Button einen Ladezustand und verhindert Doppelklicks.
- Anrufe erscheinen als eigener Bereich oder Filter in der bestehenden Aktivitätsansicht.
- Nach einem beendeten, dem aktuellen Benutzer zugeordneten Anruf öffnet Realtime oder Polling den Ergebnisdialog. Als Fallback bleibt jeder offene Ergebnisdatensatz in einer Liste sichtbar.
- Ein Ergebnisdialog darf nie ausschließlich automatisch erscheinen: Browser kann geschlossen sein, Events können verspätet eintreffen und mehrere Tabs können aktiv sein.
- Nicht zugeordnete oder mehrdeutige Anrufe erhalten eine eigene Arbeitsliste mit „Kontakt zuordnen“ und „Kontakt anlegen“.

Zusätzlich werden schlanke Einträge in der bestehenden `activities`-Tabelle erzeugt, etwa `placetel_call_started`, `placetel_call_completed` und `placetel_call_result_recorded`. Die vollständige Telefoniehistorie bleibt in `call_logs`; `activities` dient nur der gemeinsamen Timeline.

## 9. Automation

Das bestehende `executeAutomation()` kann Gesprächsergebnisse noch nicht verarbeiten. Für Phase 2 gibt es zwei Optionen:

1. den Regeltyp um `trigger = 'call_result'` und `condition_call_result` erweitern oder
2. für den ersten Ausbau einen fokussierten `executeCallResultAutomation()`-Handler ergänzen.

Empfohlen ist Option 1, sobald mehrere Ergebnisregeln gepflegt werden sollen. Beispielaktionen:

- `termin` → Aufgabe/Termin-Nachbereitung erzeugen und KlickTipp-Tag setzen,
- `wiedervorlage` → Aufgabe mit Pflichtdatum erzeugen,
- `nicht_erreicht` → Kontaktversuch erhöhen und optional erneute Aufgabe anlegen,
- `kein_interesse` → Status oder Pipeline-Schritt nach einer expliziten Regel ändern.

Die Speicherung des Gesprächsergebnisses muss unabhängig vom Erfolg externer Folgeaktionen funktionieren. Fehlgeschlagene KlickTipp-/Dialfire-Aktionen werden separat protokolliert und wiederholbar gemacht.

## 10. Sicherheit und Datenschutz

- Der bereitgestellte API-Token wird nicht in Repository, Konzept, Client-Bundle oder Logs übernommen.
- API-Token nach Möglichkeit mit minimalen Placetel-Rechten verwenden und regelmäßig rotieren.
- Webhook-Secret und API-Token sind unterschiedliche Secrets.
- Nur Serverrouten greifen auf Placetel zu; Browser und Supabase-Client erhalten keine Placetel-Zugangsdaten.
- RLS/Autorisierung für `call_logs` ist vor Produktivbetrieb verbindlich. Schreibzugriffe von Placetel erfolgen über den serverseitigen Service-Role-Client.
- Telefonnummern und Gesprächsnotizen sind personenbezogene Daten. Zweck, Rechtsgrundlage, Rollenberechtigung, Aufbewahrungs- und Löschfrist werden im Verzeichnis der Verarbeitungstätigkeiten ergänzt.
- Es werden in Phase 1 der Integration keine Audiodateien oder Aufzeichnungen abgerufen.
- Notizfelder dürfen keine unnötigen Gesundheits- oder sonstigen besonderen Kategorien personenbezogener Daten enthalten.

## 11. Konfiguration

```dotenv
PLACETEL_API_BASE_URL=https://api.placetel.de/v2
PLACETEL_API_TOKEN=
PLACETEL_DEFAULT_SIPUID=
PLACETEL_SUBSCRIPTION_SERVICE=
PLACETEL_WEBHOOK_TOKEN=
PLACETEL_ALLOWED_COUNTRY_CODES=+49
PLACETEL_RECONCILIATION_TOKEN=
```

`PLACETEL_SUBSCRIPTION_SERVICE` bleibt bis zum Pilot leer. Falls Placetel eine native Signatur oder einen Auth-Header unterstützt, wird `PLACETEL_WEBHOOK_TOKEN` durch die entsprechend dokumentierte Konfiguration ersetzt.

## 12. Test- und Abnahmeplan

### Vertragstests gegen Placetel

- Token mit einem rein lesenden Endpoint validieren, ohne Antwortdaten zu protokollieren.
- verfügbare SIP-Benutzer ermitteln und die korrekte SIPUID bestätigen,
- Subscription anlegen, über `GET /subscriptions` verifizieren und anschließend kontrolliert löschen,
- je einen redigierten Beispiel-Callback für eingehend, ausgehend, angenommen und aufgelegt erfassen,
- erfolgreichen Click-to-Call sowie 400, 401/403 und 429 prüfen.

### Automatisierte Tests

- Unit-Tests für Telefonnummern-Normalisierung und mehrdeutige Treffer,
- Route-Tests mit gemockter Placetel-API für 201, Timeout, 429 und Fehlerantworten,
- Webhook-Tests für falsches Secret, ungültiges Schema, unbekanntes Event und Duplikat,
- Reconciliation-Tests für fehlenden, eindeutigen und mehrdeutigen CDR-Treffer,
- E2E: Anrufen-Button, Nummernauswahl, Ergebnis speichern, unzugeordneten Anruf verknüpfen,
- Sicherheitsprüfung: kein Token im Browserbundle, Response oder Log.

Echte Tests verwenden ausschließlich technisch markierte Testkontakte und die vorhandenen Live-Testdaten-Schutzmechanismen.

## 13. Umsetzungsphasen und Aufwand

| Paket | Inhalt | Schätzung |
|---|---|---:|
| Pilot | Token/SIPUID prüfen, Callback-Format und Sicherheit verifizieren | 0,5–1 Tag |
| Backend-Basis | Client, Migration, Click-to-Call, Fehler-/Rate-Limit-Behandlung | 1–1,5 Tage |
| Eventverarbeitung | Webhook, Idempotenz, Matching, Reconciliation | 1,5–2 Tage |
| UI | Button, Nummernauswahl, Historie, Ergebnisdialog, Zuordnungsliste | 1,5–2 Tage |
| Automation | Call-Result-Trigger, Aufgaben/Tags, Fehlerpfad | 0,5–1 Tag |
| Tests und Abnahme | Unit/API/E2E und echte Testszenarien | 1–1,5 Tage |
| **Gesamt** | abhängig vom Callback-Format und Mehrbenutzerumfang | **6–9 Tage** |

Die ursprüngliche Schätzung von etwa 3,5 Tagen deckt Idempotenz, Reconciliation, Browser-Benachrichtigung, Sicherheit, Mehrdeutigkeiten und Regressionstests nicht ausreichend ab.

## 14. Kosten und Abhängigkeiten

Die Swagger-Datei enthält keine Tarif- oder Preisangaben. Aussagen wie „Web API kostenlos“ oder „keine Zusatzkosten“ müssen deshalb im konkreten Placetel-Vertrag bzw. im Placetel-Portal bestätigt werden. Technisch sind mehrere Endpoints im Swagger mit `profi` gekennzeichnet; das deutet auf eine Tarifabhängigkeit hin, belegt aber keine konkreten Kosten.

Vor Implementierungsbeginn zu klären:

1. Ist der verwendete Vertrag für `Calls`, `Subscriptions` und `Call detail records` freigeschaltet?
2. Welche SIPUID gehört zu Melih, und soll später je Sentimental-Logic-Benutzer eine eigene SIPUID gelten?
3. Welcher `service`-Wert ist für die Subscription erforderlich?
4. Wie sehen Callback-Body, Content-Type, Event-ID, Wiederholungen und Authentizitätsnachweis tatsächlich aus?
5. Welche Placetel-Rufnummern sollen über `numbers` abonniert werden?
6. Welche Aufbewahrungsfrist gilt für Anrufmetadaten und Gesprächsnotizen?
7. Welche Ergebniswerte lösen welche Aufgaben, Statuswechsel oder KlickTipp-Tags aus?

## 15. Empfohlene Reihenfolge

1. Den bereits außerhalb des Repositories bereitgestellten API-Token sicher in Vercel und lokal als Secret hinterlegen beziehungsweise vorsorglich rotieren.
2. Mit read-only Requests Tarif, Konto, SIPUIDs und vorhandene Subscriptions prüfen.
3. Einen temporären, abgesicherten Callback-Endpunkt bereitstellen und redigierte Payload-Beispiele erfassen.
4. Erst danach Migration und Parser finalisieren.
5. Click-to-Call, Eventverarbeitung und Reconciliation implementieren.
6. UI und Ergebnis-Automationen ergänzen.
7. Regressionstest-Katalog erweitern und echte Testanrufe abnehmen.
