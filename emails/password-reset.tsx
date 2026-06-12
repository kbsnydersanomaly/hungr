import { Text } from "@react-email/components";
import { EmailLayout, EmailButton } from "./components/EmailLayout";

export default function PasswordResetEmail({
  reset_url,
}: {
  reset_url: string;
}) {
  return (
    <EmailLayout preview="Reset your Hungr password">
      <Text style={{ fontSize: "16px", marginBottom: "16px" }}>
        Password reset requested
      </Text>
      <Text style={{ fontSize: "14px", color: "#52525b", marginBottom: "24px" }}>
        Click the button below to reset your password. This link expires in 1 hour.
      </Text>
      <EmailButton href={reset_url}>Reset password</EmailButton>
      <Text style={{ fontSize: "12px", color: "#71717a", marginTop: "24px" }}>
        If you didn&apos;t request this, you can safely ignore this email.
      </Text>
    </EmailLayout>
  );
}
