import { createServerClient } from "@/lib/supabase/server";

export async function loadCombosForItem(itemId: string) {
  const supabase = await createServerClient();

  // Find active combo specials that target this item
  const { data: targets, error: targetError } = await supabase
    .from("special_targets")
    .select("special_id")
    .eq("item_id", itemId);

  if (targetError || !targets || targets.length === 0) return [];

  const specialIds = targets.map((t) => t.special_id);

  const { data, error } = await supabase
    .from("specials")
    .select("*, special_targets(*, menu_items(name, price_cents, image_url))")
    .in("id", specialIds)
    .eq("active", true)
    .eq("kind", "combo")
    .order("priority", { ascending: false });

  if (error) {
    console.error("loadCombosForItem error:", error);
    return [];
  }

  return data ?? [];
}

/**
 * Load the items a manager has explicitly marked as pairings for this item,
 * preserving the saved order. Only returns items still in the same menu.
 */
export async function loadPairedItems(menuId: string, pairingIds: string[]) {
  if (!pairingIds || pairingIds.length === 0) return [];

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("menu_items")
    .select("id, name, price_cents, image_url, image_urls")
    .eq("menu_id", menuId)
    .in("id", pairingIds);

  if (error) {
    console.error("loadPairedItems error:", error);
    return [];
  }

  // Preserve the order in which pairings were saved.
  type PairedItem = NonNullable<typeof data>[number];
  const byId = new Map((data ?? []).map((item) => [item.id, item]));
  return pairingIds
    .map((id) => byId.get(id))
    .filter((item): item is PairedItem => item != null);
}

export async function loadRecommendedItems(menuId: string, excludeItemId: string, limit = 4) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("menu_items")
    .select("id, name, description, price_cents, image_url, image_urls, labels, category_id")
    .eq("menu_id", menuId)
    .neq("id", excludeItemId)
    .order("sort_order", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("loadRecommendedItems error:", error);
    return [];
  }

  return data ?? [];
}
