// PDF-Generierung für die Beitragsübersicht — Layout an die bestehende
// Excel-Vorlage "Beitragsuebersicht_Vorlage_Allianz_Guen" angelehnt
// (A4 Querformat, Kopf/Tabelle/Summenzeile/Ersparnis- bzw. Mehrbeitrag-Box).
import { Document, Page, View, Text, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import type { Beitragsuebersicht } from '@/types/beitragsuebersicht'
import { berechneDifferenz, berechneSummen, effektiveWerte } from './beitragsuebersicht-calc'
import { ZYKLUS_LABEL, type Zyklus } from './beitragsuebersicht-zyklus'

export interface BeitragsuebersichtPdfInput {
  kundenname: string
  kundentyp: 'privat' | 'gewerbe'
  beratername: string
  uebersicht: Beitragsuebersicht
}

const styles = StyleSheet.create({
  page: { padding: 26, fontSize: 9, fontFamily: 'Helvetica' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottomWidth: 2, borderBottomColor: '#1a1a1a', paddingBottom: 10, marginBottom: 10 },
  title: { fontSize: 15, fontWeight: 700, lineHeight: 1.3 },
  brand: { fontSize: 9, color: '#444', textAlign: 'right' },
  brandName: { fontWeight: 700 },
  metaRow: { flexDirection: 'row', gap: 32, marginBottom: 10 },
  metaLabel: { color: '#666', fontSize: 8.5 },
  metaValue: { fontWeight: 700, fontSize: 9 },
  table: { display: 'flex', flexDirection: 'column', width: '100%', marginBottom: 10 },
  headerRow: { flexDirection: 'row', backgroundColor: '#1a1a1a', paddingVertical: 5 },
  headerCell: { color: '#fff', fontWeight: 700, fontSize: 7.5, paddingHorizontal: 3 },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e0e0e0', paddingVertical: 4 },
  rowAlt: { backgroundColor: '#f7f7f7' },
  cell: { fontSize: 7.5, paddingHorizontal: 3 },
  diffPos: { color: '#1e7a44', fontWeight: 700 },
  diffNeu: { color: '#1f5aa6', fontWeight: 700 },
  sumRow: { flexDirection: 'row', borderTopWidth: 1.5, borderTopColor: '#1a1a1a', paddingVertical: 5, fontWeight: 700 },
  boxRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  box: { flex: 1, borderRadius: 3, paddingVertical: 8, paddingHorizontal: 10, textAlign: 'center' },
  boxGood: { backgroundColor: '#e5f3ea', borderWidth: 1, borderColor: '#a9d8bb' },
  boxBlue: { backgroundColor: '#e6eef8', borderWidth: 1, borderColor: '#a9c6e8' },
  boxLabel: { fontSize: 8, fontWeight: 700 },
  boxValue: { fontSize: 14, fontWeight: 700, marginTop: 2 },
  footer: { marginTop: 14, fontSize: 7, color: '#777', borderTopWidth: 0.5, borderTopColor: '#e0e0e0', paddingTop: 6, lineHeight: 1.4 },
})

function buildCols(zyklusLabel: string) {
  return [
    { key: 'sparte', label: 'Sparte', width: '18%' },
    { key: 'versicherer', label: 'Bisheriger Versicherer', width: '13%' },
    { key: 'alt', label: `Beitrag bisher (€/${zyklusLabel})`, width: '11%' },
    { key: 'neu', label: `Angebot Allianz (€/${zyklusLabel})`, width: '11%' },
    { key: 'diff', label: `Differenz (€/${zyklusLabel})`, width: '10%' },
    { key: 'beginn', label: 'Beginn', width: '9%' },
    { key: 'ablauf', label: 'Ablauf', width: '9%' },
    { key: 'bemerkung', label: 'Bemerkung', width: '19%' },
  ] as const
}

function fmtEuro(n: number): string {
  return n.toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' €'
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

function BeitragsuebersichtDocument({ kundenname, kundentyp, beratername, uebersicht }: BeitragsuebersichtPdfInput) {
  const summen = berechneSummen(uebersicht)
  const titel = kundentyp === 'privat' ? 'Privatkunden' : 'Firmenkunden'
  const zyklus: Zyklus = uebersicht.zyklus ?? 'jaehrlich'
  const zyklusLabel = ZYKLUS_LABEL[zyklus]
  const COLS = buildCols(zyklusLabel)

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.topRow}>
          <Text style={styles.title}>Ihre Versicherungs- und{'\n'}Beitragsübersicht{'\n'}{titel}</Text>
          <Text style={styles.brand}>
            Allianz Generalvertretung{'\n'}
            <Text style={styles.brandName}>{beratername}</Text>
          </Text>
        </View>

        <View style={styles.metaRow}>
          <View>
            <Text style={styles.metaLabel}>Kunde</Text>
            <Text style={styles.metaValue}>{kundenname}</Text>
          </View>
          <View>
            <Text style={styles.metaLabel}>Ihr Berater</Text>
            <Text style={styles.metaValue}>{beratername}</Text>
          </View>
          <View>
            <Text style={styles.metaLabel}>Datum</Text>
            <Text style={styles.metaValue}>{fmtDate(uebersicht.datum)}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.headerRow} fixed>
            {COLS.map((c) => (
              <Text key={c.key} style={[styles.headerCell, { width: c.width }]}>{c.label}</Text>
            ))}
          </View>
          {uebersicht.positionen.map((p, i) => {
            const { alt, neu } = effektiveWerte(p, uebersicht.fahrzeuge, uebersicht.flotte_aktiv)
            const diff = berechneDifferenz(alt, neu)
            const bemerkung =
              p.ist_flotte_zeile && uebersicht.flotte_aktiv
                ? `Details siehe Flottenblatt (${uebersicht.fahrzeuge.length} Fahrzeuge)`
                : p.bemerkung
            return (
              <View key={i} style={[styles.row, i % 2 === 1 ? styles.rowAlt : {}]} wrap={false}>
                <Text style={[styles.cell, { width: COLS[0].width }]}>{p.sparte}</Text>
                <Text style={[styles.cell, { width: COLS[1].width }]}>{p.versicherer_alt || '—'}</Text>
                <Text style={[styles.cell, { width: COLS[2].width }]}>{alt !== null ? fmtEuro(alt) : '—'}</Text>
                <Text style={[styles.cell, { width: COLS[3].width }]}>{neu !== null ? fmtEuro(neu) : '—'}</Text>
                <Text
                  style={[
                    styles.cell,
                    { width: COLS[4].width },
                    diff.kind === 'neu' ? styles.diffNeu : diff.kind === 'wert' ? styles.diffPos : {},
                  ]}
                >
                  {diff.kind === 'leer' ? '—' : diff.kind === 'neu' ? 'NEU' : `${diff.betrag > 0 ? '+' : ''}${fmtEuro(diff.betrag)}`}
                </Text>
                <Text style={[styles.cell, { width: COLS[5].width }]}>{p.ist_flotte_zeile ? '—' : fmtDate(p.beginn)}</Text>
                <Text style={[styles.cell, { width: COLS[6].width }]}>{p.ist_flotte_zeile ? '—' : fmtDate(p.ablauf)}</Text>
                <Text style={[styles.cell, { width: COLS[7].width }]}>{bemerkung || '—'}</Text>
              </View>
            )
          })}
          <View style={styles.sumRow}>
            <Text style={{ width: '31%', fontSize: 8 }}>Gesamtbeitrag pro {zyklusLabel}</Text>
            <Text style={{ width: '11%', fontSize: 8 }}>{fmtEuro(summen.sumAlt)}</Text>
            <Text style={{ width: '11%', fontSize: 8 }}>{fmtEuro(summen.sumNeu)}</Text>
            <Text style={{ width: '47%' }} />
          </View>
        </View>

        <View style={styles.boxRow}>
          <View style={[styles.box, summen.ersparnisProJahr > 0 ? styles.boxGood : {}]}>
            <Text style={[styles.boxLabel, { color: summen.ersparnisProJahr > 0 ? '#1e7a44' : '#999' }]}>✓ Ihre Ersparnis pro Jahr</Text>
            <Text style={[styles.boxValue, { color: summen.ersparnisProJahr > 0 ? '#1e7a44' : '#999' }]}>
              {summen.ersparnisProJahr > 0 ? fmtEuro(summen.ersparnisProJahr) : '–'}
            </Text>
          </View>
          <View style={[styles.box, summen.mehrbeitragProMonat > 0 ? styles.boxBlue : {}]}>
            <Text style={[styles.boxLabel, { color: summen.mehrbeitragProMonat > 0 ? '#1f5aa6' : '#999' }]}>Ihr Mehrbeitrag pro Monat</Text>
            <Text style={[styles.boxValue, { color: summen.mehrbeitragProMonat > 0 ? '#1f5aa6' : '#999' }]}>
              {summen.mehrbeitragProMonat > 0 ? fmtEuro(summen.mehrbeitragProMonat) : '–'}
            </Text>
          </View>
        </View>

        <Text style={styles.footer}>
          {zyklus === 'jaehrlich'
            ? 'Alle Beiträge verstehen sich als Jahresbeiträge in Euro. Der Mehrbeitrag wird zur besseren Übersicht auf den Monat umgerechnet.'
            : `Alle Beiträge verstehen sich als Beiträge pro ${zyklusLabel} in Euro. Ersparnis und Mehrbeitrag werden zur besseren Übersicht auf Jahr bzw. Monat umgerechnet.`}
          {' '}Angebot freibleibend – maßgeblich sind die jeweiligen Versicherungsbedingungen.{'\n'}
          Allianz Generalvertretung {beratername}
        </Text>
      </Page>
    </Document>
  )
}

export async function buildBeitragsuebersichtPdfBuffer(input: BeitragsuebersichtPdfInput): Promise<Buffer> {
  return renderToBuffer(<BeitragsuebersichtDocument {...input} />)
}
