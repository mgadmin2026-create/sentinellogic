# UI-/Branding-Überarbeitung — Konzept

> Entwurf zur Prüfung. Noch nicht umgesetzt. Ausgelöst durch den Roadmap-Punkt
> „UI-/Branding-Überarbeitung" (`docs/ROADMAP.md`, Phase A) — von SuperChat inspiriert,
> bewusst als eigenes Vorhaben nach der Angebote-Funktion (v0.32.0) behandelt, weil es
> praktisch jede Seite berührt.
>
> Stand: 2026-08-15 — Entwurf, ungeprüft

---

## 1. Ausgangslage (Ist-Zustand, am Code geprüft)

Kein systematischer Regressionsbefund, sondern eine Bestandsaufnahme der tatsächlichen
Inkonsistenzen im Code, als Begründung für dieses Vorhaben:

- **Überschriften uneinheitlich:** `<h1>` schwankt zwischen `text-2xl` und `text-3xl` quer über
  fast alle Hauptseiten, ohne erkennbares Muster (z.B. `Kontakte` = `text-3xl`, `Angebote` =
  `text-2xl`, `Aufgaben` = `text-3xl`, `Dokumente` = `text-2xl`).
- **Gleiche Textfarbe, zwei Schreibweisen:** `text-gray-900` (26 Vorkommen) und `text-[#1A1A1A]`
  (10 Vorkommen) — optisch praktisch identisch, aber als zwei verschiedene, nicht zentral
  gepflegte Werte im Code verstreut.
- **Kein Farbtoken-System:** `tailwind.config.ts` definiert nur `background`/`foreground` als
  CSS-Variablen: alle anderen Farben (`#FFC300`, `#1A1A1A`, Tailwind-Standardpalette) werden
  überall direkt als Klassen/Hex-Werte im JSX wiederholt, nicht zentral benannt.
- **Primärbutton uneinheitlich:** `bg-yellow-400` (38×) und `bg-yellow-400 hover:bg-yellow-500`
  (39×) als die zwei dominanten Varianten — plus vereinzelt `bg-blue-600`, `bg-emerald-500`,
  `bg-indigo-600` u.a. für vermutlich denselben „primäre Aktion"-Zweck auf anderen Seiten.
- **Karten/Kacheln uneinheitlich:** mind. 8 unterschiedliche Kombinationen aus
  `rounded-{lg|xl|2xl}` + `shadow-{sm|lg|xl|...}` + Border/Padding für optisch gleichwertige
  Kacheln.
- **Sidebar ist fix**, nicht einklappbar — bei 12 Hauptpunkten + Profilbereich auf kleineren
  Notebook-Displays (13", 1440px-Breite) nimmt sie dauerhaft 224px (`md:w-56`) vom
  Arbeitsbereich, ohne Möglichkeit sie zu verschmälern.
- **Kein zentrales Komponenten-Set:** Buttons, Badges, Tabellen, Page-Header, Leerzustände
  („Keine Daten") werden auf jeder Seite einzeln im JSX gebaut statt aus gemeinsamen
  Bausteinen — jede neue Seite (wie zuletzt `/angebote`) kopiert bestehende Muster per Copy &
  Paste statt sie wiederzuverwenden, wodurch sich Abweichungen zwangsläufig weiter vermehren.

**Was bewusst NICHT als Problem behandelt wird:** Die fachlichen Status-Farben (Kontakt-Status:
Neu=grau/Kontaktiert=blau/Qualifiziert=gelb/Kunde=grün/Nicht interessiert=rot, seit v0.16.0
einheitlich; Angebot-Status analog seit v0.32.0) sind bereits konsistent und semantisch
begründet — sie werden übernommen, nicht durch ein neutrales Einheitsschema ersetzt.

---

## 2. Ziel

Kein Rebrand, keine neue Optik von Grund auf — sondern das **bestehende Look & Feel
konsolidieren und konsistent durchziehen**: gleiche Gelb/Dunkel-Markenfarben, gleiche
Grundformen (abgerundete Kacheln, helle Flächen), aber aus einem gemeinsamen, kleinen
Bausteinkasten statt aus Dutzenden Einzelvarianten.

Konkret, wie im Roadmap-Eintrag vorgegeben:
1. Einklappbare Sidebar (jederzeit wieder ausklappbar)
2. Einheitliches Typografie-System (h1–h3, Textgrößen/-schriftarten)
3. Großzügigere Arbeitsbereich-Nutzung
4. Konsistente Tabellen-/Button-/Feld-Darstellung über alle Seiten hinweg
5. Eigene Style-Guide-Datei als Ergebnis

---

## 3. Design-Tokens (Vorschlag)

Zentral in `tailwind.config.ts` (`theme.extend.colors/fontSize/borderRadius`) statt verstreuter
Hex-Werte im JSX. Bestehende Markenfarben werden nur **benannt**, nicht verändert:

```ts
colors: {
  brand: {
    DEFAULT: '#FFC300',   // bisheriges bg-yellow-400 / #FFC300
    hover:   '#F5B800',   // bisheriges hover:bg-yellow-500
    dark:    '#1A1A1A',   // Sidebar-Hintergrund, dunkle Überschriften
  },
  // Status-Farben (Kontakt/Angebot) bleiben unverändert Tailwind-Standardpalette
  // (gray/blue/yellow/green/red) — kein eigenes Token nötig, da bereits konsistent
}
```

Typografie-Skala (ersetzt die aktuell freien `text-2xl`/`text-3xl`-Mischung):

| Ebene | Klasse | Verwendung |
|-------|--------|------------|
| `h1` | `text-2xl font-bold text-gray-900` | Seitentitel (genau eine pro Seite) |
| `h2` | `text-lg font-semibold text-gray-900` | Kachel-/Abschnittstitel |
| `h3` | `text-sm font-semibold text-gray-700 uppercase tracking-wide` | Tabellen-Header, Unterabschnitte |
| Body | `text-sm text-gray-600` | Standard-Fließtext |
| Caption | `text-xs text-gray-400` | Metadaten, Zeitstempel |

→ Alle Haupt-`<h1>` auf `text-2xl` vereinheitlicht (nicht `text-3xl`) — kompakter, näher an der
von SuperChat inspirierten „mehr Arbeitsbereich"-Vorgabe.

---

## 4. Gemeinsame Komponenten (neu, in `src/components/ui/`)

| Komponente | Ersetzt | Varianten |
|---|---|---|
| `<PageHeader title subtitle actions />` | ~30 individuell gebaute Seitenköpfe | — |
| `<Button variant size />` | `bg-yellow-400 hover:...`-Wiederholungen | `primary` (Marke), `secondary` (Rahmen), `danger` (rot), `ghost` (nur Text) |
| `<Card />` | die 8+ Kachel-Varianten | Standard-Padding/Radius/Shadow, optionaler Header-Slot |
| `<Badge color />` | Status-Pills (bereits meist konsistent, wird nur gebündelt) | nutzt bestehende Statusfarben unverändert |
| `<EmptyState icon text action />` | uneinheitliche „Keine Daten"-Blöcke | — |

Bewusst **keine** `<DataTable />`-Komponente (Entscheidung siehe Abschnitt 7): Tabellen bleiben
pro Seite eigene `<table>`-Markup, nur mit denselben Klassen/Mustern (Header-Styling,
Zeilen-Hover, Leerzustand) aus dem Style Guide — geringeres Migrationsrisiko als eine echte
Abstraktion, bestehende Sonderfälle (z.B. Spalten-Konfiguration/Dichte bei `/kontakte`) bleiben
unangetastet.

Wichtig: Diese Komponenten bilden nur **bestehende, bereits verwendete Muster** nach (das
optisch am häufigsten vorkommende Muster wird zur Norm) — keine neue Optik, kein neues
Verhalten.

---

## 5. Einklappbare Sidebar

- Neuer Zustand `collapsed: boolean`, persistiert in `localStorage` (analog zum bestehenden
  Muster für Ansichts-Präferenzen, z.B. `angebote-ansicht`).
- Eingeklappt: nur Icons (Breite ~64px statt 224px), Label als Tooltip bei Hover; aktiver
  Punkt weiterhin farblich erkennbar (Marke-Gelb).
- Toggle-Button oben in der Sidebar (Chevron-Icon), wie im SuperChat-Vorbild.
- Nur Desktop (`md:` und größer) — die mobile Drawer-Sidebar bleibt unverändert (dort ist
  „eingeklappt" ohnehin gleichbedeutend mit „geschlossen").
- Profilbereich/Footer passt sich an (bei „eingeklappt" nur Avatar-Initialen statt
  Name+E-Mail+Menü).

---

## 6. Rollout-Strategie (kein Big-Bang)

Da die Änderung „praktisch jede Seite berührt" (Roadmap-Formulierung), **kein** einmaliger
Komplett-Umbau, sondern stufenweise, um das Regressionsrisiko klein zu halten:

**Stufe 1 — Fundament** (~1 Sitzung)
Design-Tokens in `tailwind.config.ts`, neue `src/components/ui/`-Bausteine bauen, Sidebar
einklappbar machen. Noch keine bestehende Seite wird umgebaut — reine Vorbereitung.

**Stufe 2 — Pilotseiten** (~1 Sitzung)
2–3 repräsentative Seiten auf die neuen Bausteine umstellen (Vorschlag: `/dashboard`,
`/kontakte`, `/angebote` — unterschiedliche Seitentypen: KPI-Dashboard, große Tabelle,
Kanban+Liste). Danach gemeinsam prüfen, ob das Ergebnis passt, **bevor** der Rest folgt.

**Stufe 3 — Restliche Hauptseiten** (mehrere Sitzungen, nach Bestätigung von Stufe 2)
Alle übrigen Seiten nacheinander migrieren (Aufgaben, Kalender, Dokumente, Einstellungen-
Unterseiten, ...). Jede Seite einzeln commit-/testbar, kein Sammel-Commit über alles.

**Stufe 4 — Style-Guide-Datei**
`docs/STYLE_GUIDE.md` (oder eine `/styleguide`-Route im Code selbst, siehe offene Frage
unten) als lebendes Nachschlagewerk, entsteht parallel zu Stufe 1–3, nicht erst am Ende.

**Out of scope** (explizit nicht Teil dieses Vorhabens):
- Kein Dark Mode
- Keine neuen Seiten/Features
- Keine Änderung an fachlicher Logik oder Datenmodellen
- Keine Änderung an den bereits konsistenten Status-Farbschemata

---

## 7. Entscheidungen (2026-08-15, mit Nutzer abgestimmt)

1. **Style-Guide-Format:** `docs/STYLE_GUIDE.md` als Markdown-Datei — kein `/styleguide`-Route.
2. **Pilotseiten (Stufe 2):** `/dashboard`, `/kontakte`, `/angebote`.
3. **Tabellen:** kein `<DataTable />`-Abstraktions-Bauteil — jede Seite bleibt ein eigenes
   `<table>`, nur mit konsistenten Klassen/Mustern aus dem Style Guide. Geringeres
   Migrationsrisiko, bestehende Sonderfälle (z.B. Spalten-Konfiguration/Dichte bei
   `/kontakte`) bleiben unangetastet.
4. **Sidebar-Default:** ausgeklappt (wie bisher) — Nutzer klappt bei Bedarf manuell ein,
   Zustand wird danach in `localStorage` gemerkt.

---

## 8. Nicht-visuelle Garantien

- Keine URL-/Routen-Änderungen, keine API-Änderungen — rein Darstellung.
- Alle bestehenden Playwright-E2E-Tests (`tests/e2e/`) müssen nach jeder Stufe weiterhin grün
  laufen, da sie auf Text-/Rollen-Selektoren zielen, nicht auf konkrete CSS-Klassen — sollte
  robust gegenüber diesem Umbau sein, wird aber nach Stufe 2 stichprobenartig geprüft.
- Migration schrittweise pro Seite, jederzeit stoppbar/zurückrollbar (eigener Feature-Branch).
