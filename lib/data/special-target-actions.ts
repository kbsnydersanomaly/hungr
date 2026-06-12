"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { ValidationError, safeAction } from "@/lib/errors";
import { requireRestaurantAccess } from "@/lib/auth/role";

export async function loadItemsAndCategoriesForRestaurant(restaurantId: string) {
  const { supabase } = await requireRestaurantAccess(restaurantId, "staff");

  const [{ data: menus }, { data: categories }, { data: items }] = await Promise.all([
    supabase
      .from("menus")
      .select("id, name")
      .eq("restaurant_id", restaurantId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("categories")
      .select("id, name, menu_id")
      .in(
        "menu_id",
        (
          await supabase
            .from("menus")
            .select("id")
            .eq("restaurant_id", restaurantId)
        ).data?.map((m) => m.id) ?? []
      )
      .order("sort_order", { ascending: true }),
    supabase
      .from("menu_items")
      .select("id, name, category_id, menu_id, price_cents")
      .in(
        "menu_id",
        (
          await supabase
            .from("menus")
            .select("id")
            .eq("restaurant_id", restaurantId)
        ).data?.map((m) => m.id) ?? []
      )
      .order("sort_order", { ascending: true }),
  ]);

  return {
    menus: menus ?? [],
    categories: categories ?? [],
    items: items ?? [],
  };
}

export async function loadSpecialTargets(specialId: string) {
  const supabase = await createServerClient();

  const { data: special } = await supabase
    .from("specials")
    .select("restaurant_id")
    .eq("id", specialId)
    .maybeSingle();

  if (!special) throw new ValidationError("Special not found");

  const { supabase: authed } = await requireRestaurantAccess(special.restaurant_id, "staff");

  const { data, error } = await authed
    .from("special_targets")
    .select("*")
    .eq("special_id", specialId);

  if (error) {
    console.error("loadSpecialTargets error:", error);
    throw new ValidationError("Failed to load special targets.");
  }

  return data ?? [];
}

export async function saveSpecialTargets(
  specialId: string,
  targets: { item_id?: string; category_id?: string; combo_item_ids?: string[] }[]
) {
  return safeAction(async () => {
    const supabase = await createServerClient();

    const { data: special } = await supabase
      .from("specials")
      .select("restaurant_id")
      .eq("id", specialId)
      .maybeSingle();

    if (!special) throw new ValidationError("Special not found");

    const { supabase: authed } = await requireRestaurantAccess(special.restaurant_id, "manager");

    // Delete existing targets
    await authed.from("special_targets").delete().eq("special_id", specialId);

    // Insert new targets
    if (targets.length > 0) {
      const { error } = await authed.from("special_targets").insert(
        targets.map((t) => ({
          special_id: specialId,
          item_id: t.item_id ?? null,
          category_id: t.category_id ?? null,
          combo_item_ids: t.combo_item_ids ?? null,
        }))
      );

      if (error) {
        console.error("saveSpecialTargets error:", error);
        throw new ValidationError("Failed to save special targets.");
      }
    }

    revalidatePath(`/restaurants/${special.restaurant_id}/specials`);
    return { saved: true };
  });
}
