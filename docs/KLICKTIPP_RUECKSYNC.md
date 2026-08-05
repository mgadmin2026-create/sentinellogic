# KlickTipp-Rücksynchronisation

## Ziel und Systemgrenze

Der Rückkanal ergänzt den bestehenden Kontakt- und Tag-Sync von Sentimental
Logic zu KlickTipp. Er ersetzt oder verändert den Outbound-Sync nicht.

- Sentimental Logic bleibt führend für Stammdaten, Vertriebsstatus und Aufgaben.
- KlickTipp bleibt während der Übergangsphase führend für den E-Mail-Anmeldestatus.
- KlickTipp-Ereignisse werden datensparsam und idempotent in Sentimental Logic gespeichert.
- Der Rückkanal legt niemals neue Kontakte an.
- Eingehende Tagereignisse werden zunächst nur protokolliert. Sie überschreiben
  nicht die bestehenden, von Sentimental Logic ausgehenden Tagzuordnungen.

## Sichere Rollout-Reihenfolge

1. Migration `0064_klicktipp_reverse_sync.sql` auf Supabase anwenden.
2. Ein zufälliges Secret mit mindestens 32 Zeichen als
   `KLICKTIPP_WEBHOOK_SECRET` in Vercel hinterlegen und neu deployen.
3. Den geschützten Statusabgleich einmal manuell gegen einen Pilotkontakt ausführen.
4. Erst danach Webhooks in KlickTipp anlegen und testen.
5. Öffnung, Klick, Abmeldung und ein doppeltes Testereignis kontrollieren.
6. Den Statusabgleich erst nach dem Pilot regelmäßig aufrufen.

## KlickTipp-Webhook

Ziel-URL:

```text
https://<vercel-domain>/api/webhooks/klicktipp-incoming
```

Methode und Format:

```text
POST / JSON
```

Jeder KlickTipp-Webhook erhält einen festen `event_type`. Empfohlene Werte:

- `email_received`
- `email_opened`
- `email_clicked`
- `campaign_started`
- `campaign_finished`
- `tag_added`
- `tag_removed`
- `subscribed`
- `opt_in_pending`
- `unsubscribed`
- `soft_bounce`
- `hard_bounce`

Erforderliche beziehungsweise empfohlene Felder:

| Parameter | Inhalt |
|---|---|
| `webhook_token` | Exakt derselbe Wert wie `KLICKTIPP_WEBHOOK_SECRET` |
| `event_type` | Einer der oben definierten Ereignistypen |
| `event_id` | Wenn KlickTipp eine stabile Ereignis-ID bereitstellt |
| `klicktipp_id` | Interne Kontakt-ID in KlickTipp |
| `email` | Nur als Rückfall, wenn keine KlickTipp-ID verfügbar ist |
| `occurred_at` | Ereigniszeitpunkt im ISO-Format |
| `email_status` | `Subscribed`, `Opt-In Pending`, `Unsubscribed`, `Soft Bounce` oder `Hard Bounce` |
| `campaign_name` | Kampagnenname, sofern vorhanden |
| `message_name` | E-Mail-/Nachrichtenname, sofern vorhanden |
| `tag_name` | Tag bei Tagvergabe oder Tagentzug |
| `link_label` | Bezeichnung des geklickten Links, nicht die vollständige URL |

Das Secret darf nicht als URL-Parameter verwendet werden. Es wird als statischer
POST-Wert `webhook_token` konfiguriert. Vollständige Payloads, E-Mail-Adressen und
URLs werden nicht in der technischen Ereignistabelle gespeichert.

## Statusabgleich

Der geschützte Endpoint

```text
GET /api/cron/klicktipp-status
Authorization: Bearer <CRON_SECRET>
```

prüft pro Lauf bis zu 100 aktive Kontakte mit gespeicherter KlickTipp-ID. Er
arbeitet die am längsten nicht geprüften Kontakte zuerst ab und verändert keine
Stammdaten oder Tags. Ein regelmäßiger Scheduler wird bewusst erst nach dem
Pilot aktiviert.

## Fehler- und Duplikatverhalten

- Identische Ereignisse werden über Fingerprints nur einmal verarbeitet.
- Nicht zuordenbare Ereignisse bleiben als `unmatched` zur späteren Prüfung erhalten.
- Verarbeitungsausfälle liefern HTTP 503, damit KlickTipp einen erneuten Versuch machen kann.
- Ungültige Payloads und falsche Secrets werden abgelehnt.
- Technische Logs enthalten keine Kontaktdaten.
