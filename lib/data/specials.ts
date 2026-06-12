import { createServerClient } from "@/lib/supabase/server";

export async function loadActiveSpecialsForRestaurant(restaurantId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("specials")
    .select("*, special_targets(*)")
    .eq("restaurant_id", restaurantId)
    .eq("active", true)
    .order("priority", { ascending: false });

  if (error) throw error;
  return data ?? [];
}
