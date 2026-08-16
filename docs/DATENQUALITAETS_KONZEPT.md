# Datenqualitäts-Center — Konzept

> Entwurf zur Prüfung. Noch nicht umgesetzt. Löst den Roadmap-Punkt „Datenqualitäts-Agent"
> (`docs/ROADMAP.md`, Phase D) von einer reinen Stichwort-Idee zu einem ausgereiften Konzept auf.
>
> Stand: 2026-08-16 — Entwurf, ungeprüft

---

## 1. Ausgangslage

Zwei Konzeptquellen sind in dieses Dokument eingeflossen:

1. Eine ursprüngliche, bewusst nur stichwortartig in der Roadmap vermerkte Idee: ein periodischer
   Check auf vier konkrete Inkonsistenzen (Status „Qualifiziert" ohne Angebot, Status „Kunde"
   ohne Vertrag, Status „Kontaktiert" bzw. offene Aufgabe seit X Tagen ohne Fortschritt).
2. Ein vom Nutzer bereits an anderer Stelle ausgearbeitetes, bewusst **system- und
   branchenunabhängiges** Konzept für einen „KI-gestützten Datenprüfungsassistenten" — mit
   Regelbibliothek, Freitext-Regeldefinition, durchnummerierten Prüfungen/Regeln/Verstößen,
   Prüfprotokoll und einer langfristigen Vision als „Quality Center" für Daten- **und**
   Prozessprüfungen.

Dieses Dokument führt beide zu einem auf Sentinel Logic zugeschnittenen Konzept zusammen —
**nicht** als eigenständiges, verkaufbares Werkzeug, sondern als ein Baustein innerhalb der
bestehenden Automatisierungs-/Sync-Architektur (`docs/ROADMAP.md` Phase A, `sync_runs`,
Automatisierungsregeln).

## 2. Was aus beiden Quellen übernommen wird

| Element | Quelle | Warum |
|---|---|---|
| Durchnummerierte Prüfung → Regel → Verstoß, dauerhaft nachvollziehbar | Nutzer-Konzept | Deckt sich mit dem bereits bestehenden `sync_runs`-Ausführungsmodell (Batch/Item-Verschachtelung) — keine neue Infrastruktur nötig, nur ein neuer „Integrationstyp" darin |
| „Eine nicht ausführbare Regel darf die Gesamtprüfung nicht abbrechen" | Nutzer-Konzept | Direkt übernehmbares Resilienz-Prinzip für die Check-Engine |
| Regelbibliothek mit Aktivieren/Deaktivieren/Kategorisieren | Nutzer-Konzept | Gleiches UI-Muster wie die bestehenden Automatisierungsregeln (`rules`-Tabelle, `/regeln`) |
| Zusammenfassung/Dashboard je Prüflauf | Nutzer-Konzept | Gleicher Look wie das bestehende `/sync`-Control-Center |
| Weiterentwicklung zu Prozessprüfungen, nicht nur Datenprüfungen („Quality Center") | Nutzer-Konzept | Deckt sich mit einer bereits im Code dokumentierten offenen Lücke (siehe Abschnitt 4) |
| KI ergänzt die Regel-Engine, ersetzt sie nicht; Freitext-Regeln sind eine spätere Ausbaustufe | Nutzer-Konzept | Übernommen, aber zeitlich noch weiter nach hinten gestellt (siehe Abschnitt 6) |
| Vier konkrete Ursprungs-Checks (Qualifiziert ohne Angebot, Kunde ohne Vertrag, Kontaktiert/Offen seit X Tagen) | Ursprungs-Idee | Bleiben der Kern der ersten Regelbibliothek, ergänzt um weitere in Abschnitt 4 |

## 3. Was bewusst nicht übernommen wird

- **System-/Branchenunabhängigkeit** (eigene Datenmodelle für CRM/Versicherung/E-Commerce,
  Excel/CSV/API als austauschbare Datenquellen). Sentinel Logic ist ein System mit einem festen
  Schema — eine quellen-/branchenagnostische Engine löst ein Problem, das hier nicht existiert.
  Die Prüfung läuft **immer** direkt gegen die eigene Supabase-Instanz, kein Datenauswahl-Schritt.
- **Freitext-Regeln, die eine KI live interpretiert und ungeprüft scharf schaltet.** Eine
  falsch interpretierte Regel erzeugt entweder Fehlalarme (die das Team irgendwann ignoriert)
  oder lässt echte Verstöße durchrutschen, ohne dass es auffällt — bei einem Werkzeug, dessen
  Wert auf Vertrauenswürdigkeit beruht, ein zu hohes Risiko für den ersten Wurf. Freitext-Regeln
  bleiben eine spätere Ausbaustufe mit Bestätigungsschritt (Abschnitt 6), nicht Teil von Version 1.
- **Mehrstufiger Wizard-Flow** („Prüfung starten" → „Daten bereitstellen" → „Regeln definieren").
  Da es nur eine Datenquelle gibt, entfällt der Datenbereitstellungs-Schritt komplett — die
  Prüfung läuft automatisch (nächtlicher Cron, analog zu den bestehenden Sync-Jobs) plus einem
  manuellen „Jetzt prüfen"-Button.
- **Regel-Versionierung.** Bei einer erwartbar kleinen, kuratierten Regelzahl (~6–10 zum Start)
  reicht Aktiv/Inaktiv + „zuletzt geändert" — eine echte Versionshistorie ist Overhead ohne
  aktuellen Bedarf.

## 4. Erste Regelbibliothek (Version 1, alle deterministisch, keine KI nötig)

| # | Regel | Prüft | Schweregrad |
|---|---|---|---|
| 1 | Qualifiziert ohne Angebot | `contacts.status = 'qualified'` und kein zugehöriger `angebote`-Eintrag | Mittel |
| 2 | Kunde ohne Vertrag | `contacts.status = 'customer'` und kein zugehöriger `contracts`-Eintrag | Hoch |
| 3 | Angebot gewonnen, Beitragsübersicht nicht aktualisiert | `angebote.status = 'gewonnen'` seit über X Tagen, `contacts.beitragsuebersicht` seitdem nicht verändert | Hoch — schließt die in v0.32.0 bewusst offen gelassene Lücke (siehe unten) |
| 4 | Kontaktiert ohne Fortschritt | `contacts.status = 'contacted'` seit über X Tagen ohne neue Aktivität | Niedrig |
| 5 | Aufgabe überfällig ohne Reaktion | `tasks.status != 'erledigt'` und `fällig` seit über X Tagen überschritten | Mittel |
| 6 | Pipeline-Schritt überfällig | einzelner `pipeline_steps[].due_date` überschritten — unabhängig vom Gesamtstatus, da ein Kontakt insgesamt „im Plan" wirken kann, während ein einzelner Schritt schon überfällig ist | Niedrig |
| 7 | Kontakt ohne Verantwortlichen | `assigned_user_id IS NULL` bei einem Kontakt in aktiver Pipeline (nicht `new`, nicht archiviert) | Mittel |
| 8 | Sparte fehlt trotz Qualifizierung | `status IN ('qualified','customer')` ohne Eintrag in `contact_sparte_map` — blockiert den Erstgespräch-Leitfaden und die NL→SQL-Selektion | Niedrig |

Regel 3 ist die praktisch wichtigste: Seit v0.32.0 zeigt „Angebot gewonnen" nur einen
dismissable Hinweis-Banner (`gewonnenHinweis` in `angebote/page.tsx` und
`KontaktAngeboteTab.tsx`), der nach dem Wegklicken für immer verschwindet, ohne je zu
protokollieren, ob die Beitragsübersicht wirklich nachgezogen wurde. Regel 3 schließt genau
diese Lücke, indem sie den Zustand dauerhaft (nicht nur für die aktuelle Browser-Session) im
Blick behält.

Threshold-Werte („seit über X Tagen") werden pro Regel konfigurierbar, mit sinnvollen
Standardwerten (Vorschlag: 3 Tage für Regel 3, 14 Tage für Regel 4, 7 Tage für Regel 5/6),
analog zu bereits bestehenden Konfigurationswerten im System (`system_config`).

## 5. Architektur

### Datenmodell

- **Wiederverwendung von `sync_runs`**: eine „Prüfung" ist ein neuer `run_kind='batch'`-Eintrag
  mit `trigger_type='cron'` oder `'manual'`, ein „Verstoß" ein `run_kind='item'`-Kind-Eintrag
  darunter (`parent_run_id`). Kein neues Ausführungsmodell — nur eine neue Integration im
  bestehenden Modell (analog zu Facebook, Dialfire, KlickTipp-Rücksync, …).
- **Neue Tabelle `data_quality_rules`**: `id`, `name`, `beschreibung`, `kategorie`, `aktiv`,
  `schweregrad`, `schwellenwert_tage` (nullable, nur für zeitbasierte Regeln), `erzeugt_aufgabe`
  (bool — ob ein Verstoß automatisch eine Aufgabe anlegt). Analog zur `rules`-Tabelle der
  Automatisierungsregeln, aber rückwärtsgewandt (prüfend) statt vorwärtsgewandt (bei Neuanlage
  auslösend).
- **Verstöße selbst** landen nicht in einer neuen Tabelle, sondern als `sync_runs`-Items mit
  `data.rule_id`, `data.contact_id`, `data.status` (`offen`/`behoben`) — Wiedererkennung
  zwischen zwei Läufen (kein Duplikat für denselben, weiterhin offenen Verstoß) über einen
  Fingerprint aus `rule_id` + `contact_id`, gleiches Muster wie `klicktipp_webhook_events`s
  `event_fingerprint`-Dedupe.

### Ausführung

- `src/lib/data-quality/rules.ts`: eine Regel = eine reine Funktion
  `(supabase) => Promise<Verstoss[]>`, unabhängig ausführbar. Ein Fehler in einer Regel wird
  gefangen, als `error_class` im zugehörigen `sync_runs`-Item protokolliert, die übrige Prüfung
  läuft weiter — direkte Umsetzung des Nutzer-Prinzips „eine Regel darf die Prüfung nicht
  stoppen".
- `runWithTracking()` (bereits vorhanden, `src/lib/sync-runs/retry-runner.ts`) übernimmt
  Batch-Start/-Ende, keine neue Tracking-Logik nötig.
- Nächtlicher Cron (GitHub-Actions-Workflow, gleiches Muster wie die bestehenden
  zeitgesteuerten Integrationen) + manueller „Jetzt prüfen"-Button im UI.

### Aktion

- Verstöße mit `erzeugt_aufgabe=true` legen automatisch eine `tasks`-Zeile mit
  `triggered_by_rule` an (Spalte existiert bereits, bisher nur vom AMIS-NOW-Agent genutzt) —
  keine neue Aufgaben-Oberfläche nötig, die Funde erscheinen in den bestehenden
  Aufgaben-Listen/Dashboard-Kacheln.
- Wird derselbe Verstoß beim nächsten Lauf erneut erkannt, **keine zweite Aufgabe** — der
  Fingerprint-Abgleich erkennt „bereits offen gemeldet".
- Wird ein Verstoß beim nächsten Lauf **nicht mehr** erkannt (Ursache behoben), wird das
  zugehörige Item auf `status='behoben'` gesetzt — kein manuelles Abhaken nötig.

### UI

- Neue Seite `/datenqualitaet` (oder als dritter Tab neben `/regeln` und `/sync` unter der
  bestehenden „Automatisierungen"-Tab-Leiste — engere Integration, weniger neue
  Sidebar-Fläche): Zusammenfassung/Dashboard je letztem Lauf (geprüfte Kontakte, aktive Regeln,
  gefundene/behobene Verstöße), Regelbibliothek mit Ein/Aus-Toggle, aufklappbare
  Verstoß-Liste mit Link zum betroffenen Kontakt — visuell im bestehenden `/sync`-Look
  (`SyncStatusBadge`-Vokabular wiederverwenden).

## 6. Rolle der KI (bewusst spätere Ausbaustufe, nicht Version 1)

Die KI ergänzt die deterministische Regel-Engine, ersetzt sie nicht — genau wie im
Nutzer-Konzept beschrieben. Reihenfolge der Ausbaustufen:

1. **Version 1 (dieses Dokument)**: rein deterministisch, feste Regelbibliothek, keine KI.
2. **Version 2**: KI schlägt aus Freitext eine Regel-Logik vor („Wenn Straße gefüllt ist, muss
   Hausnummer gefüllt sein") — der Vorschlag wird als lesbare Bedingung angezeigt und muss vor
   der Aktivierung von einem Menschen bestätigt werden. Kein Blindflug: die KI schreibt die
   Regel, der Mensch schaltet sie scharf.
3. **Version 3**: KI-Anomalie-Erkennung für Fälle, für die (noch) keine Regel existiert —
   Freitext-Auffälligkeiten über Notizen/Aktivitäten hinweg. Sinnvoller Andockpunkt: das
   bestehende `flags`-Feld des Call-Prep-Agenten (`src/lib/call-prep.ts`), das schon heute
   freitextbasierte Auffälligkeiten pro Kontakt anzeigt, aber bisher keine strukturierten
   Feld-Widersprüche prüft. Die deterministischen Befunde aus Version 1 könnten dort direkt
   mit einfließen, statt ein zweites, paralleles Anzeige-System zu bauen.

## 7. Offene Fragen

1. **Schwellenwerte**: pro Regel fest im Code, oder über `system_config` admin-konfigurierbar
   wie andere Einstellungen? Empfehlung: `system_config`, analog zum bestehenden Muster.
2. **Standort in der Navigation**: eigener Sidebar-Eintrag `/datenqualitaet`, oder dritter Tab
   unter der bestehenden „Automatisierungen"-Leiste (`/regeln`, `/sync`)? Empfehlung: dritter
   Tab — engere Integration, ein Automatisierungs-Bereich statt drei verstreuter Einträge.
3. **Erste Regelzahl**: alle acht aus Abschnitt 4 zum Start, oder kleiner MVP (z.B. nur die
   drei mit Schweregrad Hoch/Mittel) und der Rest iterativ?

## 8. Nicht-funktionale Garantien

- Rein lesend gegenüber den Fachdaten — die Regel-Engine ändert nie selbst einen Kontakt/ein
  Angebot/einen Vertrag, sie erzeugt höchstens eine Aufgabe.
- Kein Regel-Fehler blockiert die übrige Prüfung (siehe Abschnitt 5).
- Keine Duplikat-Aufgaben für einen weiterhin offenen, bereits gemeldeten Verstoß.
