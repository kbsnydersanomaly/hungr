import { createServerClient } from "@/lib/supabase/server";
import { NotFoundError } from "@/lib/errors";
import type { CategoryNode } from "@/lib/types/menu";

export async function loadMenuBySlug(restaurantSlug: string, menuSlug: string) {
  const supabase = await createServerClient();

  const { data: restaurant, error: restaurantError } = await supabase
    .from("restaurants")
    .select("id")
    .eq("slug", restaurantSlug)
    .maybeSingle();

  if (restaurantError || !restaurant) throw new NotFoundError("Restaurant not found");

  const { data, error } = await supabase
    .from("menus")
    .select("*")
    .eq("restaurant_id", restaurant.id)
    .eq("slug", menuSlug)
    .eq("status", "published")
    .maybeSingle();

  if (error || !data) throw new NotFoundError("Menu not found");
  return data;
}

export async function loadDefaultMenuForRestaurant(restaurantId: string) {
  const supabase = await createServerClient();

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("default_menu_id")
    .eq("id", restaurantId)
    .single();

  if (restaurant?.default_menu_id) {
    const { data } = await supabase
      .from("menus")
      .select("*")
      .eq("id", restaurant.default_menu_id)
      .eq("status", "published")
      .single();
    if (data) return data;
  }

  const { data, error } = await supabase
    .from("menus")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("status", "published")
    .order("sort_order", { ascending: true })
    .limit(1)
    .single();

  if (error || !data) throw new NotFoundError("No published menu found");
  return data;
}

export async function loadCategoriesForMenu(menuId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("menu_id", menuId)
    .is("parent_id", null)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function loadSubcategoriesForMenu(menuId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("menu_id", menuId)
    .not("parent_id", "is", null)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

type CategoryRow = {
  id: string;
  name: string;
  sort_order: number;
  parent_id: string | null;
};

/**
 * Assemble a one-level-deep category tree from top-level categories and their
 * sub-categories. Rows are assumed to already be sorted by `sort_order`.
 */
export function buildCategoryTree(
  topLevel: CategoryRow[],
  subcategories: CategoryRow[]
): CategoryNode[] {
  const childrenByParent = new Map<string, CategoryRow[]>();
  for (const sub of subcategories) {
    const parentId = sub.parent_id;
    if (!parentId) continue;
    const siblings = childrenByParent.get(parentId);
    if (siblings) siblings.push(sub);
    else childrenByParent.set(parentId, [sub]);
  }

  return topLevel.map((cat) => ({
    id: cat.id,
    name: cat.name,
    sort_order: cat.sort_order,
    parent_id: cat.parent_id,
    children: (childrenByParent.get(cat.id) ?? []).map((sub) => ({
      id: sub.id,
      name: sub.name,
      sort_order: sub.sort_order,
      parent_id: sub.parent_id,
      children: [],
    })),
  }));
}

export async function loadMenuItemsForMenu(menuId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("menu_items")
    .select("*")
    .eq("menu_id", menuId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function loadMenuById(menuId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("menus")
    .select("*")
    .eq("id", menuId)
    .maybeSingle();

  if (error) {
    console.error("loadMenuById error:", error);
    throw new NotFoundError("Menu not found");
  }

  if (!data) {
    throw new NotFoundError("Menu not found");
  }

  return data;
}
