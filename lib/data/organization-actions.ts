"use server";

import { revalidatePath } from "next/cache";
import { ValidationError, actionError, safeAction } from "@/lib/errors";
import { requireOrgAccess } from "@/lib/auth/role";
import { getActiveOrg } from "@/lib/auth/active-org";

export async function updateOrganizationName(formData: FormData) {
  return safeAction(async () => {
    const name = String(formData.get("name") ?? "").trim();

    if (!name) throw new ValidationError("Organization name is required.");

    const activeOrg = await getActiveOrg();
    if (!activeOrg?.orgId) throw new ValidationError("No organization found.");

    const { supabase } = await requireOrgAccess(activeOrg.orgId, "owner");

    const { error } = await supabase
      .from("organizations")
      .update({ name, updated_at: new Date().toISOString() })
      .eq("id", activeOrg.orgId);

    if (error) {
      console.error("updateOrganizationName error:", error);
      throw actionError("Failed to update organization name", error);
    }

    revalidatePath("/settings/organization");
    revalidatePath("/dashboard");
    return { updated: true };
  });
}
