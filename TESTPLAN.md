# Testplan — SentinelLogic Integrationen

**Stand:** 2026-06-25  
**Getestet bis:** Dialfire Sync (Supabase → Dialfire), KlickTipp Integration, Calendar View  
**Umgebung:** https://sentinellogic.vercel.app

---

## 1. AUFGABEN (Tasks) — KALENDER VIEW & MANAGEMENT

### 1.1 Kalender-Ansicht (Monat & Woche)
- [ ] Öffne **Dashboard → Kalender**
- [ ] Prüfe: Zwei View-Optionen sichtbar (Monat / Woche)
- [ ] Klick auf **Monat** → zeigt Kalender mit allen Tagen
- [ ] Klick auf **Woche** → zeigt 7-Tage-Ansicht mit stündlicher Auflösung
- [ ] Navigiere durch Monate/Wochen mit Pfeilen (← & →)
- [ ] Tage mit Aufgaben sollten visuell hervorgehoben sein (z.B. Punkt oder Highlighting)

### 1.2 Status-Filter
- [ ] Rechts oben: **Filter-Dropdown** sichtbar
- [ ] **Default-Einstellung**: Aufgaben mit Status "erledigt" sind NICHT sichtbar ✓
- [ ] Klick auf Filter → Optionen sichtbar:
  - [ ] "Alle außer erledigt" (default)
  - [ ] "Nur erledigt"
  - [ ] "Alle anzeigen"
- [ ] Nach Filteränderung: Kalender-Anzeige aktualisiert sich sofort
- [ ] Filtereinstellung bleibt gespeichert nach Seite neu laden (localStorage)

### 1.3 Task-Details in der Sidebar
- [ ] Klick auf einen Tag mit Aufgaben
- [ ] **Rechts in der Sidebar**: Tagesdetails mit **Überschrift** (Datum)
- [ ] Alle Tasks dieses Tages sollten aufgelistet sein mit:
  - [ ] Task-Titel (klickbar)
  - [ ] Status (z.B. "neu", "in Arbeit", "erledigt")
  - [ ] Priorität (z.B. "hoch", "mittel", "niedrig") — farblich markiert
  - [ ] Fälligkeitsdatum/Uhrzeit (wenn vorhanden)
- [ ] Klick auf Task-Titel → öffnet Task-Detail-Seite

### 1.4 Task-Detail-Seite
- [ ] Öffne einen Task über Kalender oder aus Liste
- [ ] **Header** zeigt:
  - [ ] Task-Titel (editierbar)
  - [ ] Status-Selektor (neu / in Arbeit / erledigt / storniert)
  - [ ] Priorität mit farblichem Indikator
- [ ] **Beschreibung** (Textarea, editierbar)
- [ ] **Fälligkeitsdatum** mit Uhrzeit (Datepicker)
- [ ] **Zugewiesen an** (Kontakt-Selektor, optional)
- [ ] **Kategorie** oder **Tag** (falls vorhanden)
- [ ] **Notizen** (Freitextfeld)
- [ ] **Aktivitäten-Timeline** (z.B. "Status geändert", "erstellt am...")
- [ ] Button: **Speichern** (oder Auto-Save)

### 1.5 Task-Erstellung
- [ ] Öffne Kalender → Klick auf leeren Tag → **+ Neue Aufgabe** Button
- [ ] Formular öffnet sich mit:
  - [ ] Titel (Pflichtfeld)
  - [ ] Fälligkeitsdatum (auto-gesetzt auf Klik-Datum)
  - [ ] Status (default: "neu")
  - [ ] Priorität (optional, default: "mittel")
  - [ ] Beschreibung (optional)
- [ ] Klick **Speichern** → Task wird erstellt und im Kalender angezeigt
- [ ] Task erscheint sofort im Kalender-View

### 1.6 Task-Bearbeitung & Status-Änderung
- [ ] Öffne einen existierenden Task
- [ ] Ändere Status (z.B. "neu" → "in Arbeit")
- [ ] Prüfe: Status-Änderung wird sofort im Kalender sichtbar
- [ ] Wenn Status = "erledigt" → Task verschwindet aus Standard-Kalender-View
- [ ] Wechsel Filter zu "Nur erledigt" → erledigte Task erscheint wieder
- [ ] Ändere Fälligkeitsdatum → Task wird im Kalender an neuem Datum angezeigt
- [ ] Aktivitäten-Log sollte alle Änderungen tracken

### 1.7 Task-Löschung
- [ ] Öffne einen Task
- [ ] Klick auf **Löschen** Button
- [ ] Bestätigungsdialog sollte erscheinen
- [ ] Nach Bestätigung: Task wird gelöscht
- [ ] Task verschwindet aus Kalender-View

### 1.8 Task-Liste (alternative Ansicht)
- [ ] Öffne **Dashboard → Aufgaben** (oder Tasks Liste)
- [ ] Alle Tasks sollten in Listenform angezeigt werden
- [ ] Spalten sichtbar:
  - [ ] Status (mit Icon/Badge)
  - [ ] Titel
  - [ ] Fälligkeitsdatum
  - [ ] Priorität (farblich)
  - [ ] Zugewiesen an (falls vorhanden)
- [ ] **Sortierung** möglich nach:
  - [ ] Fälligkeitsdatum (aufsteigend/absteigend)
  - [ ] Priorität
  - [ ] Status
- [ ] **Filter** möglich nach:
  - [ ] Status (neu / in Arbeit / erledigt / storniert)
  - [ ] Priorität
  - [ ] Zugewiesen an
- [ ] Inline-Aktionen pro Zeile:
  - [ ] Klick → öffnet Detail
  - [ ] Status ändern (Dropdown direkt in Zeile)
  - [ ] Löschen (mit Bestätigung)

### 1.9 Performance & Usability
- [ ] Kalender lädt schnell (< 2 Sekunden)
- [ ] Bei vielen Tasks (> 50): Kalender bleibt responsive
- [ ] Sidebar scrollbar erscheint wenn viele Tasks an einem Tag
- [ ] Responsive auf Mobilgeräten:
  - [ ] Kalender passt sich an Bildschirmgröße an
  - [ ] Touch-freundlich (größere Tappziele)
  - [ ] Sidebar wird zu Drawer/Modal auf Mobile

---

## 2. KONTAKT-VERWALTUNG & INTEGRATIONEN

### 2.1 Kontakt-Detail View
- [ ] Öffne **Kontakte** → wähle einen Kontakt
- [ ] **Übersicht-Tab** sollte zeigen:
  - [ ] Kontaktinformationen (E-Mail, Telefon, Website)
  - [ ] Adresse
  - [ ] Status, Quelle, Qualität, Bestandskunde, Erstellt-Datum
  - [ ] **KlickTipp Block** (blau, mit 🔗 Icon) — falls Kontakt synced
  - [ ] **Dialfire Block** (lila, mit 📞 Icon) — falls Kontakt synced

### 2.2 KlickTipp Integration
- [ ] Öffne einen Kontakt mit KlickTipp-ID (blauer Block)
- [ ] Prüfe: **ID**, **Tags** (z.B. "Sentinel"), **Letzer Sync** Timestamp
- [ ] Tags sollten als Badges dargestellt sein (#tag1, #tag2)
- [ ] Timestamp sollte lesbar sein (z.B. "25.6.2026 12:30")

### 2.3 Dialfire Integration
- [ ] Öffne einen Kontakt mit Dialfire-ID (lilaner Block)
- [ ] Prüfe Felder:
  - [ ] **ID** (alphanumerisch, z.B. "8CV2QPU3W6MKD25K")
  - [ ] **Task** (sollte "call" sein)
  - [ ] **Letzer Sync** Timestamp
- [ ] Falls **Fehler vorhanden**: Block wird rot, zeigt Fehlermeldung

### 2.4 Aktivitäts-Timeline
- [ ] Klick auf **Aktivitäten-Tab**
- [ ] Timeline sollte Einträge mit **Icons** zeigen:
  - [ ] 🔗 Blau = KlickTipp Aktivitäten
  - [ ] 📞 Lila = Dialfire Aktivitäten
  - [ ] ✓ Grün = Task Aktivitäten
- [ ] Jeder Eintrag zeigt: **Type-Label**, **Beschreibung**, **Zeitstempel**
- [ ] Zeitstempel sollte lesbar sein (z.B. "25.6.2026 12:30")

---

## 3. DIALFIRE SYNC (Supabase → Dialfire)

### 3.1 Neuen Kontakt erstellen
- [ ] Öffne **Kontakte** → Klick **+ Neuer Kontakt**
- [ ] Fülle aus:
  - [ ] Vorname: "Test"
  - [ ] Nachname: "Dialfire"
  - [ ] E-Mail: "test.dialfire@example.de"
  - [ ] Telefon: "+49123456789"
  - [ ] Straße: "Teststraße 42"
  - [ ] Alle Felder komplett füllen (siehe Kontakt-Formular)
- [ ] Klick **Speichern**
- [ ] Warte 2 Sekunden

### 3.2 Dialfire-Sync prüfen
- [ ] Öffne den neu erstellten Kontakt
- [ ] Prüfe: **Dialfire Block** sollte sichtbar sein (lila, 📞)
- [ ] Block sollte anzeigen:
  - [ ] **ID**: alphanumerisch (z.B. "ABC123XYZ")
  - [ ] **Task**: "call"
  - [ ] **Letzer Sync**: aktuelles Datum/Zeit
- [ ] Klick auf **Aktivitäten-Tab**
- [ ] Neue Aktivität: "Dialfire synced (...)" mit 📞 Icon

### 3.3 Fehlerbehandlung
- [ ] Falls Dialfire Block **rot** ist (Fehler):
  - [ ] Fehlermeldung sollte sichtbar sein
  - [ ] Prüfe: Fehler ist aussagekräftig
  - [ ] **Hinweis an Betreuer:** Fehler mit Screenshot dokumentieren

---

## 4. KLICKTIPP INTEGRATION (optional — bereits deployed)

### 4.1 Neue Kontakte mit KlickTipp-Tag
- [ ] Erstelle neuen Kontakt mit:
  - [ ] Tag: "TestTag" hinzufügen (falls UI vorhanden)
  - [ ] Speichern
- [ ] Öffne Kontakt → prüfe **KlickTipp Block**:
  - [ ] **ID**: sollte gespeichert sein
  - [ ] **Tags**: sollte "TestTag" anzeigen
  - [ ] **Letzer Sync**: Timestamp

---

## 5. FEHLERBEHANDLUNG

### Wenn Dialfire-Block fehlt oder rot ist:
- [ ] Screenshot des Fehlers machen
- [ ] Im Kontakt-Detail: **Aktivitäten-Tab** öffnen
- [ ] Nach "Dialfire sync failed" suchen
- [ ] Fehlermeldung notieren
- [ ] **Betreuer benachrichtigen** mit Screenshot & Fehlertext

### Wenn Kalender nicht lädt:
- [ ] Browser-Konsole öffnen (F12)
- [ ] Fehler notieren und **Betreuer benachrichtigen**

---

## 6. CHECKLISTE FÜR BETREUER

Nachdem Tests abgeschlossen:

- [ ] Alle Basis-Tests erfolgreich
- [ ] Keine kritischen Fehler in Dialfire-Block gefunden
- [ ] Aktivitäts-Timeline funktioniert
- [ ] Kalender-View funktioniert
- [ ] KlickTipp Integration aktiv
- [ ] Screenshots/Fehler dokumentiert (falls vorhanden)

**Nächste Schritte:**
- Dialfire Polling (Rück-Sync) nach REST API Token-Konfiguration testen
- Weitere Integrationen nach Bedarf hinzufügen

---

## 7. PLACETEL TELEFONIE (nach Pilot-Konfiguration)

### 7.1 Click-to-Call
- [ ] Technisch markierten Testkontakt mit freigegebener Placetel-Testnummer öffnen
- [ ] Prüfen, dass Mobil- und Büronummer bewusst ausgewählt werden können
- [ ] Anruf über den Placetel-Button starten
- [ ] Prüfen, dass keine Zugangsdaten im Browser, Netzwerk-Response oder Log erscheinen
- [ ] Prüfen, dass Doppelklicks und mehr als fünf Versuche pro Minute blockiert werden

### 7.2 Callback und Anrufhistorie
- [ ] Je einen redigierten Callback für eingehend, ausgehend, angenommen und aufgelegt senden
- [ ] Denselben Callback erneut senden und prüfen, dass kein doppelter Anruf entsteht
- [ ] Falsches Callback-Secret, unbekanntes Event und zu großen Body kontrolliert ablehnen
- [ ] Eindeutige Rufnummer automatisch dem Testkontakt zuordnen
- [ ] Doppelte Rufnummer als mehrdeutig markieren und nicht automatisch zuordnen
- [ ] Status, Richtung, Zeitpunkt und Dauer im Placetel-Tab prüfen

### 7.3 Gesprächsergebnis
- [ ] Ergebnis „Termin vereinbart“ mit synthetischer Notiz speichern
- [ ] Seite neu laden und dauerhafte Speicherung prüfen
- [ ] Ergebnis bearbeiten und Aktivitätseintrag prüfen
- [ ] Nach Implementierung der Ergebnisregeln die erzeugte Aufgabe bzw. den KlickTipp-Tag prüfen

---

## KONTAKT BEI FRAGEN

Falls während des Tests Fragen entstehen:
1. **Fehler in Aktivitäten-Log prüfen** (Aktivitäten-Tab)
2. **Screenshot des Fehlers machen**
3. **Betreuer kontaktieren** mit Screenshot & Beschreibung

---

**Testplan erstellt:** 2026-06-25  
**Version:** 1.1
