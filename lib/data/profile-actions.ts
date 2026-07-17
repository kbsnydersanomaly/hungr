"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSession } from "@/lib/auth/session";
import { actionError, safeAction, ValidationError } from "@/lib/errors";
import {
  deleteOrganizationUnsafe,
  purgeMediaStorage,
} from "@/lib/data/deletion";
import { cancelSubscription as payfastCancel } from "@/lib/billing/payfast";
import { UpdateProfileSchema } from "@/lib/schemas/profile";
import { normalizeSouthAfricanPhone } from "@/lib/utils/phone";

export async function updateProfile(formData: FormData) {
  return safeAction(async () => {
    const { user } = await requireSession();

    const raw = Object.fromEntries(formData);
    const parsedResult = UpdateProfileSchema.safeParse(raw);
    if (!parsedResult.success) {
      throw new ValidationError(parsedResult.error.issues[0].message);
    }
    const parsed = parsedResult.data;

    const normalizedPhone = parsed.phone
      ? normalizeSouthAfricanPhone(parsed.phone)
      : null;

    const supabase = await createServerClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: parsed.display_name,
        first_name: parsed.first_name ?? "",
        last_name: parsed.last_name ?? "",
        phone: normalizedPhone,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) throw new Error(error.message);

    revalidatePath("/settings/profile");
    return { displayName: parsed.display_name };
  });
}

export async function deleteOwnAccount(confirmationEmail: string) {
  return safeAction(async () => {
    const { user } = await requireSession();

    const accountEmail = user.email ?? "";
    if (
      confirmationEmail.trim().toLowerCase() !== accountEmail.toLowerCase()
    ) {
      throw new ValidationError("Email does not match your account email.");
    }

    const admin = createAdminClient();

    // Find organizations owned by this user.
    const { data: ownedOrgs, error: orgError } = await admin
      .from("organizations")
      .select("id")
      .eq("owner_id", user.id);
    if (orgError) {
      console.error("deleteOwnAccount org lookup error:", orgError);
      throw actionError("Failed to look up your organizations", orgError);
    }
    const orgIds = (ownedOrgs ?? []).map((org) => org.id);

    // Cancel live PayFast subscriptions on owned orgs so recurring billing
    // actually stops. Best-effort: the rows are wiped below regardless, so a
    // provider failure is logged but does not abort the deletion.
    if (orgIds.length > 0) {
      const { data: subs } = await admin
        .from("subscriptions")
        .select("id, payfast_token, status")
        .in("org_id", orgIds);
      for (const sub of subs ?? []) {
        if (!sub.payfast_token) continue;
        if (sub.status !== "active" && sub.status !== "paused") continue;
        try {
          await payfastCancel(sub.payfast_token);
        } catch (err) {
          console.error(
            `deleteOwnAccount PayFast cancel failed for subscription ${sub.id}:`,
            err
          );
        }
      }
    }

    // Cascade-delete each owned organization (also purges its media storage).
    for (const orgId of orgIds) {
      await deleteOrganizationUnsafe(admin, orgId);
    }

    // Remove storage for any remaining media owned by this user (e.g. uploaded
    // into an org they don't own). Deleting the auth user cascades these rows
    // via media.owner_user_id, but not the underlying storage objects.
    const { data: userMedia } = await admin
      .from("media")
      .select("bucket, path")
      .eq("owner_user_id", user.id);
    await purgeMediaStorage(userMedia);

    // Deleting the auth user cascades the profile row and any remaining FK
    // references (e.g. memberships in orgs the user doesn't own).
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) {
      console.error("deleteOwnAccount error:", error);
      throw actionError("Failed to delete account", error);
    }

    // Clear the now-dead session cookies and leave the app.
    const supabase = await createServerClient();
    await supabase.auth.signOut();
    redirect("/");
  });
}
