import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import { formatZar } from "@/lib/utils/money";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    fontFamily: "Helvetica",
    color: "#1a1a1a",
  },
  header: {
    marginBottom: 30,
    borderBottom: "1px solid #e5e7eb",
    paddingBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 4,
    color: "#111827",
  },
  subtitle: {
    fontSize: 12,
    color: "#6b7280",
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#374151",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  label: {
    color: "#6b7280",
  },
  value: {
    fontWeight: "bold",
  },
  table: {
    marginTop: 10,
    borderTop: "1px solid #e5e7eb",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f9fafb",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottom: "1px solid #e5e7eb",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottom: "1px solid #f3f4f6",
  },
  tableCell: {
    flex: 1,
  },
  tableCellRight: {
    flex: 1,
    textAlign: "right",
  },
  totalSection: {
    marginTop: 20,
    borderTop: "2px solid #111827",
    paddingTop: 12,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 12,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#374151",
  },
  totalValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#111827",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center",
    color: "#9ca3af",
    fontSize: 9,
    borderTop: "1px solid #e5e7eb",
    paddingTop: 10,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    fontSize: 10,
    fontWeight: "bold",
  },
  statusPaid: {
    backgroundColor: "#dcfce7",
    color: "#166534",
  },
});

interface InvoiceData {
  number: string;
  orgName: string;
  orgSlug: string;
  restaurantName?: string;
  planName: string;
  periodStart: string;
  periodEnd: string;
  amountCents: number;
  paymentStatus: string;
  payfastPaymentId: string;
  paidAt?: string;
}

function InvoiceDocument(data: InvoiceData) {
  const periodStart = new Date(data.periodStart).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const periodEnd = new Date(data.periodEnd).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Invoice</Text>
          <Text style={styles.subtitle}>{data.number}</Text>
        </View>

        {/* Invoice details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Invoice Details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Invoice number</Text>
            <Text style={styles.value}>{data.number}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Date</Text>
            <Text style={styles.value}>
              {data.paidAt
                ? new Date(data.paidAt).toLocaleDateString("en-ZA", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : "—"}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Status</Text>
            <Text
              style={[
                styles.statusBadge,
                data.paymentStatus === "COMPLETE" ? styles.statusPaid : {},
              ]}
            >
              {data.paymentStatus === "COMPLETE" ? "PAID" : data.paymentStatus}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Payment ID</Text>
            <Text style={styles.value}>{data.payfastPaymentId}</Text>
          </View>
        </View>

        {/* Bill to */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bill To</Text>
          <Text style={styles.value}>{data.orgName}</Text>
          {data.restaurantName && (
            <Text style={styles.label}>Restaurant: {data.restaurantName}</Text>
          )}
        </View>

        {/* Line items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Line Items</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.tableCell}>Description</Text>
              <Text style={styles.tableCell}>Period</Text>
              <Text style={styles.tableCellRight}>Amount</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>
                {data.planName} Plan
                {data.restaurantName ? ` — ${data.restaurantName}` : ""}
              </Text>
              <Text style={styles.tableCell}>
                {periodStart} – {periodEnd}
              </Text>
              <Text style={styles.tableCellRight}>
                {formatZar(data.amountCents)}
              </Text>
            </View>
          </View>
        </View>

        {/* Total */}
        <View style={styles.totalSection}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatZar(data.amountCents)}</Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>
            Thank you for your business. Questions? Contact support@hungr.co.za
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderInvoicePdf(data: InvoiceData): Promise<Blob> {
  const doc = InvoiceDocument(data);
  const instance = pdf(doc);
  return await instance.toBlob();
}
