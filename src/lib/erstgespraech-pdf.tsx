import { Document, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer'

export interface ErstgespraechPdfSection {
  title: string
  fields: Array<{ label: string; value: string }>
}

const styles = StyleSheet.create({
  page: { padding: 42, fontSize: 10, color: '#1f2937' },
  accent: { height: 5, backgroundColor: '#FFC300', marginBottom: 22 },
  title: { fontSize: 20, fontWeight: 700, marginBottom: 4 },
  meta: { color: '#6b7280', marginBottom: 20 },
  section: { marginBottom: 18 },
  sectionTitle: { fontSize: 12, fontWeight: 700, backgroundColor: '#f3f4f6', padding: 7 },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb', paddingVertical: 7 },
  label: { width: '38%', color: '#6b7280', paddingRight: 12 },
  value: { width: '62%', fontWeight: 500 },
  footer: { position: 'absolute', bottom: 24, left: 42, right: 42, color: '#9ca3af', fontSize: 8 },
})

function ErstgespraechPdfDocument({ contactName, sections }: { contactName: string; sections: ErstgespraechPdfSection[] }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.accent} />
        <Text style={styles.title}>Erstgespräch</Text>
        <Text style={styles.meta}>{contactName} · Stand {new Date().toLocaleDateString('de-DE')}</Text>
        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.fields.map((field, index) => (
              <View key={`${field.label}-${index}`} style={styles.row} wrap={false}>
                <Text style={styles.label}>{field.label}</Text>
                <Text style={styles.value}>{field.value || '—'}</Text>
              </View>
            ))}
          </View>
        ))}
        <Text style={styles.footer} fixed>
          Sentimental Logic · Erstgespräch · Seite{' '}
          <Text render={({ pageNumber, totalPages }) => `${pageNumber}/${totalPages}`} />
        </Text>
      </Page>
    </Document>
  )
}

export async function buildErstgespraechPdfBuffer(contactName: string, sections: ErstgespraechPdfSection[]): Promise<Buffer> {
  return renderToBuffer(<ErstgespraechPdfDocument contactName={contactName} sections={sections} />)
}
