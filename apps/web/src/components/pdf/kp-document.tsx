'use client';

import { Document, Page, Text, View, StyleSheet, PDFDownloadLink, PDFViewer } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica' },
  header: { marginBottom: 30, borderBottomWidth: 2, borderBottomColor: '#6366f1', paddingBottom: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1a1a26', marginBottom: 8 },
  subtitle: { fontSize: 12, color: '#666' },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#6366f1', marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingBottom: 4 },
  text: { fontSize: 11, lineHeight: 1.6, color: '#333' },
  label: { fontSize: 10, color: '#666', marginBottom: 2 },
  value: { fontSize: 12, fontWeight: 'bold', color: '#1a1a26', marginBottom: 8 },
  table: { marginTop: 10 },
  tableHeader: { backgroundColor: '#f3f4f6', padding: 8, flexDirection: 'row' },
  tableHeaderText: { fontSize: 10, fontWeight: 'bold', color: '#374151' },
  tableRow: { padding: 8, flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  tableCell: { fontSize: 10, color: '#374151' },
  totalRow: { padding: 8, flexDirection: 'row', backgroundColor: '#f9fafb', borderTopWidth: 2, borderTopColor: '#6366f1' },
  totalLabel: { fontSize: 12, fontWeight: 'bold', color: '#1a1a26', flex: 1 },
  totalValue: { fontSize: 12, fontWeight: 'bold', color: '#6366f1' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 9, color: '#999' },
});

interface KPDocumentProps {
  title: string;
  company?: string;
  description?: string;
  products: Array<{ name: string; quantity: number; price: number }>;
  total: number;
  currency: string;
  validUntil?: string;
  notes?: string;
}

export function KPDocument({ title, company, description, products, total, currency, validUntil, notes }: KPDocumentProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>КОМЕРЦІЙНА ПРОПОЗИЦІЯ</Text>
          <Text style={styles.subtitle}>{title}</Text>
        </View>

        {company && (
          <View style={styles.section}>
            <Text style={styles.label}>КЛІЄНТ</Text>
            <Text style={styles.value}>{company}</Text>
          </View>
        )}

        {description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ОПИС</Text>
            <Text style={styles.text}>{description}</Text>
          </View>
        )}

        {products.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ПЕРЕЛІК ПОСЛУГ/ТОВАРІВ</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderText, { flex: 1 }]}>Назва</Text>
                <Text style={[styles.tableHeaderText, { width: 60, textAlign: 'center' }]}>Кількість</Text>
                <Text style={[styles.tableHeaderText, { width: 100, textAlign: 'right' }]}>Ціна</Text>
                <Text style={[styles.tableHeaderText, { width: 100, textAlign: 'right' }]}>Сума</Text>
              </View>
              {products.map((p, i) => (
                <View key={i} style={styles.tableRow}>
                  <Text style={[styles.tableCell, { flex: 1 }]}>{p.name}</Text>
                  <Text style={[styles.tableCell, { width: 60, textAlign: 'center' }]}>{p.quantity}</Text>
                  <Text style={[styles.tableCell, { width: 100, textAlign: 'right' }]}>{p.price.toLocaleString('uk')} {currency}</Text>
                  <Text style={[styles.tableCell, { width: 100, textAlign: 'right' }]}>{(p.price * p.quantity).toLocaleString('uk')} {currency}</Text>
                </View>
              ))}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>РАЗОМ:</Text>
                <Text style={styles.totalValue}>{total.toLocaleString('uk')} {currency}</Text>
              </View>
            </View>
          </View>
        )}

        {validUntil && (
          <View style={styles.section}>
            <Text style={styles.label}>ТЕРМІН ДІЇ ПРОПОЗИЦІЇ</Text>
            <Text style={styles.value}>{validUntil}</Text>
          </View>
        )}

        {notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ДОДАТКОВО</Text>
            <Text style={styles.text}>{notes}</Text>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>CRM-Next · {new Date().toLocaleDateString('uk')}</Text>
          <Text style={styles.footerText}>Автоматично згенеровано</Text>
        </View>
      </Page>
    </Document>
  );
}

export function KPDownloadLink({ data, filename = 'commercial-proposal.pdf' }: { data: KPDocumentProps; filename?: string }) {
  return (
    <PDFDownloadLink
      document={<KPDocument {...data} />}
      fileName={filename}
      className="inline-flex items-center gap-2"
    >
      {({ loading }) => (
        <span className="text-sm text-primary hover:text-primary-hover transition-colors">
          {loading ? 'Генерація PDF...' : '📥 Завантажити PDF'}
        </span>
      )}
    </PDFDownloadLink>
  );
}

export function KPViewerComponent({ data }: { data: KPDocumentProps }) {
  return (
    <PDFViewer width="100%" height="600" showToolbar={false}>
      <KPDocument {...data} />
    </PDFViewer>
  );
}
