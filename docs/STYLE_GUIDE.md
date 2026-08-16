# Sentinel Logic — Style Guide

> Lebendes Nachschlagewerk, Ergebnis der UI-/Branding-Überarbeitung (`docs/UI_UX_KONZEPT.md`).
> Wird parallel zum Rollout gepflegt — wächst mit jeder migrierten Seite, nicht erst am Ende.
>
> Stand: 2026-08-16 — Stufe 1–3 umgesetzt, plus Nachbesserung: Seiten-Container/Hintergrund,
> Kontakt-Detail-Spaltenzuordnung, Aktivitäten-Timeline, Aufgaben-/Angebote-Tabellenangleichung

---

## Design-Tokens

Zentral in `tailwind.config.ts` (`theme.extend.colors.brand`):

| Token | Wert | Verwendung |
|---|---|---|
| `bg-brand` | `#FFC300` | Primärfarbe (bisher `bg-yellow-400`) |
| `bg-brand-hover` | `#F5B800` | Hover-Zustand Primärfarbe (bisher `hover:bg-yellow-500`) |
| `bg-brand-dark` / `text-brand-dark` | `#1A1A1A` | Sidebar-Hintergrund, dunkle Überschriften |

Fachliche Statusfarben (Kontakt-Status, Angebot-Status) bleiben **unverändert** in ihren
eigenen Modulen (`src/lib/angebot-status.ts`, Kontaktliste `STATUS_COLORS`) — kein eigenes
Token, da bereits konsistent (Neu=grau, Kontaktiert=blau, Qualifiziert=gelb, Kunde=grün,
Nicht interessiert=rot).

## Typografie

| Ebene | Klasse | Verwendung |
|---|---|---|
| h1 | `text-2xl font-bold text-gray-900` | Seitentitel — genau einmal pro Seite, über `<PageHeader />` |
| h2 | `text-lg font-semibold text-gray-900` | Kachel-/Abschnittstitel |
| h3 | `text-sm font-semibold text-gray-700 uppercase tracking-wide` | Tabellen-Header, Unterabschnitte |
| Body | `text-sm text-gray-600` | Standard-Fließtext |
| Caption | `text-xs text-gray-400` | Metadaten, Zeitstempel |

## Komponenten (`src/components/ui/`)

### `<PageHeader title subtitle actions />`
Ersetzt individuell gebaute `<h1>`-Köpfe. Ein Titel, optionaler grauer Untertitel/Zähler,
optionale Aktionsleiste rechts (Buttons).

```tsx
<PageHeader
  title="Angebote"
  subtitle={`${filtered.length} Angebote`}
  actions={<Button onClick={openNew}>+ Angebot erstellen</Button>}
/>
```

### `<Button variant size />`
| Variant | Verwendung |
|---|---|
| `primary` (Default) | Haupt-Aktion der Seite/des Dialogs (bisher `bg-yellow-400 hover:bg-yellow-500`) |
| `secondary` | Nebenaktion, Abbrechen (Rahmen statt Fläche) |
| `danger` | Löschen/Archivieren (reiner Text, rot) |
| `ghost` | Neutrale Textaktion (z.B. „Bearbeiten" in Tabellenzeilen) |

Größen: `sm` (kompakt, z.B. in Tabellenzeilen) und `md` (Standard).

### `<Card title actions padded />`
Einheitliche Kachel: `bg-white rounded-xl border border-gray-200 shadow-sm`, optionaler
Titel-Header mit Aktionsleiste. `padded={false}` für Karten, die ihr Padding selbst steuern
(z.B. um eine Tabelle randlos einzubetten).

### `<Badge color />`
Reine Darstellungshülle (`gray`/`blue`/`yellow`/`green`/`red`/`indigo`/`orange`) — die Farblogik
für fachliche Status bleibt in ihren eigenen Modulen, dieser Baustein wird dort nur als
Trägerelement verwendet. `orange` kam mit der Aufgaben-Priorität „Mittel" hinzu (analog zum
bereits vorhandenen `bg-orange-100 text-orange-700`-Muster im Dashboard).

### `<EmptyState icon text hint action />`
Einheitlicher Leerzustand („Keine Daten") statt individueller Textblöcke pro Seite.

### Bewusst keine `<DataTable />`
Tabellen bleiben pro Seite eigenes `<table>`-Markup (Entscheidung siehe
`docs/UI_UX_KONZEPT.md`, Abschnitt 7) — nur mit denselben Klassen:

```
<table className="w-full text-sm">
  <thead>
    <tr className="border-b border-gray-100 bg-gray-50/80">
      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">…</th>
```

## Seiten-Container

Jede Hauptseite trägt ihren Hintergrund **nicht selbst** — `bg-gray-50` kommt einmalig aus
`src/app/layout.tsx` (`<body>`). Seiten setzen nur noch das Padding, kein eigenes `min-h-screen`
und kein Gradient:

```tsx
<div className="p-4 sm:p-6 lg:p-8">
  {/* optional: <div className="max-w-3xl"> für schmalere Formular-/Einstellungsseiten */}
</div>
```

- **Kein `mx-auto`** auf der äußeren Seite — Inhalt startet immer linksbündig, auch wenn eine
  Unterseite inhaltlich schmaler ist (`max-w-*` ohne Zentrierung). Eine zentrierte Seite neben
  linksbündigen Nachbarseiten war genau die „mal links, mal mittig"-Inkonsistenz, die im ersten
  Stufe-3-Durchgang übersehen wurde.
- **Kein Seiten-eigener Gradient-Hintergrund** (`bg-gradient-to-br from-blue-50 to-indigo-50` kam
  vorher in mehreren Einstellungen-Unterseiten und `/ki-upload` vor) — nur der `bg-gray-50` aus
  dem Layout.
- Ausnahmen bewusst außerhalb dieser Regel: `/login`, `/datenschutz` (kein Sidebar-Kontext,
  eigenständiges Layout) und `/telefonie/eingehend` (Einzelzweck-Screen-Pop, kein normaler
  Seitenaufruf über die Sidebar).

## Kontakt-Detailseite: Spalten-Zuordnung

Zweispaltiges Kachelraster (`grid lg:grid-cols-[1.55fr_1fr]`). Faustregel: **linke Spalte =
Stammdaten** (Kontakt, Unternehmen, Versicherung & Verträge, Beitragsübersicht, Dokumente),
**rechte Spalte = Arbeit/Aktion**, von oben nach unten in dieser festen Reihenfolge:
**Erstgespräch → Nächste Aufgabe → Angebote → Telefonie & Sync.** Erstgespräch/Nächste Aufgabe
oben, weil sie die unmittelbar anstehende Arbeit am Kontakt zeigen; Angebote/Telefonie & Sync
darunter, weil sie eher Status-/Referenzinformation sind als eine sofortige Handlungsaufforderung.

## Aktivitäten-/Kontakthistorie-Timeline

`AktivitaetenPanel.tsx` nutzt ein durchgehendes Linien-Muster statt einzelner Segmente pro
Zeile: Jede Zeile trägt ihre eigene Verbindungslinie von ihrem Icon bis zum unteren Rand ihres
eigenen Paddings (`absolute left-[15px] top-8 bottom-0 w-px bg-gray-200`), wodurch sich die
Linie über unterschiedlich hohe Einträge hinweg nahtlos fortsetzt — ein fixes `h-8`-Segment pro
Zeile (die vorherige Umsetzung) reißt ab, sobald ein Eintrag mehr als eine Zeile Text hat. Der
redundante Typ-Badge („contact created" als rohe Pille neben jedem Eintrag) wurde entfernt —
das Icon transportiert den Typ bereits über Form/Farbe.

**Gruppierung nach Zeitraum** (`gruppenLabel()`): Heute → Gestern → Diese Woche → Diesen Monat →
„Monat Jahr" für alles Ältere (gleiche Staffelung wie Gmail/Slack). Die Verbindungslinie endet
bewusst am Ende jeder Gruppe (kein Linien-Durchlauf durch den Gruppenkopf) — pro Zeile wird
geprüft, ob der *nächste* Eintrag noch zur selben Gruppe gehört, nicht nur ob es einen nächsten
Eintrag überhaupt gibt.

## Sidebar

Einklappbar (`src/components/Sidebar.tsx`), Desktop-only (`md:` aufwärts). Zustand in
`localStorage` unter dem Key `sidebar-collapsed`, Default **ausgeklappt**. Eingeklappt:
64px breit (`md:w-16`), nur Icons, Label als Tooltip (`title`-Attribut). Mobile Drawer-Verhalten
unverändert.

## Rollout-Stand

| Stufe | Status |
|---|---|
| 1 — Fundament (Tokens, Bausteine, einklappbare Sidebar) | ✅ Done (2026-08-16) |
| 2 — Pilotseiten (Dashboard, Kontakte, Angebote) | ✅ Done (2026-08-16) |
| 3 — Restliche Hauptseiten | ✅ Done (2026-08-16) |
| 4 — Diese Datei | ✅ Done (2026-08-16) — lief parallel zu 1–3 mit, wird bei künftigen Migrationen (z.B. Testdashboard-Kopf, Einstellungen-Unterseiten) weiter ergänzt |

### Nachbesserung nach Nutzer-Review (2026-08-16)

Der erste Stufe-3-Durchgang hat den Hex-/Typografie-Sweep vollständig erledigt, aber vier
strukturelle Inkonsistenzen übersehen, die erst beim Durchklicken auffielen:

1. **Seiten-Container/Hintergrund**: mehrere Einstellungen-Unterseiten + `/ki-upload` hatten
   einen eigenen `min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50`-Hintergrund statt des
   App-weiten `bg-gray-50`, und ca. 10 Seiten zentrierten ihren gesamten Inhalt (`mx-auto`)
   während die Mehrheit linksbündig ist. Beides behoben, siehe „Seiten-Container" oben — dabei
   auch `/kontakte/[id]`, `/testdashboard` und `/postfach` erwischt, die zwar keinen Gradient,
   aber eine Ganzseiten-Zentrierung hatten.
2. **Kontakt-Detail-Spalten**: Angebote und Telefonie & Sync waren in der linken „Stammdaten"-
   Spalte einsortiert, gehören aber zur rechten „Arbeit"-Spalte — verschoben, siehe eigener
   Abschnitt oben.
3. **Aktivitäten-Timeline**: sah durch abreißende Verbindungslinien (fixe Segmentlänge statt
   durchgehender Linie) nicht wie eine echte Timeline aus — auf ein pro-Zeile-durchgehendes
   Linien-Muster umgestellt.
4. **Aufgaben- vs. Angebote-Tabelle**: unterschiedliche Header-Farbe/-Padding, unterschiedliche
   Filterleisten-Muster (Segmented-Control vs. Pill-Chips) und die Aufgaben-Priorität war reiner
   farbiger Text statt eines Badges wie überall sonst — beide Tabellen jetzt auf dasselbe Muster
   angeglichen (siehe „Bewusst keine `<DataTable />`" oben).

**Für Stufe 4+ mitgenommen**: Vor einer weiteren Seiten-Migration immer gegen eine bereits
migrierte Referenzseite (Dashboard/Kontakte/Angebote) durchklicken, nicht nur den Code diffen —
Hintergrund/Zentrierung/Spalten-Zuordnung fallen im Code-Review leicht durch, im Browser sofort
auf.

### Erkenntnisse aus Stufe 3

- **Vollständiger Hex-Sweep statt nur Pilotseiten**: alle verbliebenen `#1A1A1A`/`#FFC300`/`#e6b000`-
  Vorkommen im gesamten `src/app`/`src/components` (außer der bestätigten Altlast `/leads`) auf die
  `brand`-Token umgestellt — u.a. `Sidebar.tsx`, `StickyContactHeader.tsx`, `AutomationControls.tsx`,
  `ProcessStepper.tsx`/`ProcessStepperBar.tsx`, `ReleaseNotesModal.tsx`/`ReleaseNotificationBanner.tsx`,
  `AutomatisierungenTabs.tsx`, mehrere Kontakt-Panels, `layout.tsx`, `datenschutz/page.tsx`. Farbwert
  unverändert (`text-[#1A1A1A]` → `text-gray-900` für Text, `bg-[#1A1A1A]` → `bg-brand-dark` für
  Flächen — dieselbe Konvention wie in Stufe 2 etabliert).
- **`<PageHeader />` auf alle einfachen Hauptseiten-Köpfe angewendet**: Aufgaben, Kalender, Dokumente,
  KI-Upload, Automatisierungsregeln, Synchronisation, Selektion, E-Mail-Postfach, Hilfe, Einstellungen
  (Hauptseite), Mein Profil, Erwähnungen, Release Notes.
- **Bewusst nicht in `<PageHeader />` gezwungen**: Testdashboard (Badge-Zeile + Status-Pill oberhalb/
  neben dem Titel passt nicht ins Titel/Untertitel/Aktionen-Schema) und die Einstellungen-Unterseiten
  (Dokumente, Integration, Mail-Vorlagen, Prozess, Sparten, Team — bereits korrekt typografiert,
  aber strukturell nicht migriert). Deren `<h1>` ist trotzdem bereits auf `text-2xl font-bold
  text-gray-900` vereinheitlicht.
- **Nicht standardisierte Buttons bleiben bewusst individuell**, wenn sie keiner der vier
  `<Button />`-Varianten entsprechen — z.B. der dunkle „Alle synchronisieren"-Button auf `/sync`
  (`bg-brand-dark`, kein Gelb) oder `<a>`-Elemente, die wie Buttons aussehen (z.B. „Google Drive
  öffnen" auf `/dokumente`) — `<Button />` rendert nur `<button>`, kein `<a>`.
- **Datenschutzerklärung und Login** (öffentliche Seiten ohne Sidebar) wurden beim Hex-Sweep
  mitgenommen, aber nicht auf `<PageHeader />` umgestellt (kein Sidebar-Kontext, eigenständiges
  Layout).

### Erkenntnisse aus Stufe 2

- `<PageHeader />` brauchte einen breiteren `subtitle`-Typ (`React.ReactNode` statt `string`) und
  eine gestapelte statt inline Anordnung (Titel oben, Untertitel darunter) — Dashboard braucht
  einen mehrzeiligen Untertitel (Datum + Aufgaben-Hinweis), nicht nur einen kurzen Zähler wie
  bei Angebote. Beide Fälle funktionieren jetzt mit derselben Komponente.
- Gezielte Token-Bereinigung statt Komplett-Umbau: in `dashboard/page.tsx` wurden alle
  `text-[#1A1A1A]`/`bg-[#1A1A1A]`/`bg-[#FFC300]`-Vorkommen auf `text-gray-900`/`bg-brand-dark`/
  `bg-brand` umgestellt — der Rest der Seite (KPI-Kacheln, Panel-Wrapper, Schnellzugriff-Kacheln)
  blieb bewusst unangetastet, da bereits dem dominanten `rounded-xl border border-gray-200`-Muster
  entsprach und ein Zwang in `<Card />` keinen Mehrwert bei höherem Risiko gebracht hätte.
- `/kontakte` (1850+ Zeilen) wurde bewusst nur im Kopfbereich migriert (Titel, Zähler, vier
  Aktions-Buttons inkl. Export-Dropdown) — die große Tabelle/Filterleiste bleibt für Stufe 3
  unangetastet, um das Risiko in einer einzelnen Änderung klein zu halten.
