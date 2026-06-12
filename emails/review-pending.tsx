import { Text } from "@react-email/components";
import { EmailLayout, EmailButton } from "./components/EmailLayout";

export default function ReviewPendingEmail({
  restaurant_name,
  reviews_url,
}: {
  restaurant_name: string;
  reviews_url: string;
}) {
  return (
    <EmailLayout preview="New review pending moderation">
      <Text style={{ fontSize: "16px", marginBottom: "16px" }}>
        New review at {restaurant_name}
      </Text>
      <Text style={{ fontSize: "14px", color: "#52525b", marginBottom: "24px" }}>
        A customer submitted a new review. It&apos;s pending your approval.
      </Text>
      <EmailButton href={reviews_url}>Review moderation queue</EmailButton>
    </EmailLayout>
  );
}
