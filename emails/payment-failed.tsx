import { Text } from "@react-email/components";
import { EmailLayout, EmailButton } from "./components/EmailLayout";

export default function PaymentFailedEmail({
  billing_url,
}: {
  billing_url: string;
}) {
  return (
    <EmailLayout preview="Your Hungr payment failed">
      <Text style={{ fontSize: "16px", marginBottom: "16px" }}>
        Payment failed
      </Text>
      <Text style={{ fontSize: "14px", color: "#52525b", marginBottom: "24px" }}>
        We couldn&apos;t process your latest payment. Please update your payment
        method to avoid service interruption.
      </Text>
      <EmailButton href={billing_url}>Update payment method</EmailButton>
    </EmailLayout>
  );
}
