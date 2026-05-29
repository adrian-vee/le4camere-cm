"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  PDFDownloadLink,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 11 },
  header: { marginBottom: 20, borderBottom: "1 solid #e5e7eb", paddingBottom: 15 },
  title: { fontSize: 18, fontWeight: "bold", color: "#111827" },
  subtitle: { fontSize: 10, color: "#6b7280", marginTop: 4 },
  docNumber: { fontSize: 12, fontWeight: "bold", color: "#374151", marginTop: 8 },
  section: { marginBottom: 15 },
  sectionTitle: { fontSize: 12, fontWeight: "bold", color: "#374151", marginBottom: 8, borderBottom: "1 solid #f3f4f6", paddingBottom: 4 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  label: { fontSize: 10, color: "#6b7280" },
  value: { fontSize: 11, color: "#111827" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 15, paddingTop: 10, borderTop: "2 solid #111827" },
  totalLabel: { fontSize: 14, fontWeight: "bold", color: "#111827" },
  totalValue: { fontSize: 14, fontWeight: "bold", color: "#111827" },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, textAlign: "center", fontSize: 8, color: "#9ca3af" },
});

interface ReceiptProps {
  docNumber: string;
  guest: string;
  checkIn: string;
  checkOut: string;
  roomType: string;
  totalPrice: number;
  currency: string;
  adults: number;
  children: number;
}

function ReceiptDocument(props: ReceiptProps) {
  const nights = Math.ceil(
    (new Date(props.checkOut).getTime() - new Date(props.checkIn).getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Le 4 Camere</Text>
          <Text style={styles.subtitle}>Ricevuta interna</Text>
          <Text style={styles.docNumber}>N. {props.docNumber}</Text>
          <Text style={styles.subtitle}>
            Data emissione: {new Date().toLocaleDateString("it-IT")}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ospite</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Nome</Text>
            <Text style={styles.value}>{props.guest}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dettagli soggiorno</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Check-in</Text>
            <Text style={styles.value}>{props.checkIn}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Check-out</Text>
            <Text style={styles.value}>{props.checkOut}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Notti</Text>
            <Text style={styles.value}>{nights}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Camera</Text>
            <Text style={styles.value}>{props.roomType}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Adulti</Text>
            <Text style={styles.value}>{props.adults}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Bambini</Text>
            <Text style={styles.value}>{props.children}</Text>
          </View>
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Totale</Text>
          <Text style={styles.totalValue}>
            {props.totalPrice.toFixed(2)} {props.currency}
          </Text>
        </View>

        <Text style={styles.footer}>
          Le 4 Camere - Documento interno non fiscale
        </Text>
      </Page>
    </Document>
  );
}

export default function ReceiptPDF(props: ReceiptProps) {
  return (
    <PDFDownloadLink
      document={<ReceiptDocument {...props} />}
      fileName={`ricevuta-${props.docNumber.replace("/", "-")}.pdf`}
      className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors inline-block"
    >
      {({ loading }) => (loading ? "Preparazione..." : "Scarica PDF")}
    </PDFDownloadLink>
  );
}
