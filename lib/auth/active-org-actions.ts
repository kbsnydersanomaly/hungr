"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { safeAction, ValidationError } from "@/lib/errors";

/** Switch the active organization (must be a member of the target org). */
export async function setActiveOrg(orgId: string, redirectTo = "/dashboard") {
  const result = await safeAction(async () => {
    const { user, supabase } = await requireSession();

    const { data: membership } = await supabase
      .from("organization_members")
      .select("org_id")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) throw new ValidationError("You are not a member of that organization.");

    const cookieStore = await cookies();
    cookieStore.set("active_org", orgId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    // The restaurant selection belongs to the previous org.
    cookieStore.delete("active_restaurant");

    return { switched: true };
  });

  if (result.ok) redirect(redirectTo);
  return result;
}
