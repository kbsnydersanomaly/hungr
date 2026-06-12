import { Text } from "@react-email/components";
import { EmailLayout, EmailButton } from "./components/EmailLayout";

export default function InvitationEmail({
  org_name,
  inviter_name,
  role,
  invite_url,
}: {
  org_name: string;
  inviter_name: string;
  role: string;
  invite_url: string;
}) {
  return (
    <EmailLayout preview={`You've been invited to ${org_name}`}>
      <Text style={{ fontSize: "16px", marginBottom: "16px" }}>
        You&apos;ve been invited to {org_name}
      </Text>
      <Text style={{ fontSize: "14px", color: "#52525b", marginBottom: "24px" }}>
        {inviter_name} invited you to join as a {role}. Click below to accept
        (link expires in 7 days).
      </Text>
      <EmailButton href={invite_url}>Accept invitation</EmailButton>
    </EmailLayout>
  );
}
