"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/session";
import { safeAction, ValidationError } from "@/lib/errors";

export async function updateProfile(formData: FormData): Promise<void> {
  await safeAction(async () => {
    const { user } = await requireSession();
    const displayName = formData.get("display_name")?.toString().trim();
    const firstName = formData.get("first_name")?.toString().trim() ?? "";
    const lastName = formData.get("last_name")?.toString().trim() ?? "";

    if (!displayName || displayName.length < 1) {
      throw new ValidationError("Display name is required.");
    }

    const supabase = await createServerClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName,
        first_name: firstName,
        last_name: lastName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) throw new Error(error.message);

    revalidatePath("/settings/profile");
    return { displayName };
  });
}
