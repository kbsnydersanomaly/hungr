import { Text } from "@react-email/components";
import { EmailLayout, EmailButton } from "./components/EmailLayout";

export default function SubscriptionCancelledEmail({
  restaurant_name,
  billing_url,
}: {
  restaurant_name: string;
  billing_url: string;
}) {
  return (
    <EmailLayout preview="Your Hungr subscription has been cancelled">
      <Text style={{ fontSize: "16px", marginBottom: "16px" }}>
        Subscription cancelled
      </Text>
      <Text style={{ fontSize: "14px", color: "#52525b", marginBottom: "24px" }}>
        Your subscription for {restaurant_name} has been cancelled. You can
        reactivate anytime.
      </Text>
      <EmailButton href={billing_url}>Reactivate</EmailButton>
    </EmailLayout>
  );
}
