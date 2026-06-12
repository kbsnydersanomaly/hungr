import { createServerClient } from "@/lib/supabase/server";

export const BOTTOM_NAV_SETTING_KEY = "public_menu_bottom_nav";

/**
 * Whether the public menu shows the bottom navigation bar. Controlled from
 * the super admin settings page; defaults to enabled when unset.
 */
export async function isBottomNavEnabled(): Promise<boolean> {
  try {
    const supabase = await createServerClient();
    const { data } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", BOTTOM_NAV_SETTING_KEY)
      .maybeSingle();

    if (!data) return true;
    return (data.value as { enabled?: boolean })?.enabled !== false;
  } catch {
    return true;
  }
}
