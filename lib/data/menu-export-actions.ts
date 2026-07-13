"use server";

import { actionError, safeAction } from "@/lib/errors";
import { requireRestaurantAccess } from "@/lib/auth/role";
import { loadMenuById } from "@/lib/data/menus";
import {
  buildMenuCsv,
  type MenuExportRow,
  type ParsedOption,
} from "@/lib/menu/bulk-upload";

/**
 * Serialize the menu's categories + items to a CSV string in exactly the
 * format the bulk importer accepts (plus a leading `id` column), so a menu can
 * be round-tripped: download → edit in a spreadsheet → re-upload in Modify
 * mode. Returns the CSV and the menu slug (used for the download filename).
 */
export async function exportMenuCsv(menuId: string) {
  return safeAction(async () => {
    const menu = await loadMenuById(menuId);
    const { supabase } = await requireRestaurantAccess(menu.restaurant_id, "manager");

    const [categoriesResult, itemsResult] = await Promise.all([
      supabase
        .from("categories")
        .select("id, name")
        .eq("menu_id", menuId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("menu_items")
        .select("*")
        .eq("menu_id", menuId)
        .order("sort_order", { ascending: true }),
    ]);
    if (categoriesResult.error) {
      throw actionError("Failed to load categories", categoriesResult.error);
    }
    if (itemsResult.error) {
      throw actionError("Failed to load items", itemsResult.error);
    }

    const categoryName = new Map(
      (categoriesResult.data ?? []).map((cat) => [cat.id, cat.name])
    );
    const idToName = new Map<string, string>();
    for (const item of itemsResult.data ?? []) {
      idToName.set(item.id, item.name);
    }

    const rows: MenuExportRow[] = (itemsResult.data ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      price_cents: item.price_cents,
      category: categoryName.get(item.category_id) ?? "",
      allergens: (item.allergens ?? []) as string[],
      labels: (item.labels ?? []) as string[],
      image_url: item.image_url,
      preparations: (item.preparations ?? []) as ParsedOption[],
      variations: (item.variations ?? []) as ParsedOption[],
      sides: (item.sides ?? []) as ParsedOption[],
      sauces: (item.sauces ?? []) as ParsedOption[],
      // Pairings are stored as ids but exported as names (the importer's
      // format). Ids pointing at items outside this menu can't be expressed
      // as names, so they're dropped.
      pairings: ((item.pairing_ids ?? []) as string[])
        .map((pairingId) => idToName.get(pairingId))
        .filter((pairingName): pairingName is string => pairingName !== undefined),
    }));

    return { csv: buildMenuCsv(rows), slug: menu.slug };
  });
}
