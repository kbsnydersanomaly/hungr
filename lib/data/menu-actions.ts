"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ValidationError, actionError, safeAction } from "@/lib/errors";
import { RenameMenuSchema } from "@/lib/schemas/menu";
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
import { createAdminClient } from "@/lib/supabase/admin";
import {
  validateRows,
  resolvePairings,
  type BulkUploadPayload,
  type BulkUploadSummary,
  type ParsedRow,
  type PairingRow,
} from "@/lib/menu/bulk-upload";

export async function createMenu(restaurantId: string, formData: FormData) {
  return safeAction(async () => {
    const { supabase } = await requireRestaurantAccess(restaurantId, "manager");

    const name = String(formData.get("name") ?? "").trim();
    if (!name) throw new ValidationError("Menu name is required.");
    // Same cap as RenameMenuSchema so a menu can always be renamed to its
    // current name.
    if (name.length > 80) throw new ValidationError("Menu name must be 80 characters or fewer.");

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
      throw actionError("Failed to create menu", error);
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

export async function upsertCategory(menuId: string, formData: FormData) {
  return safeAction(async () => {
    const menu = await loadMenuById(menuId);
    const { supabase } = await requireRestaurantAccess(menu.restaurant_id, "manager");

    const id = String(formData.get("id") ?? "").trim() || undefined;
    const name = String(formData.get("name") ?? "").trim();
    const parentId = String(formData.get("parent_id") ?? "").trim() || null;
    if (!name) throw new ValidationError("Category name is required.");

    // Enforce a single level of nesting: a sub-category's parent must itself be
    // a top-level category (parent_id is null) within this menu.
    if (parentId) {
      const { data: parent, error: parentError } = await supabase
        .from("categories")
        .select("id, parent_id, menu_id")
        .eq("id", parentId)
        .maybeSingle();
      if (parentError || !parent) throw new ValidationError("Parent category not found.");
      if (parent.menu_id !== menuId) throw new ValidationError("Parent category not found.");
      if (parent.parent_id !== null) {
        throw new ValidationError("Sub-categories can only be added to top-level categories.");
      }
    }

    const { error } = await supabase
      .from("categories")
      .upsert({ id, menu_id: menuId, name, parent_id: parentId })
      .select()
      .single();

    if (error) {
      console.error("upsertCategory error:", error);
      throw actionError("Failed to save category", error);
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

    if (error) throw actionError("Failed to update category", error);

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
      throw actionError("Failed to delete category", error);
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
    // Pairings: ids of other items in this menu that go well with this one.
    // Dedupe and never let an item pair with itself.
    const pairingIds = [
      ...new Set(
        safeJsonParse<string[]>(String(formData.get("pairing_ids") ?? ""), []).filter(
          (pid) => typeof pid === "string" && pid && pid !== id
        )
      ),
    ];
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
        pairing_ids: pairingIds,
      })
      .select()
      .single();

    if (error) {
      console.error("upsertItem error:", error);
      throw actionError("Failed to save item", error);
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
    if (error) throw actionError("Failed to delete item", error);

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

export async function updateMenuStatus(menuId: string, status: "draft" | "published" | "archived") {
  return safeAction(async () => {
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

    if (error) throw actionError("Failed to update menu status", error);

    revalidatePath(`/restaurants/${menu.restaurant_id}/menus/${menuId}`);
    revalidatePath(`/m/${restaurantSlug}`);
    if (menu.slug) revalidatePath(`/m/${restaurantSlug}/${menu.slug}`);
    return { status };
  });
}

export async function renameMenu(menuId: string, name: string) {
  return safeAction(async () => {
    const menu = await loadMenuById(menuId);
    const { supabase } = await requireRestaurantAccess(menu.restaurant_id, "manager");

    const parsed = RenameMenuSchema.safeParse({ name });
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid menu name.");
    }

    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("slug")
      .eq("id", menu.restaurant_id)
      .maybeSingle();

    const restaurantSlug = restaurant?.slug ?? "";

    // Only the display name changes here — the slug is intentionally left
    // untouched. The slug appears in public URLs (/m/[restaurantSlug]/[menuSlug])
    // and in printed QR codes, so renaming a menu must never break those links.
    const { error } = await supabase
      .from("menus")
      .update({ name: parsed.data.name, updated_at: new Date().toISOString() })
      .eq("id", menuId);

    if (error) throw actionError("Failed to rename menu", error);

    await writeAudit({
      action: "menu.rename",
      target_table: "menus",
      target_id: menuId,
      diff: { previous_name: menu.name, name: parsed.data.name },
    });

    revalidatePath(`/restaurants/${menu.restaurant_id}/menus`);
    revalidatePath(`/restaurants/${menu.restaurant_id}/menus/${menuId}`);
    if (restaurantSlug) {
      revalidatePath(`/m/${restaurantSlug}`);
      if (menu.slug) revalidatePath(`/m/${restaurantSlug}/${menu.slug}`);
    }
    return { name: parsed.data.name };
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

    if (error) throw actionError("Failed to update menu QR", error);

    revalidatePath(`/restaurants/${menu.restaurant_id}/menus/${menuId}`);
    revalidatePath(`/restaurants/${menu.restaurant_id}/qr`);
    revalidatePath(`/m/${restaurantSlug}`);
    if (menu.slug) revalidatePath(`/m/${restaurantSlug}/${menu.slug}`);
    return { qrUrl };
  });
}

export async function bulkUpsertItems(menuId: string, payload: BulkUploadPayload) {
  return safeAction(async () => {
    const menu = await loadMenuById(menuId);
    const { supabase } = await requireRestaurantAccess(menu.restaurant_id, "manager");

    const mode = payload.mode;
    // Re-validate server-side — never trust the client's parsed rows.
    const { valid, errors } = validateRows(payload.rows ?? []);

    const summary: BulkUploadSummary = {
      added: 0,
      updated: 0,
      skipped: 0,
      failed: errors.length,
      categoriesCreated: 0,
      errors,
      warnings: [],
    };

    if (valid.length === 0) return summary;

    // Build a case-insensitive category name -> id map for this menu.
    const { data: existingCategories, error: catLoadError } = await supabase
      .from("categories")
      .select("id, name")
      .eq("menu_id", menuId);
    if (catLoadError) throw actionError("Failed to load categories", catLoadError);

    const categoryMap = new Map<string, string>();
    for (const cat of existingCategories ?? []) {
      categoryMap.set(cat.name.trim().toLowerCase(), cat.id);
    }

    // Auto-create any categories referenced in the file that don't exist yet.
    const missing = new Map<string, string>(); // lowercased -> original casing
    for (const row of valid) {
      const key = row.category.toLowerCase();
      if (!categoryMap.has(key) && !missing.has(key)) missing.set(key, row.category);
    }
    if (missing.size > 0) {
      const { data: created, error: createError } = await supabase
        .from("categories")
        .insert([...missing.values()].map((name) => ({ menu_id: menuId, name })))
        .select("id, name");
      if (createError) throw actionError("Failed to create categories", createError);
      for (const cat of created ?? []) {
        categoryMap.set(cat.name.trim().toLowerCase(), cat.id);
      }
      summary.categoriesCreated = created?.length ?? 0;
    }

    const toItemRow = (row: ParsedRow, categoryId: string) => ({
      menu_id: menuId,
      category_id: categoryId,
      name: row.name,
      description: row.description,
      price_cents: row.price_cents,
      image_url: row.image_url,
      image_urls: row.image_url ? [row.image_url] : [],
      allergens: row.allergens,
      labels: row.labels,
      preparations: row.preparations,
      variations: row.variations,
      sides: row.sides,
      sauces: row.sauces,
    });

    const resolved = valid.map((row) => ({
      row,
      categoryId: categoryMap.get(row.category.toLowerCase())!,
    }));

    // Rows whose pairings should be applied: written rows, plus items that
    // already existed in add mode (explicit CSV intent wins for those).
    const pairingRows: PairingRow[] = [];

    if (mode === "replace") {
      // Every existing item is deleted first, so any `id` column in the file
      // no longer points at anything — replace mode ignores it and inserts.
      const { error: deleteError } = await supabase
        .from("menu_items")
        .delete()
        .eq("menu_id", menuId);
      if (deleteError) throw actionError("Failed to clear existing items", deleteError);

      const inserts = resolved.map(({ row, categoryId }) => toItemRow(row, categoryId));
      const { error: insertError } = await supabase.from("menu_items").insert(inserts);
      if (insertError) throw actionError("Failed to insert items", insertError);
      summary.added = inserts.length;
      pairingRows.push(
        ...resolved.map(({ row }) => ({
          fileRow: row.fileRow,
          name: row.name,
          pairings: row.pairings,
        }))
      );
    } else {
      // add / modify: match existing items by name within their category.
      const { data: existingItems, error: itemLoadError } = await supabase
        .from("menu_items")
        .select("id, name, category_id")
        .eq("menu_id", menuId);
      if (itemLoadError) throw actionError("Failed to load existing items", itemLoadError);

      const itemKey = (categoryId: string, name: string) =>
        `${categoryId}::${name.trim().toLowerCase()}`;
      const itemMap = new Map<string, string>();
      const existingIds = new Set<string>();
      for (const item of existingItems ?? []) {
        itemMap.set(itemKey(item.category_id, item.name), item.id);
        existingIds.add(item.id);
      }

      const inserts: ReturnType<typeof toItemRow>[] = [];
      const updates: { id: string; data: ReturnType<typeof toItemRow> }[] = [];

      for (const { row, categoryId } of resolved) {
        if (row.id) {
          // Round-trip path: a row exported from this menu carries the item's
          // UUID. An explicit id always targets that exact row and takes
          // precedence over name matching, in every upload mode — so renamed
          // items update in place instead of duplicating.
          if (!existingIds.has(row.id)) {
            summary.errors.push({
              row: row.fileRow,
              field: "id",
              reason: "No item with this id exists on this menu.",
            });
            summary.failed++;
            continue;
          }
          updates.push({ id: row.id, data: toItemRow(row, categoryId) });
          pairingRows.push({
            fileRow: row.fileRow,
            name: row.name,
            pairings: row.pairings,
          });
          continue;
        }
        const existingId = itemMap.get(itemKey(categoryId, row.name));
        if (mode === "add") {
          if (existingId) {
            // Item already exists: skip the write, but still apply its
            // declared pairings — the name->id map covers existing items.
            summary.skipped++;
          } else {
            inserts.push(toItemRow(row, categoryId));
          }
        } else {
          if (!existingId) {
            // Item isn't on the menu — nothing to pair; skip entirely.
            summary.skipped++;
            continue;
          }
          updates.push({ id: existingId, data: toItemRow(row, categoryId) });
        }
        pairingRows.push({
          fileRow: row.fileRow,
          name: row.name,
          pairings: row.pairings,
        });
      }

      if (inserts.length > 0) {
        const { error: insertError } = await supabase.from("menu_items").insert(inserts);
        if (insertError) throw actionError("Failed to insert items", insertError);
        summary.added = inserts.length;
      }
      for (const { id, data } of updates) {
        const { error: updateError } = await supabase
          .from("menu_items")
          .update(data)
          .eq("id", id);
        if (updateError) throw actionError("Failed to update item", updateError);
        summary.updated++;
      }
    }

    // Second pass: pairings reference other items by name, so they can only be
    // resolved once every row exists on the menu. Unresolvable names become
    // warnings in the summary rather than failing the upload.
    if (pairingRows.some((row) => row.pairings.length > 0)) {
      const { data: allItems, error: pairingLoadError } = await supabase
        .from("menu_items")
        .select("id, name")
        .eq("menu_id", menuId);
      if (pairingLoadError) throw actionError("Failed to load items for pairings", pairingLoadError);

      const nameToId = new Map<string, string>();
      for (const item of allItems ?? []) {
        nameToId.set(item.name.trim().toLowerCase(), item.id);
      }

      const { updates: pairingUpdates, warnings } = resolvePairings(pairingRows, nameToId);
      summary.warnings.push(...warnings);
      for (const { id, pairing_ids, fileRow } of pairingUpdates) {
        const { error: pairingError } = await supabase
          .from("menu_items")
          .update({ pairing_ids })
          .eq("id", id);
        // The items themselves were saved — degrade pairing-write failures to
        // warnings so the summary (and the upload's success) is preserved.
        if (pairingError) {
          console.error("bulkUpsertItems pairing update error:", pairingError);
          summary.warnings.push({
            row: fileRow,
            field: "pairings",
            reason: "Failed to save pairings for this item — its other changes were saved.",
          });
        }
      }
    }

    await writeAudit({
      action: "item.bulk_upsert",
      target_table: "menu_items",
      target_id: menuId,
      diff: {
        mode,
        added: summary.added,
        updated: summary.updated,
        skipped: summary.skipped,
        categoriesCreated: summary.categoriesCreated,
      },
    });

    revalidatePath(`/restaurants/${menu.restaurant_id}/menus/${menuId}`);
    return summary;
  });
}

export async function deleteMenu(menuId: string) {
  return safeAction(async () => {
    const menu = await loadMenuById(menuId);
    const { supabase } = await requireRestaurantAccess(menu.restaurant_id, "manager");

    if (menu.is_default) {
      const { error: defaultError } = await supabase
        .from("restaurants")
        .update({ default_menu_id: null })
        .eq("id", menu.restaurant_id)
        .eq("default_menu_id", menu.id);

      if (defaultError) {
        console.error("deleteMenu clear default_menu_id error:", defaultError);
        throw actionError("Failed to clear default menu reference", defaultError);
      }
    }

    try {
      const adminClient = createAdminClient();
      const qrPath = `${menu.restaurant_id}/${menu.id}.png`;
      const { error: storageError } = await adminClient.storage
        .from("menu-media")
        .remove([qrPath]);

      if (storageError) {
        console.error("deleteMenu QR cleanup error:", storageError);
      }
    } catch (err) {
      console.error("deleteMenu QR cleanup exception:", err);
    }

    const { error } = await supabase.from("menus").delete().eq("id", menuId);
    if (error) {
      console.error("deleteMenu error:", error);
      throw actionError("Failed to delete menu", error);
    }

    await writeAudit({
      action: "menu.delete",
      target_table: "menus",
      target_id: menuId,
      diff: { name: menu.name, slug: menu.slug },
    });

    const { data: restaurant, error: restaurantError } = await supabase
      .from("restaurants")
      .select("slug")
      .eq("id", menu.restaurant_id)
      .maybeSingle();

    if (restaurantError) {
      console.error("deleteMenu load restaurant slug error:", restaurantError);
    }

    if (restaurant?.slug) {
      revalidatePath(`/m/${restaurant.slug}`);
      if (menu.slug) revalidatePath(`/m/${restaurant.slug}/${menu.slug}`);
    }

    revalidatePath(`/restaurants/${menu.restaurant_id}/menus`);
    return { deleted: true };
  });
}
