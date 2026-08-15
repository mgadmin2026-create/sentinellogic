# Sentinel Logic — Style Guide

> Lebendes Nachschlagewerk, Ergebnis der UI-/Branding-Überarbeitung (`docs/UI_UX_KONZEPT.md`).
> Wird parallel zum Rollout gepflegt — wächst mit jeder migrierten Seite, nicht erst am Ende.
>
> Stand: 2026-08-16 — Stufe 1 (Fundament) umgesetzt

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
Reine Darstellungshülle (`gray`/`blue`/`yellow`/`green`/`red`/`indigo`) — die Farblogik für
fachliche Status bleibt in ihren eigenen Modulen, dieser Baustein wird dort nur als
Trägerelement verwendet.

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

## Sidebar

Einklappbar (`src/components/Sidebar.tsx`), Desktop-only (`md:` aufwärts). Zustand in
`localStorage` unter dem Key `sidebar-collapsed`, Default **ausgeklappt**. Eingeklappt:
64px breit (`md:w-16`), nur Icons, Label als Tooltip (`title`-Attribut). Mobile Drawer-Verhalten
unverändert.

## Rollout-Stand

| Stufe | Status |
|---|---|
| 1 — Fundament (Tokens, Bausteine, einklappbare Sidebar) | ✅ Done (2026-08-16) |
| 2 — Pilotseiten (Dashboard, Kontakte, Angebote) | ⬜ Offen |
| 3 — Restliche Hauptseiten | ⬜ Offen |
| 4 — Diese Datei | 🟡 Läuft parallel mit, wird bei jeder migrierten Seite ergänzt |
