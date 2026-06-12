import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { sendMail } from "@/lib/mail";
import { ValidationError } from "@/lib/errors";

export function isDuplicateUserError(error: { message?: string }): boolean {
  const msg = error.message?.toLowerCase() ?? "";
  return (
    msg.includes("already") ||
    msg.includes("registered") ||
    msg.includes("exists")
  );
}

export async function sendVerificationEmail(email: string, password: string) {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient.auth.admin.generateLink({
    type: "signup",
    email,
    password,
    options: {
      redirectTo: `${env.NEXT_PUBLIC_APP_URL}/sign-in`,
    },
  });

  if (error) throw new ValidationError(error.message);
  if (!data.properties?.action_link) {
    throw new ValidationError("Failed to generate verification link.");
  }

  await sendMail("verification", email, {
    confirm_url: data.properties.action_link,
  });
}

export async function sendPasswordResetEmail(email: string) {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient.auth.admin.generateLink({
    type: "recovery",
    email,
    options: {
      redirectTo: `${env.NEXT_PUBLIC_APP_URL}/reset`,
    },
  });

  if (error) throw new ValidationError(error.message);
  if (!data.properties?.action_link) {
    throw new ValidationError("Failed to generate reset link.");
  }

  await sendMail("password-reset", email, {
    reset_url: data.properties.action_link,
  });
}
