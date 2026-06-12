import { createServerClient } from "@/lib/supabase/server";

export async function loadApprovedReviewsForItem(menuItemId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("menu_item_id", menuItemId)
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/** Aggregated stats for an item (uses `reviews` so `review_stats` can stay off the public API). */
export async function loadReviewStatsForItem(menuItemId: string) {
  const supabase = await createServerClient();
  const { data: rows, error } = await supabase
    .from("reviews")
    .select("rating, created_at")
    .eq("menu_item_id", menuItemId)
    .eq("status", "approved");

  if (error) throw error;
  if (!rows?.length) return null;

  const distribution: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  let sum = 0;
  let lastUpdated: string | null = null;
  for (const r of rows) {
    sum += r.rating;
    distribution[String(r.rating)] = (distribution[String(r.rating)] ?? 0) + 1;
    if (!lastUpdated || r.created_at > lastUpdated) lastUpdated = r.created_at;
  }
  const n = rows.length;
  return {
    menu_item_id: menuItemId,
    avg_rating: Math.round((sum / n) * 100) / 100,
    total: n,
    distribution,
    last_updated: lastUpdated,
  };
}
