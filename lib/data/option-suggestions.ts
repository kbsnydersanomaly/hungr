"use server";

import { requireRestaurantAccess } from "@/lib/auth/role";
import { safeAction } from "@/lib/errors";

export interface OptionSuggestions {
  preparations: string[];
  variations: string[];
  sides: string[];
  sauces: string[];
}

type OptionRow = { name?: string };

/**
 * Distinct option names previously used across the restaurant's menu items,
 * used to autocomplete option entry (e.g. "Fries" as a side).
 */
const EMPTY: OptionSuggestions = {
  preparations: [],
  variations: [],
  sides: [],
  sauces: [],
};

export async function loadOptionSuggestions(
  restaurantId: string
): Promise<OptionSuggestions> {
  const result = await safeAction(async () => {
    const { supabase } = await requireRestaurantAccess(restaurantId, "manager");

    const { data, error } = await supabase
      .from("menu_items")
      .select("preparations, variations, sides, sauces, menus!inner(restaurant_id)")
      .eq("menus.restaurant_id", restaurantId);

    if (error) {
      console.error("loadOptionSuggestions error:", error);
      return EMPTY;
    }

    const collect = (key: "preparations" | "variations" | "sides" | "sauces") => {
      const names = new Set<string>();
      for (const row of data ?? []) {
        const options = (row[key] ?? []) as OptionRow[];
        for (const option of options) {
          const name = option?.name?.trim();
          if (name) names.add(name);
        }
      }
      return [...names].sort((a, b) => a.localeCompare(b));
    };

    return {
      preparations: collect("preparations"),
      variations: collect("variations"),
      sides: collect("sides"),
      sauces: collect("sauces"),
    };
  });

  return result.ok && result.data ? result.data : EMPTY;
}
