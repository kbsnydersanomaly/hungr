import { Text } from "@react-email/components";
import { EmailLayout } from "./components/EmailLayout";

export default function PaymentReceiptEmail({
  invoice_number,
  amount,
  period,
}: {
  invoice_number: string;
  amount: string;
  period: string;
}) {
  return (
    <EmailLayout preview="Your Hungr payment receipt">
      <Text style={{ fontSize: "16px", marginBottom: "16px" }}>
        Payment received
      </Text>
      <Text style={{ fontSize: "14px", color: "#52525b", marginBottom: "24px" }}>
        Thank you for your payment. Here are the details:
      </Text>
      <Text style={{ fontSize: "14px", lineHeight: "24px" }}>
        <strong>Invoice:</strong> {invoice_number}
        <br />
        <strong>Amount:</strong> {amount}
        <br />
        <strong>Period:</strong> {period}
      </Text>
    </EmailLayout>
  );
}
