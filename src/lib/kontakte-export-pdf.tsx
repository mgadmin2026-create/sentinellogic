// PDF-Generierung für den Kontakte-Export (Querformat, kuratierte Spalten).
import { Document, Page, View, Text, StyleSheet, renderToBuffer } from '@react-pdf/renderer'

export interface ExportRow {
  name: string
  company: string
  email: string
  phone: string
  status: string
  pipelineStage: string
  source: string
  sparte: string
  kontaktTyp: string
  tags: string
  createdAt: string
}

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 8 },
  title: { fontSize: 14, fontWeight: 700, marginBottom: 4 },
  meta: { fontSize: 8, color: '#666', marginBottom: 12 },
  table: { display: 'flex', flexDirection: 'column', width: '100%' },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#ddd', paddingVertical: 4 },
  headerRow: { flexDirection: 'row', backgroundColor: '#1f2937', paddingVertical: 5 },
  headerCell: { color: '#fff', fontWeight: 700, fontSize: 8, paddingHorizontal: 3 },
  cell: { fontSize: 7.5, paddingHorizontal: 3 },
})

const COLUMNS: { key: keyof ExportRow; label: string; width: string }[] = [
  { key: 'name', label: 'Name', width: '13%' },
  { key: 'company', label: 'Firma', width: '13%' },
  { key: 'email', label: 'E-Mail', width: '15%' },
  { key: 'phone', label: 'Telefon', width: '10%' },
  { key: 'status', label: 'Status', width: '8%' },
  { key: 'pipelineStage', label: 'Pipeline-Stufe', width: '13%' },
  { key: 'source', label: 'Quelle', width: '8%' },
  { key: 'sparte', label: 'Sparte', width: '8%' },
  { key: 'kontaktTyp', label: 'Typ', width: '6%' },
  { key: 'tags', label: 'Tags', width: '11%' },
  { key: 'createdAt', label: 'Erstellt am', width: '8%' },
]

function ContactsPdfDocument({ rows, filterSummary }: { rows: ExportRow[]; filterSummary: string }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>Kontakte-Export</Text>
        <Text style={styles.meta}>
          Erstellt am {new Date().toLocaleDateString('de-DE')} · {rows.length} Kontakte · {filterSummary}
        </Text>
        <View style={styles.table}>
          <View style={styles.headerRow} fixed>
            {COLUMNS.map((col) => (
              <Text key={col.key} style={[styles.headerCell, { width: col.width }]}>{col.label}</Text>
            ))}
          </View>
          {rows.map((row, i) => (
            <View key={i} style={styles.row} wrap={false}>
              {COLUMNS.map((col) => (
                <Text key={col.key} style={[styles.cell, { width: col.width }]}>{row[col.key] || '—'}</Text>
              ))}
            </View>
          ))}
        </View>
      </Page>
    </Document>
  )
}

export async function buildContactsPdfBuffer(rows: ExportRow[], filterSummary: string): Promise<Buffer> {
  return renderToBuffer(<ContactsPdfDocument rows={rows} filterSummary={filterSummary} />)
}
