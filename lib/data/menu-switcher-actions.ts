import { createServerClient } from "@/lib/supabase/server";

export async function loadPublishedMenusForRestaurant(restaurantId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("menus")
    .select("id, name, slug, is_default")
    .eq("restaurant_id", restaurantId)
    .eq("status", "published")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("loadPublishedMenusForRestaurant error:", error);
    return [];
  }

  return data ?? [];
}
