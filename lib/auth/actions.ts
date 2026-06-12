"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  SignUpSchema,
  SignInSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
} from "@/lib/schemas/auth";
import { safeAction, ValidationError } from "@/lib/errors";
import {
  isDuplicateUserError,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "@/lib/auth/auth-email";

export async function signUpAction(formData: FormData) {
  return safeAction(async () => {
    const raw = Object.fromEntries(formData);
    const parsed = SignUpSchema.parse(raw);

    const adminClient = createAdminClient();
    const metadata = {
      first_name: parsed.firstName,
      last_name: parsed.lastName,
      display_name: `${parsed.firstName} ${parsed.lastName}`,
      ...(parsed.organizationName
        ? { org_name: parsed.organizationName }
        : {}),
    };

    const { data, error } = await adminClient.auth.admin.createUser({
      email: parsed.email,
      password: parsed.password,
      email_confirm: false,
      user_metadata: metadata,
    });

    if (error) {
      if (isDuplicateUserError(error)) {
        try {
          await sendVerificationEmail(parsed.email, parsed.password);
          return { user: null, resent: true };
        } catch {
          throw new ValidationError(
            "An account with this email already exists. Try signing in."
          );
        }
      }
      throw new ValidationError(error.message);
    }

    await sendVerificationEmail(parsed.email, parsed.password);

    return { user: data.user };
  });
}

export async function signInAction(formData: FormData) {
  return safeAction(async () => {
    const raw = Object.fromEntries(formData);
    const parsed = SignInSchema.parse(raw);

    const supabase = await createServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.email,
      password: parsed.password,
    });

    if (error) throw new ValidationError(error.message);
    return { user: data.user };
  });
}

export async function signOutAction() {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/sign-in");
}

export async function forgotPasswordAction(formData: FormData) {
  return safeAction(async () => {
    const raw = Object.fromEntries(formData);
    const parsed = ForgotPasswordSchema.parse(raw);

    await sendPasswordResetEmail(parsed.email);

    return { sent: true };
  });
}

export async function resetPasswordAction(formData: FormData) {
  return safeAction(async () => {
    const raw = Object.fromEntries(formData);
    const parsed = ResetPasswordSchema.parse(raw);

    const supabase = await createServerClient();
    const { error } = await supabase.auth.updateUser({
      password: parsed.password,
    });

    if (error) throw new ValidationError(error.message);
    return { success: true };
  });
}

export async function resendVerificationEmail(email: string, password: string) {
  return safeAction(async () => {
    const parsedEmail = z.string().email("Please enter a valid email address").parse(email);
    const parsedPassword = z.string().min(1, "Password is required").parse(password);
    await sendVerificationEmail(parsedEmail, parsedPassword);
    return { sent: true };
  });
}
