# SuperChat-Kontaktsynchronisation

Stand: 29. Juli 2026

## Ziel

Ein angemeldeter, aktiver Benutzer kann einen Kontakt aus Sentimental Logic
gezielt an SuperChat übertragen. Die Funktion sendet keine Nachricht und nimmt
keine automatische Kampagnenanmeldung vor. Sie legt ausschließlich den Kontakt
im verbundenen SuperChat-Workspace an beziehungsweise aktualisiert ihn.

## Fachlicher Ablauf

1. In der Kontaktdetailseite zeigt die Kachel „Telefonie & Sync“ den
   SuperChat-Status.
2. „Übertragen“ legt einen bisher nicht verknüpften Kontakt in SuperChat an.
3. Die zurückgegebene SuperChat-ID und der Erfolgszeitpunkt werden am lokalen
   Kontakt gespeichert.
4. Weitere Läufe verwenden „Aktualisieren“ und schreiben auf dieselbe
   SuperChat-ID. Bereits vorhandene Telefon-/E-Mail-Handles werden über ihre
   Provider-ID wiederverwendet; neue Kontaktwege werden ergänzt. Dadurch
   erzeugt die Anwendung bei normaler Wiederholung keinen zweiten Kontakt und
   entfernt keine später in SuperChat ergänzten Kontaktwege.
5. Erfolg oder Fehler erscheint verständlich in der Oberfläche und wird in der
   Aktivitätshistorie protokolliert.
6. Nach der ersten Verknüpfung öffnet „Kontakt in SuperChat öffnen“ über den
   offiziell unterstützten SuperChat-Link die bestehende Unterhaltung
   beziehungsweise den Kontakt in einem neuen Tab.
7. Falls der Kontakt schon vor Sentinel in SuperChat vorhanden war, sucht
   „Bestehenden verbinden“ nach einer exakten E-Mail-Adresse oder normalisierten
   Telefonnummer. Nur ein eindeutiger Treffer wird verknüpft; bei keinem oder
   mehreren Treffern bleiben beide Systeme unverändert.

## Übertragene Daten

- Vorname und Nachname
- Geschlecht, sofern es sicher auf `female`, `male` oder `diverse` abbildbar ist
- gültige E-Mail-Adresse
- gültige Mobil- und Büronummern im E.164-Format
- Firma als SuperChat-Kontaktattribut `Firma`
- vollständige Anschrift als SuperChat-Kontaktattribut `Adresse`
- Geburtsdatum als SuperChat-Kontaktattribut `Geburtsdatum`

Die drei Kontaktattribute werden beim ersten Bedarf anhand ihres Namens und
Typs im SuperChat-Workspace gefunden oder automatisch angelegt. `Firma` und
`Adresse` sind Textfelder, `Geburtsdatum` ist ein reines Datumsfeld. Die
Adresse wird aus Straße, Hausnummer, Postleitzahl, Ort und Land zusammengesetzt.

Mindestens eine gültige E-Mail-Adresse oder Telefonnummer ist erforderlich.
Unbekannte Geschlechtswerte werden nicht übertragen. Die lokale Kontakt-ID,
Notizen, Versicherungsdaten und sonstige CRM-Felder verlassen das System nicht.

## Technischer Aufbau

- `src/lib/integrations/superchat.ts`: geschützter API-Client mit Timeout,
  erlaubtem Host, E.164-Normalisierung und reduzierten Fehlermeldungen.
- `POST /api/kontakte/[id]/superchat`: authentifizierte Serverroute. Sie lädt
  nur die benötigten Kontaktfelder, erstellt oder aktualisiert den
  Providerkontakt und speichert den lokalen Synchronisationsstand.
- `POST /api/kontakte/[id]/superchat/link-existing`: geschützte Sonderaktion,
  die SuperChat-Kontakte seitenweise liest und ausschließlich über eindeutige,
  exakte Kontaktwege mit Sentinel verknüpft.
- `POST /api/maintenance/superchat-link-existing`: einmalige, nur für
  Administratoren verfügbare Sammelaktion. Sie liest den SuperChat-Bestand nur
  einmal, gleicht alle noch nicht verknüpften aktiven Sentinel-Kontakte ab und
  liefert ausschließlich aggregierte Ergebniszahlen zurück.
- `src/components/SuperchatSyncButton.tsx`: Status und Nutzeraktion in der
  Kontaktdetailseite.
- Migration `0054_superchat_contact_sync.sql`: `superchat_id`,
  `superchat_last_sync` und `superchat_sync_error`.

Die API-Authentifizierung erfolgt ausschließlich serverseitig über
`X-API-KEY`. Provider-Antworten und personenbezogene Kontaktdaten werden nicht
in Server-Logs geschrieben.

## Konfiguration und Inbetriebnahme

1. Migration `0054_superchat_contact_sync.sql` auf Supabase anwenden.
2. In SuperChat als Administrator unter Einstellungen → Integrationen einen
   allgemeinen API-Schlüssel erstellen. Dafür ist das Integrations-Add-on
   erforderlich.
3. In Vercel `SUPERCHAT_API_KEY` als serverseitiges Secret hinterlegen.
4. `SUPERCHAT_API_URL` auf `https://api.superchat.com/v1.0` setzen oder
   weglassen, da dies der sichere Standard ist.
5. Einen synthetischen Pilotkontakt mit einer freigegebenen Testadresse
   übertragen und anschließend im SuperChat Contact Hub prüfen.

## Fehler- und Sicherheitsverhalten

- Nicht angemeldete oder deaktivierte Benutzer werden abgewiesen.
- Archivierte Kontakte werden nicht übertragen.
- Fehlende oder ungültige Kontaktwege brechen vor dem Provideraufruf ab.
- API-Key, Kontaktdaten und Provider-Rohantworten erscheinen nicht in Logs.
- Eine frei konfigurierte fremde API-Domain wird abgelehnt.
- Ein Fehler überschreibt keine bestehende SuperChat-ID; der Lauf kann erneut
  angestoßen werden.
- Ein HTTP-409 beim Anlegen wird nicht automatisch als sicherer Treffer
  interpretiert. Die Bestandsverknüpfung ist eine bewusste Sonderaktion mit
  eigenständiger, eindeutiger Prüfung.

## Bewusste Grenze des ersten Ausbaus

Der aktuelle Ausbau ist eine kontrollierte Einzelkontakt-Synchronisation. Eine
automatische Übertragung bei Neuanlage, Stapelübertragung, Kontaktlisten,
Nachrichten und ein Rückkanal von SuperChat sind nicht Bestandteil dieses
Features. Diese Erweiterungen sollten erst nach dem erfolgreichen Pilotlauf und
einer fachlichen Entscheidung zu Einwilligungen und WhatsApp-Prozessen folgen.

## Live-Pilot vom 29. Juli 2026

Der synthetische und technisch markierte Kontakt „TESTKONTAKT“ wurde in der
Produktionsumgebung angelegt und erfolgreich an SuperChat übertragen.

- Der Datensatz ist als Testdatensatz markiert.
- Die SuperChat-ID und der Synchronisationszeitpunkt wurden gespeichert.
- `superchat_sync_error` ist leer.
- Die Aktivität „Kontakt an SuperChat übertragen“ wurde protokolliert.
- Es wurden keine echten Kundendaten verwendet.

Beim ersten Versuch zeigte sich, dass die Live-Tabelle statt des älteren
UI-Felds `geschlecht` das Feld `anrede` führt. Die Serverroute wurde daraufhin
an das tatsächliche Live-Schema angepasst und der Pilot erfolgreich wiederholt.
