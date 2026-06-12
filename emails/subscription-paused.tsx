import { Text } from "@react-email/components";
import { EmailLayout, EmailButton } from "./components/EmailLayout";

export default function SubscriptionPausedEmail({
  restaurant_name,
  billing_url,
}: {
  restaurant_name: string;
  billing_url: string;
}) {
  return (
    <EmailLayout preview="Your Hungr subscription has been paused">
      <Text style={{ fontSize: "16px", marginBottom: "16px" }}>
        Subscription paused
      </Text>
      <Text style={{ fontSize: "14px", color: "#52525b", marginBottom: "24px" }}>
        Your subscription for {restaurant_name} has been paused. Your menu will
        remain visible until the end of the current billing period.
      </Text>
      <EmailButton href={billing_url}>Manage billing</EmailButton>
    </EmailLayout>
  );
}
