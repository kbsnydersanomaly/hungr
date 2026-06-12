"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ValidationError, safeAction } from "@/lib/errors";
import {
  requireRestaurantAccess,
  requireCategoryAccess,
  requireItemAccess,
} from "@/lib/auth/role";
import { ensureUniqueSlug } from "@/lib/utils/slug";
import { safeJsonParse } from "@/lib/utils/safeJsonParse";
import { generateAndStoreMenuQr } from "@/lib/qr/generate";
import { loadMenuById } from "@/lib/data/menus";
import { writeAudit } from "@/lib/utils/audit";

export async function createMenu(restaurantId: string, formData: FormData) {
  return safeAction(async () => {
    const { supabase } = await requireRestaurantAccess(restaurantId, "manager");

    const name = String(formData.get("name") ?? "").trim();
    if (!name) throw new ValidationError("Menu name is required.");

    const slug = await ensureUniqueSlug(name, async (s) => {
      const { data } = await supabase
        .from("menus")
        .select("id")
        .eq("restaurant_id", restaurantId)
        .eq("slug", s)
        .maybeSingle();
      return !!data;
    });

    const { data: menu, error } = await supabase
      .from("menus")
      .insert({ restaurant_id: restaurantId, name, slug })
      .select()
      .single();

    if (error || !menu) {
      console.error("createMenu error:", error);
      throw new ValidationError("Failed to create menu.");
    }

    const { error: seedError } = await supabase.from("categories").insert(
      ["Starters", "Mains", "Desserts"].map((categoryName, index) => ({
        menu_id: menu.id,
        name: categoryName,
        sort_order: index,
      }))
    );
    if (seedError) {
      console.error("createMenu seed categories error:", seedError);
    }

    await writeAudit({
      action: "menu.create",
      target_table: "menus",
      target_id: menu.id,
      diff: { name, slug },
    });

    revalidatePath(`/restaurants/${restaurantId}/menus`);
    redirect(`/restaurants/${restaurantId}/menus/${menu.id}`);
  });
}

export async function upsertCategory(menuId: string, formData: FormData): Promise<void> {
  await safeAction(async () => {
    const menu = await loadMenuById(menuId);
    const { supabase } = await requireRestaurantAccess(menu.restaurant_id, "manager");

    const id = String(formData.get("id") ?? "").trim() || undefined;
    const name = String(formData.get("name") ?? "").trim();
    if (!name) throw new ValidationError("Category name is required.");

    const { error } = await supabase
      .from("categories")
      .upsert({ id, menu_id: menuId, name })
      .select()
      .single();

    if (error) {
      console.error("upsertCategory error:", error);
      throw new ValidationError("Failed to save category.");
    }

    revalidatePath(`/restaurants/${menu.restaurant_id}/menus/${menuId}`);
    return { saved: true };
  });
}

export async function updateCategoryName(categoryId: string, name: string) {
  return safeAction(async () => {
    if (!name.trim()) throw new ValidationError("Category name is required.");

    const { supabase, restaurantId, menuId } = await requireCategoryAccess(categoryId, "manager");

    const { error } = await supabase
      .from("categories")
      .update({ name: name.trim() })
      .eq("id", categoryId);

    if (error) throw new ValidationError("Failed to update category.");

    revalidatePath(`/restaurants/${restaurantId}/menus/${menuId}`);
    return { updated: true };
  });
}

export async function deleteCategory(categoryId: string) {
  return safeAction(async () => {
    const { supabase, restaurantId, menuId } = await requireCategoryAccess(categoryId, "manager");

    const { error } = await supabase.from("categories").delete().eq("id", categoryId);
    if (error) {
      console.error("deleteCategory error:", error);
      throw new ValidationError("Failed to delete category.");
    }

    await writeAudit({
      action: "category.delete",
      target_table: "categories",
      target_id: categoryId,
    });

    revalidatePath(`/restaurants/${restaurantId}/menus/${menuId}`);
    return { deleted: true };
  });
}

export async function upsertItem(menuId: string, formData: FormData) {
  return safeAction(async () => {
    const menu = await loadMenuById(menuId);
    const { supabase } = await requireRestaurantAccess(menu.restaurant_id, "manager");

    const id = String(formData.get("id") ?? "").trim() || undefined;
    const name = String(formData.get("name") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim() || null;
    const priceCents = Math.round(parseFloat(String(formData.get("price") ?? "0")) * 100);
    const categoryId = String(formData.get("categoryId") ?? "").trim();
    const imageUrls = safeJsonParse<string[]>(
      String(formData.get("image_urls") ?? ""),
      []
    ).filter((u) => typeof u === "string" && u.trim());
    // Keep image_url in sync with the first image for backwards compatibility.
    const imageUrl =
      imageUrls[0] ?? (String(formData.get("image_url") ?? "").trim() || null);

    if (!name) throw new ValidationError("Item name is required.");
    if (!categoryId) throw new ValidationError("Category is required.");
    if (priceCents < 0) throw new ValidationError("Price must be non-negative.");

    const allergens = safeJsonParse<string[]>(String(formData.get("allergens") ?? ""), []);
    const labels = safeJsonParse<string[]>(String(formData.get("labels") ?? ""), []);
    const preparations = safeJsonParse<{ name: string; price_cents?: number }[]>(
      String(formData.get("preparations") ?? ""),
      []
    );
    const variations = safeJsonParse<{ name: string; price_cents?: number }[]>(
      String(formData.get("variations") ?? ""),
      []
    );
    const sides = safeJsonParse<{ name: string; price_cents?: number }[]>(
      String(formData.get("sides") ?? ""),
      []
    );
    const sauces = safeJsonParse<{ name: string; price_cents?: number }[]>(
      String(formData.get("sauces") ?? ""),
      []
    );
    const { error } = await supabase
      .from("menu_items")
      .upsert({
        id,
        menu_id: menuId,
        category_id: categoryId,
        name,
        description,
        price_cents: priceCents,
        image_url: imageUrl,
        image_urls: imageUrls,
        allergens,
        labels,
        preparations,
        variations,
        sides,
        sauces,
      })
      .select()
      .single();

    if (error) {
      console.error("upsertItem error:", error);
      throw new ValidationError("Failed to save item.");
    }

    await writeAudit({
      action: "item.upsert",
      target_table: "menu_items",
      diff: { name, price_cents: priceCents, category_id: categoryId },
    });

    revalidatePath(`/restaurants/${menu.restaurant_id}/menus/${menuId}`);
    return { saved: true };
  });
}

export async function deleteItem(itemId: string) {
  return safeAction(async () => {
    const { supabase, restaurantId, menuId } = await requireItemAccess(itemId, "manager");

    const { error } = await supabase.from("menu_items").delete().eq("id", itemId);
    if (error) throw new ValidationError("Failed to delete item.");

    revalidatePath(`/restaurants/${restaurantId}/menus/${menuId}`);
    return { deleted: true };
  });
}

export async function reorderCategories(menuId: string, orderedIds: string[]) {
  return safeAction(async () => {
    const menu = await loadMenuById(menuId);
    const { supabase } = await requireRestaurantAccess(menu.restaurant_id, "manager");

    await supabase.rpc("reorder_categories", {
      p_menu_id: menuId,
      p_ids: orderedIds,
    });

    revalidatePath(`/restaurants/${menu.restaurant_id}/menus/${menuId}`);
    return { reordered: true };
  });
}

export async function reorderItems(menuId: string, categoryId: string, orderedIds: string[]) {
  return safeAction(async () => {
    const menu = await loadMenuById(menuId);
    const { supabase } = await requireRestaurantAccess(menu.restaurant_id, "manager");

    await supabase.rpc("reorder_items", {
      p_menu_id: menuId,
      p_category_id: categoryId,
      p_ids: orderedIds,
    });

    revalidatePath(`/restaurants/${menu.restaurant_id}/menus/${menuId}`);
    return { reordered: true };
  });
}

export async function updateMenuStatus(menuId: string, status: "draft" | "published" | "archived"): Promise<void> {
  await safeAction(async () => {
    const menu = await loadMenuById(menuId);
    const { supabase } = await requireRestaurantAccess(menu.restaurant_id, "manager");

    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("slug")
      .eq("id", menu.restaurant_id)
      .maybeSingle();

    const restaurantSlug = restaurant?.slug ?? "";

    let qrUrl = menu.qr_url;
    let qrAssigned = menu.qr_assigned;

    if (status === "published" && !menu.qr_assigned) {
      const { qrUrl: generated } = await generateAndStoreMenuQr(menu, restaurantSlug);
      qrUrl = generated;
      qrAssigned = true;
    }

    const { error } = await supabase
      .from("menus")
      .update({ status, qr_url: qrUrl, qr_assigned: qrAssigned, updated_at: new Date().toISOString() })
      .eq("id", menuId);

    if (error) throw new ValidationError("Failed to update menu status.");

    revalidatePath(`/restaurants/${menu.restaurant_id}/menus/${menuId}`);
    revalidatePath(`/m/${restaurantSlug}`);
    if (menu.slug) revalidatePath(`/m/${restaurantSlug}/${menu.slug}`);
    return { status };
  });
}

export async function regenerateQr(menuId: string) {
  return safeAction(async () => {
    const menu = await loadMenuById(menuId);
    const { supabase } = await requireRestaurantAccess(menu.restaurant_id, "manager");

    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("slug")
      .eq("id", menu.restaurant_id)
      .maybeSingle();

    const restaurantSlug = restaurant?.slug ?? "";
    const { qrUrl } = await generateAndStoreMenuQr(menu, restaurantSlug);

    const { error } = await supabase
      .from("menus")
      .update({ qr_url: qrUrl, qr_assigned: true, updated_at: new Date().toISOString() })
      .eq("id", menuId);

    if (error) throw new ValidationError("Failed to update menu QR.");

    revalidatePath(`/restaurants/${menu.restaurant_id}/menus/${menuId}`);
    revalidatePath(`/restaurants/${menu.restaurant_id}/qr`);
    revalidatePath(`/m/${restaurantSlug}`);
    if (menu.slug) revalidatePath(`/m/${restaurantSlug}/${menu.slug}`);
    return { qrUrl };
  });
}
