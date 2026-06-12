"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth/role";
import { safeAction, ValidationError } from "@/lib/errors";
import { BOTTOM_NAV_SETTING_KEY } from "@/lib/data/platform-settings";

export async function setBottomNavEnabledAction(enabled: boolean) {
  return safeAction(async () => {
    const { supabase } = await requireSuperAdmin();

    const { error } = await supabase.from("platform_settings").upsert({
      key: BOTTOM_NAV_SETTING_KEY,
      value: { enabled },
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error("setBottomNavEnabledAction error:", error);
      throw new ValidationError("Failed to update setting.");
    }

    revalidatePath("/admin/settings");
    return { enabled };
  });
}
