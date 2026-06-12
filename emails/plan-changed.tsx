import { Text } from "@react-email/components";
import { EmailLayout } from "./components/EmailLayout";

export default function PlanChangedEmail({
  old_plan,
  new_plan,
}: {
  old_plan: string;
  new_plan: string;
}) {
  return (
    <EmailLayout preview="Your Hungr plan has been updated">
      <Text style={{ fontSize: "16px", marginBottom: "16px" }}>
        Plan updated
      </Text>
      <Text style={{ fontSize: "14px", color: "#52525b", marginBottom: "24px" }}>
        Your plan has been changed from <strong>{old_plan}</strong> to{" "}
        <strong>{new_plan}</strong>. The change will take effect at the start of
        your next billing cycle.
      </Text>
    </EmailLayout>
  );
}
