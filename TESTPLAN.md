# Testplan — SentinelLogic Integrationen

**Stand:** 2026-06-25  
**Getestet bis:** Dialfire Sync (Supabase → Dialfire), KlickTipp Integration, Calendar View  
**Umgebung:** https://sentinellogic.vercel.app

---

## 1. KALENDER VIEW

### 1.1 Basis-Funktionalität
- [ ] Öffne **Dashboard → Kalender**
- [ ] Prüfe: Zwei View-Optionen vorhanden (Monat / Woche)
- [ ] Klick auf **Monat** → zeigt Kalender mit allen Tagen
- [ ] Klick auf **Woche** → zeigt 7-Tage-Ansicht
- [ ] Navigiere durch Monate/Wochen mit Pfeilen

### 1.2 Status-Filter
- [ ] Rechts oben: Filter-Dropdown sichtbar
- [ ] Default-Status: Tasks mit "erledigt" sind NICHT sichtbar ✓
- [ ] Klick auf Filter → nur Tasks mit "erledigt" anzeigen
- [ ] Klick erneut → zurück auf Standard (ohne "erledigt")

### 1.3 Task-Details
- [ ] Klick auf einen Tag mit Tasks
- [ ] Rechts in der Sidebar: Tagesdetails mit allen Tasks
- [ ] Klick auf Task-Titel → öffnet Task-Detail-Seite
- [ ] Prüfe: Priorität, Status, Fälligkeitsdatum werden korrekt angezeigt

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

## KONTAKT BEI FRAGEN

Falls während des Tests Fragen entstehen:
1. **Fehler in Aktivitäten-Log prüfen** (Aktivitäten-Tab)
2. **Screenshot des Fehlers machen**
3. **Betreuer kontaktieren** mit Screenshot & Beschreibung

---

**Testplan erstellt:** 2026-06-25  
**Version:** 1.0
