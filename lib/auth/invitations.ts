"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeAction, ValidationError } from "@/lib/errors";
import { requireSession } from "./session";
import { loadInvitationByToken } from "@/lib/data/invitations";

/** Land the user in the org they just joined. */
async function activateOrg(orgId: string) {
  const cookieStore = await cookies();
  cookieStore.set("active_org", orgId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  cookieStore.delete("active_restaurant");
}

export async function acceptInvitation(token: string) {
  return safeAction(async () => {
    const inv = await loadInvitationByToken(token);
    if (!inv) throw new ValidationError("Invalid invitation.");
    if (inv.accepted_at) throw new ValidationError("Invitation already accepted.");
    if (inv.revoked_at) throw new ValidationError("Invitation has been revoked.");
    if (new Date(inv.expires_at) < new Date()) throw new ValidationError("Invitation has expired.");

    const { user, supabase } = await requireSession();
    if (user.email?.toLowerCase() !== inv.email.toLowerCase()) {
      throw new ValidationError("Invitation is for a different email address.");
    }

    const { error } = await supabase.rpc("accept_invitation", {
      p_invitation_id: inv.id,
      p_user_id: user.id,
    });
    if (error) {
      console.error("accept_invitation rpc error:", error);
      throw new ValidationError(
        "Failed to accept the invitation. Please ask for a new invite."
      );
    }

    await activateOrg(inv.org_id);

    revalidatePath("/dashboard", "layout");
    return { accepted: true };
  });
}

export async function acceptInviteAndSignUp(token: string, formData: FormData) {
  return safeAction(async () => {
    const inv = await loadInvitationByToken(token);
    if (!inv) throw new ValidationError("Invalid invitation.");
    if (inv.accepted_at) throw new ValidationError("Invitation already accepted.");
    if (inv.revoked_at) throw new ValidationError("Invitation has been revoked.");
    if (new Date(inv.expires_at) < new Date()) throw new ValidationError("Invitation has expired.");

    const email = inv.email;
    const password = String(formData.get("password") ?? "");
    const firstName = String(formData.get("firstName") ?? "");
    const lastName = String(formData.get("lastName") ?? "");

    if (!password || password.length < 8) throw new ValidationError("Password must be at least 8 characters.");
    if (!firstName) throw new ValidationError("First name is required.");
    if (!lastName) throw new ValidationError("Last name is required.");

    const adminClient = createAdminClient();

    const { data: signUpData, error: signUpError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
          display_name: `${firstName} ${lastName}`,
        },
      });

    if (signUpError) throw new ValidationError(signUpError.message);
    if (!signUpData.user) throw new ValidationError("Failed to create account.");

    const { error: acceptError } = await adminClient.rpc("accept_invitation", {
      p_invitation_id: inv.id,
      p_user_id: signUpData.user.id,
    });
    if (acceptError) throw new ValidationError(acceptError.message);

    const supabase = await createServerClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) throw new ValidationError(signInError.message);

    await activateOrg(inv.org_id);

    revalidatePath("/dashboard", "layout");
    return { accepted: true };
  });
}
