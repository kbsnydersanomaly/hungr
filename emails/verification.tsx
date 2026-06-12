import { Text } from "@react-email/components";
import { EmailLayout, EmailButton } from "./components/EmailLayout";

export default function VerificationEmail({
  confirm_url,
}: {
  confirm_url: string;
}) {
  return (
    <EmailLayout preview="Verify your email address for Hungr">
      <Text style={{ fontSize: "16px", marginBottom: "16px" }}>
        Welcome to Hungr!
      </Text>
      <Text style={{ fontSize: "14px", color: "#52525b", marginBottom: "24px" }}>
        Please verify your email address by clicking the button below.
      </Text>
      <EmailButton href={confirm_url}>Verify email address</EmailButton>
      <Text style={{ fontSize: "12px", color: "#71717a", marginTop: "24px" }}>
        If you didn&apos;t create an account, you can safely ignore this email.
      </Text>
    </EmailLayout>
  );
}
