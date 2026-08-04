# STRATO E-Mail-Postfach

## Ziel

Das Kundenpostfach wird direkt in Sentimental Logic bereitgestellt. Der Posteingang wird über IMAP gelesen, neue Nachrichten und Antworten werden über SMTP verschickt. Das bestehende STRATO-Webmail bleibt parallel voll nutzbar.

## Technische Anbindung

| Funktion | Server | Port | Sicherheit |
|---|---|---:|---|
| Posteingang (IMAP) | `imap.strato.de` | 993 | SSL/TLS |
| Postausgang (SMTP) | `smtp.strato.de` | 465 | SSL/TLS |

Die Anmeldung erfolgt mit der vollständigen E-Mail-Adresse und dem Postfach-Passwort. TLS 1.2 oder neuer wird erzwungen.

## Konfiguration

Folgende Variablen müssen in Vercel für Produktion gesetzt werden:

```text
STRATO_MAIL_USER=<vollständige E-Mail-Adresse>
STRATO_MAIL_PASSWORD=<Postfach-Passwort>
STRATO_MAIL_SENDER_NAME=Allianz Generalvertretung Gün
STRATO_IMAP_HOST=imap.strato.de
STRATO_IMAP_PORT=993
STRATO_SMTP_HOST=smtp.strato.de
STRATO_SMTP_PORT=465
```

Das Passwort darf weder in Git noch in Logs oder Browser-Antworten erscheinen.

## Funktionsumfang des MVP

- Posteingang mit Gelesen-/Ungelesen-Status
- Einzelne Nachricht sicher als Text lesen
- E-Mail schreiben und auf eine Nachricht antworten
- Bekannte Absender automatisch mit einem Kontakt verknüpfen
- Eingehende E-Mails bekannter Kontakte idempotent in der Aktivitäten-Timeline protokollieren
- Kontakt-E-Mail-Dialog über STRATO senden, sobald STRATO konfiguriert ist
- Ausgehende E-Mail als Kontaktaktivität protokollieren, ohne den Nachrichtentext abzulegen

## Bewusste Grenzen

- Anhänge werden mit Name und Größe angezeigt, aber noch nicht zum Download angeboten.
- Zunächst wird ausschließlich der Posteingang dargestellt; Ordner wie „Gesendet" oder „Entwürfe" folgen später.
- Es werden keine E-Mail-Inhalte dauerhaft in Supabase kopiert. Die App liest Nachrichten bei Bedarf direkt per IMAP.
- HTML-E-Mails werden als ungefährlicher Klartext dargestellt; externe Bilder und aktive Inhalte werden nicht geladen.

## Eingehende Aktivitäten

Beim Laden oder Aktualisieren des Posteingangs wird die Absenderadresse exakt und ohne Beachtung der Groß-/Kleinschreibung mit den Kontaktadressen abgeglichen. Nur ein eindeutiger Treffer erzeugt eine Aktivität vom Typ `email_received`.

Ein SHA-256-Schlüssel aus Postfach und technischer Nachrichtenkennung verhindert doppelte Timeline-Einträge. In Supabase werden nur dieser technische Schlüssel, Kontaktbezug, Betreff, Empfangszeitpunkt und technische Mailkennung gespeichert. Nachrichtentext und Absenderadresse werden nicht dauerhaft übernommen.

Unbekannte oder mehrdeutige Absender werden nicht protokolliert. Wird später ein eindeutiger Kontakt angelegt oder korrigiert, kann die Aktivität beim nächsten Postfachabgleich nachgeholt werden.
