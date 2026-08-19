# Kommunikationszentrale — Konzept und erster technischer Schnitt

Stand: 19. August 2026  
Branch: `feature/zentrale-inbox`

## Zielbild

Sentimental Logic wird der zentrale Arbeitsplatz für Kundengespräche. Teammitglieder sehen offene,
eigene, nicht zugewiesene, ungelesene, zurückgestellte und erledigte Gespräche in einer gemeinsamen
Inbox. Der verwendete Transportanbieter ist für die Bedienung zweitrangig.

Die Trennung ist bewusst:

- **Sentimental Logic besitzt Arbeitszustand und Verlauf:** Zuweisung, Ungelesen-Zähler, Status,
  Kontaktsprung und interne Notizen.
- **Provider transportieren Nachrichten:** zunächst SuperChat als Übergang, später direkt die Meta
  WhatsApp Business Platform; weitere Kanäle können folgen.
- **Einheitliche Oberfläche:** Ein Providerwechsel verändert den Transportadapter, nicht den
  täglichen Arbeitsablauf des Teams.

## Erster Funktionsumfang auf dem Feature-Branch

- neue Seite `/kommunikation` mit Drei-Spalten-Aufbau
- Arbeitsansichten und Suche nach Kontakt, Firma, E-Mail, Telefon oder Nachrichtenvorschau
- Gesprächsverlauf mit Ein-/Ausgang, Zustellstatus und internen Notizen
- Zuweisung an aktive Teammitglieder
- als gelesen markieren, erledigen und wieder öffnen
- direkte Verknüpfung zur Kontaktdetailseite
- providerneutrale Datenbanktabellen für Gespräche und Nachrichten
- geschützte API-Routen und Berücksichtigung der persönlichen Testdaten-Sichtbarkeit
- Regressionstest `E2E-031`

Der echte Empfang und Versand ist in diesem Schnitt noch nicht aktiv. Die Antwortfläche weist darauf
hin und löst keinen externen API-Aufruf aus. Damit kann die neue Arbeitsoberfläche sicher geprüft
werden, während SuperChat produktiv unverändert weiterläuft.

## Datenmodell

`communication_conversations` speichert genau einen Arbeitsvorgang pro Provider-Gespräch. Die
Kombination aus `provider` und `provider_conversation_id` verhindert doppelte Importe.

`communication_messages` speichert die chronologische Historie. Eine Provider-Nachrichten-ID wird
innerhalb eines Gesprächs nur einmal angenommen. Interne Notizen verwenden dieselbe Chronologie,
sind aber durch `direction = internal` eindeutig von Kundennachrichten getrennt.

## Empfohlene nächste Schritte

1. Migration in einer nichtproduktiven Umgebung anwenden und das UI mit Testgesprächen abnehmen.
2. Read-only-Import bestehender SuperChat-Gespräche implementieren und Deduplizierung prüfen.
3. SuperChat-Webhooks für neue Nachrichten und Zustellstatus anbinden.
4. Antworten nach expliziter Pilotfreigabe über SuperChat senden; Fehler und Wiederholungen über
   das vorhandene `sync_runs`-Muster absichern.
5. Direkten Meta-WhatsApp-Adapter parallel aufbauen und mit einer eigenen Testnummer abnehmen.
6. Erst nach vollständiger Verlaufs-, Zustell- und Betriebsabnahme SuperChat abschalten.

## Sicherheits- und Betriebsregeln

- Keine Nachrichteninhalte oder Kontaktdaten in technische Logs schreiben.
- Webhooks müssen signiert, idempotent und wiederholbar verarbeitet werden.
- Ausgehende Nachrichten erhalten einen sichtbaren Sendestatus; fehlgeschlagene Zustellungen werden
  nicht stillschweigend wiederholt.
- Der Parallelbetrieb dient nur der kontrollierten Migration. Dieselbe WhatsApp-Nummer darf nicht
  unkoordiniert von zwei Providern verwaltet werden.
