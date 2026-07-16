# AMIS.Now Agent

Portabler Windows-Agent fuer AMIS.NOW-Auftraege. Er pollt das CRM, claimt offene AMIS-Auftraege als `in_bearbeitung`, steuert AMIS.Now im vorhandenen Edge-Profil, legt die Person an, berechnet optional ein Angebot, speichert einen Screenshot und schreibt `person_created`, `quoted` oder `error` zurueck.

Der Agent loest keine Abschluesse aus. Buttons oder Links mit Texten wie `Abschliessen`, `Antrag senden` oder `zahlungspflichtig` werden blockiert.

## Einrichtung

1. Node.js 20 LTS installieren oder portable Node.js neben diesen Ordner legen.
2. `install.ps1` ausfuehren.
3. `config.json` an die echte AMIS.Now-Oberflaeche anpassen.
4. `AMIS_AGENT_TOKEN` als Windows-Umgebungsvariable oder in einer lokalen `.env` setzen.
5. Im Dashboard/Vercel denselben Wert als Secret `AMIS_AGENT_TOKEN` setzen.
6. Fuer genau einen CRM-Testlauf `npm run once` starten. Fuer Dauerbetrieb `run.ps1` starten.

Passwoerter werden nicht im Code gespeichert. Die AMIS-Anmeldung erfolgt ueber das vorhandene Edge-Profil bzw. die normale Allianz-SSO-Sitzung.

## MVP-Test: Person mit lokalen Testdaten anlegen

1. In `config.json` `amisNowUrl` auf `https://sdw.allianz.de` setzen.
2. `dryRun` fuer einen echten Test auf `false` setzen.
3. Der Default `personCreate.mode = browser_mvp` nutzt die im Browser getestete Logik: Plus-Button, `Person anlegen`, manuelle Adresse, Telefon/E-Mail mit Tab/Blur.
4. Ausfuehren:

```powershell
npm run test-person
```

Der Agent liest `test-data/person-mvp.json`, legt diese Person an und stoppt danach. Es wird kein CRM-Job benoetigt und kein Angebot berechnet.

## CRM-Aufgabenarten

Ein CRM-Auftrag wird vom Agenten angenommen, wenn `status = offen` und `triggered_by_process_step = amis_now` ist. Der Agent setzt ihn beim Claim auf `in_bearbeitung`. Das Feld `amis_task_type` entscheidet den Ablauf:

- `person_create`: Person anlegen, Screenshot speichern, Status `person_created`.
- `person_create_quote`: Person anlegen, danach Angebotsprozess starten, berechnen, Status `quoted` oder `error`.

Lokale Tests:

```powershell
npm run test-person
npm run test-person-quote
```

CRM-Queue einmal testen:

```powershell
npm run once
```

Wenn `dryRun` in `config.json` auf `true` steht, fuellt der Agent die AMIS-Maske, klickt aber nicht auf `Anlegen`. Fuer den echten MVP-Test `dryRun` auf `false` setzen.

## Wichtige Konfiguration

- `crmBaseUrl`: URL des CRM-Dashboards.
- `amisNowUrl`: Start-URL von AMIS.Now.
- `selectors.fields`: CSS-Selektor nach Datenpfad im Job, z. B. `customer.last_name` oder `amis_input.birth_date`.
- `personCreate`: optionale Vorstufe fuer das Modal `Person anlegen`.
- `selectors.calculateButton`: ausschliesslich der Berechnen-Button.
- `selectors.premium` und `selectors.quoteNumber`: Elemente, aus denen Ergebniswerte gelesen werden.

Jeder Schritt wird in `logs/agent.log` protokolliert. Screenshots landen standardmaessig unter `screenshots/`.
