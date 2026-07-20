# Fehleranalyse Regressionstestlauf vom 20.07.2026

## Referenz

- GitHub-Actions-Lauf: `29734552494`
- Getesteter Commit: `e4afdb4`
- Umgebung: `https://sentinellogic.vercel.app`
- Ergebnis: 7 Tests, 2 erfolgreich, 5 fehlgeschlagen
- Vergleich: Der vorherige Lauf `29732470581` zeigte dieselben 5 fehlgeschlagenen Tests.

## Zusammenfassung

Die fünf roten Tests entsprechen nicht fünf voneinander unabhängigen Fehlern. Die Analyse ergibt:

1. Ein fehlerhafter Playwright-Selektor stoppt den Archiv-Test vor der eigentlichen Archivierung.
2. Eine nicht eindeutige Test-E-Mail blockiert vier weitere Tests bereits beim Anlegen ihrer Testkontakte.
3. Beim CSV-Import besteht zusätzlich ein dahinterliegender Anwendungsfehler: Das Feld `sparte` wird im Import korrekt erkannt, aber von der Kontakt-API beim Speichern verworfen.

Die Export- und Tag-Funktionen wurden im Lauf deshalb noch nicht fachlich geprüft. Ihre roten Ergebnisse dürfen derzeit nicht als Nachweis eines Export- oder Tag-Defekts interpretiert werden.

---

## TF-001: Archiv-Test verwendet einen mehrdeutigen Kontakt-Selektor

**Art:** Fehler im automatisierten Test  
**Priorität:** Hoch, weil der Test die Archivfunktion überhaupt nicht erreicht  
**Betroffener Test:** `archiviert einen Kontakt inkl. Aufgabe und stellt ihn wieder her`

### Ausgangslage

Der Testkontakt wird erfolgreich angelegt. Vor dem Archivieren sucht Playwright in der Kontaktliste nach dem Text `[TEST] ArchivTest`.

### Reproduktion

1. Regressionstestlauf mit gesetzter `PLAYWRIGHT_RUN_ID` starten.
2. Der Test legt den Kontakt `[TEST] ArchivTest` mit der Firma `[TESTDATEN] ArchivTest` an.
3. `/kontakte` öffnen und nach `ArchivTest` filtern.
4. Playwright führt `getByText('[TEST] ArchivTest')` ohne exakte Einschränkung aus.
5. Der Selektor trifft auf zwei Elemente:
   - den Kontaktnamen `[TEST] ArchivTest`
   - einen weiteren Listentext, der denselben Teiltext enthält
6. Playwright bricht wegen einer `strict mode violation` ab.

### Erwartetes Ergebnis

Der Test identifiziert genau den Namen des Testkontakts und fährt mit Archivieren, Aufgabenprüfung und Wiederherstellen fort.

### Tatsächliches Ergebnis

Der Test endet in `tests/e2e/kontakte-archive.spec.ts:20`, bevor der Button **Archivieren** betätigt wird.

### Nachgewiesene Ursache

Der Textselektor ist nicht eindeutig. Das CI-Protokoll weist ausdrücklich zwei Treffer aus. Es liegt an dieser Stelle kein Nachweis vor, dass die Archivfunktion selbst fehlerhaft ist.

### Empfohlene Korrektur

Den Kontakt innerhalb seines Listeneintrags über einen eindeutigen, stabilen Selektor identifizieren, zum Beispiel über exakten Text plus den zugehörigen Datensatz-Container oder über ein gezieltes `data-testid`.

### Abnahmekriterium

Der Test erreicht alle fachlichen Schritte und weist nach:

- aktiver Kontakt ist sichtbar,
- Kontakt und gewählte Aufgabe werden archiviert,
- Kontakt verschwindet aus der Standardansicht,
- Kontakt erscheint in der Archivansicht,
- Kontakt und Aufgabe können wiederhergestellt werden.

---

## TF-002: Alle Szenarien eines Testlaufs erzeugen dieselbe E-Mail-Adresse

**Art:** Fehler in der Testdaten-Erzeugung  
**Priorität:** Kritisch, weil vier Tests vor ihrer eigentlichen Prüfung blockiert werden  
**Betroffene Tests:** CSV-Export, XLSX/PDF-Export, CSV-Import und Tags

### Ausgangslage

Die Tests laufen mit einem Worker nacheinander. Der Hilfsbaustein `createPlaywrightTestContact()` erzeugt die E-Mail nur aus `PLAYWRIGHT_RUN_ID` und dem Standardsuffix `contact`. Der Szenarioname wird nicht in die E-Mail übernommen.

### Reproduktion

1. Einen kompletten Regressionstestlauf starten.
2. Der Archiv-Test erzeugt zuerst einen Kontakt mit einer E-Mail nach dem Muster `pw+<run-id>.contact@example.invalid`.
3. Der CSV-Export-Test erzeugt einen anderen Namen, aber erneut dieselbe E-Mail.
4. `POST /api/kontakte` erkennt das E-Mail-Duplikat und antwortet nicht erfolgreich.
5. Der Test bricht bei `expect(createRes.ok()).toBeTruthy()` ab.
6. XLSX/PDF und Tags scheitern anschließend aus demselben Grund.
7. Der CSV-Import verwendet ebenfalls dieselbe E-Mail. Der Import überspringt den Datensatz als Duplikat; die anschließende Suche nach `ImportTest` findet keinen neu angelegten Kontakt.

### Erwartetes Ergebnis

Jedes Testszenario erhält innerhalb desselben Laufs einen eindeutig markierten Testkontakt. Die Tests beeinflussen sich nicht gegenseitig.

### Tatsächliches Ergebnis

- CSV-Export stoppt beim Anlegen des Testkontakts in Zeile 8.
- XLSX/PDF-Export stoppt beim Anlegen des Testkontakts in Zeile 30.
- Tags stoppt beim Anlegen des Testkontakts in Zeile 9.
- Import meldet den Ablauf als beendet, hat wegen des Duplikats aber keinen passenden Kontakt angelegt; `sparte` wird deshalb als `undefined` gelesen.

### Nachgewiesene Ursache

Alle Aufrufe ohne eigenes Suffix berechnen dieselbe E-Mail-Adresse. Der erste Kontakt des Laufs belegt sie; alle folgenden Anlageversuche kollidieren mit der Duplikatprüfung der Anwendung.

### Empfohlene Korrektur

Den normalisierten Szenarionamen zwingend in den Kontaktmarker aufnehmen oder bei jedem Aufruf ein eindeutiges Suffix verlangen. Zusätzlich sollten Assertions auf API-Antworten Statuscode und bereinigte Fehlermeldung ausgeben, damit ein HTTP-409-Duplikat im Dashboard sofort erkennbar ist.

### Abnahmekriterium

- Alle in einem Lauf erzeugten Testkontakte haben unterschiedliche, eindeutig markierte E-Mail-Adressen.
- Die vier betroffenen Tests passieren die Kontaktanlage.
- Export- und Tag-Schritte werden anschließend tatsächlich ausgeführt und separat bewertet.

---

## AF-001: CSV-Import erkennt `Sparte`, Kontakt-API speichert das Feld jedoch nicht

**Art:** Anwendungsfehler in der Datenübergabe  
**Priorität:** Hoch, da importierte Fachdaten verloren gehen können  
**Betroffener Ablauf:** CSV-Import erweiterter Kontaktfelder

### Ausgangslage

Das Import-Modal ordnet die CSV-Spalte `Sparte` korrekt dem internen Feld `sparte` zu und sendet dieses Feld an `POST /api/kontakte`.

### Reproduktion

1. Auf `/kontakte` **Importieren** öffnen.
2. Eine eindeutig neue Test-CSV mit `Vorname,Nachname,E-Mail,Firma,Sparte` hochladen.
3. Für `Sparte` den Wert `PKV` verwenden.
4. Auto-Mapping kontrollieren und Import ausführen.
5. Den angelegten Kontakt über `/api/kontakte?search=<Nachname>` oder in der Detailansicht prüfen.

### Erwartetes Ergebnis

Der neue Kontakt enthält `sparte = "PKV"`.

### Tatsächliches Ergebnis

Im getesteten API-Code wird `body.sparte` nicht in das Insert-Objekt `kontaktData` übernommen. Damit kann der Wert trotz korrektem Mapping nicht gespeichert werden.

### Nachgewiesene Ursache

Frontend und API besitzen unterschiedliche Feldlisten: Das Import-Modal erlaubt `sparte`, die POST-Route der Kontakt-API lässt dieses Feld beim Aufbau des Datenbankobjekts aus.

Der aktuelle CI-Lauf wird zuerst durch TF-002 blockiert. Dieser Anwendungsfehler ist jedoch unabhängig davon direkt im deployten Code nachweisbar und würde nach Beseitigung der E-Mail-Kollision sichtbar werden.

### Empfohlene Korrektur

Die zulässigen Import-/Kontaktfelder zentral definieren und für Mapping, Validierung sowie API-Persistenz gemeinsam verwenden. Mindestens `sparte` muss validiert in `kontaktData` übernommen werden; anschließend sollten auch die übrigen im Import angebotenen erweiterten Felder auf dieselbe Lücke geprüft werden.

### Abnahmekriterium

- Ein neuer CSV-Kontakt speichert `sparte = "PKV"` dauerhaft.
- Der Wert bleibt nach Seitenreload und erneutem API-Abruf erhalten.
- Ein ergänzender Test prüft mehrere repräsentative erweiterte Felder, nicht nur `sparte`.

---

## Empfohlene Reihenfolge

1. TF-002 beheben, weil dieser Fehler vier Tests blockiert.
2. TF-001 beheben, damit die Archivfunktion vollständig geprüft wird.
3. AF-001 beheben und die gesamte Import-Feldliste abgleichen.
4. Regressionstest erneut ausführen.
5. Erst danach eventuell verbleibende Export-, Tag- oder Archivfehler als eigene Anwendungsfehler aufnehmen.

## Verbesserung der künftigen Fehlerdiagnose

Bei API-Schritten sollten Tests neben `response.ok()` immer den Statuscode und eine datenschutzkonform bereinigte API-Fehlermeldung erfassen. Im Testdashboard sollte pro Fehler zusätzlich der fehlgeschlagene Testschritt angezeigt werden. So wird unmittelbar erkennbar, ob eine Funktion selbst scheitert oder bereits die Testvorbereitung fehlgeschlagen ist.
