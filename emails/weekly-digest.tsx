import { Text } from "@react-email/components";
import { EmailLayout, EmailButton } from "./components/EmailLayout";

export default function WeeklyDigestEmail({
  restaurant_name,
  views,
  new_reviews,
  dashboard_url,
}: {
  restaurant_name: string;
  views: number;
  new_reviews: number;
  dashboard_url: string;
}) {
  return (
    <EmailLayout preview="Your weekly Hungr digest">
      <Text style={{ fontSize: "16px", marginBottom: "16px" }}>
        Weekly digest for {restaurant_name}
      </Text>
      <Text style={{ fontSize: "14px", color: "#52525b", marginBottom: "24px" }}>
        Here&apos;s how your menu performed this week:
      </Text>
      <Text style={{ fontSize: "14px", lineHeight: "24px" }}>
        <strong>Menu views:</strong> {views}
        <br />
        <strong>New reviews:</strong> {new_reviews}
      </Text>
      <EmailButton href={dashboard_url}>View dashboard</EmailButton>
    </EmailLayout>
  );
}
