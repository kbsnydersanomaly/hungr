import { Text } from "@react-email/components";
import { EmailLayout } from "./components/EmailLayout";

export default function ContactSalesEmail({
  name,
  email,
  company,
  message,
}: {
  name: string;
  email: string;
  company?: string;
  message: string;
}) {
  return (
    <EmailLayout preview={`Enterprise inquiry from ${name}`}>
      <Text style={{ fontSize: "16px", marginBottom: "16px" }}>
        New enterprise inquiry
      </Text>
      <Text style={{ fontSize: "14px", lineHeight: "24px" }}>
        <strong>Name:</strong> {name}
        <br />
        <strong>Email:</strong> {email}
        <br />
        {company && (
          <>
            <strong>Company:</strong> {company}
            <br />
          </>
        )}
        <strong>Message:</strong>
        <br />
        {message}
      </Text>
    </EmailLayout>
  );
}
