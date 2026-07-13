import { Text } from "@react-email/components";
import { EmailLayout, EmailButton } from "./components/EmailLayout";

export default function ReviewPendingEmail({
  restaurant_name,
  reviews_url,
  rating,
  reviewer_name,
  message_excerpt,
}: {
  restaurant_name: string;
  reviews_url: string;
  rating?: number;
  reviewer_name?: string;
  message_excerpt?: string;
}) {
  return (
    <EmailLayout preview="New review pending moderation">
      <Text style={{ fontSize: "16px", marginBottom: "16px" }}>
        New review at {restaurant_name}
      </Text>
      {rating != null && (
        <Text style={{ fontSize: "14px", color: "#52525b", marginBottom: "8px" }}>
          Rating: {"★".repeat(rating)}{"☆".repeat(Math.max(0, 5 - rating))} ({rating}/5)
        </Text>
      )}
      {reviewer_name && (
        <Text style={{ fontSize: "14px", color: "#52525b", marginBottom: "8px" }}>
          From: {reviewer_name}
        </Text>
      )}
      {message_excerpt && (
        <Text style={{ fontSize: "14px", color: "#52525b", marginBottom: "8px" }}>
          &ldquo;{message_excerpt}&rdquo;
        </Text>
      )}
      <Text style={{ fontSize: "14px", color: "#52525b", marginBottom: "24px" }}>
        This review is pending your approval.
      </Text>
      <EmailButton href={reviews_url}>Review moderation queue</EmailButton>
    </EmailLayout>
  );
}
