"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { NotFoundError, ValidationError, actionError, safeAction } from "@/lib/errors";
import { requireRestaurantAccess } from "@/lib/auth/role";
import { safeJsonParse } from "@/lib/utils/safeJsonParse";
import { trackMediaUsage, untrackMediaUsage } from "./media-actions";
import type { Database } from "@/lib/database.types";

type SpecialKind = "item_discount" | "category_discount" | "combo";
type DiscountType = "percentage" | "fixed";

type SpecialInsert = Database["public"]["Tables"]["specials"]["Insert"];

function parseSpecialForm(formData: FormData): Omit<SpecialInsert, "restaurant_id"> {
  const discountType = String(formData.get("discount_type") ?? "") as DiscountType | "";
  return {
    menu_id: String(formData.get("menu_id") ?? "").trim() || null,
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || null,
    kind: String(formData.get("kind") ?? "") as SpecialKind,
    discount_type: discountType || null,
    discount_amount_cents:
      parseInt(String(formData.get("discount_amount_cents") ?? "0"), 10) || null,
    discount_pct: parseFloat(String(formData.get("discount_pct") ?? "0")) || null,
    combo_price_cents:
      parseInt(String(formData.get("combo_price_cents") ?? "0"), 10) || null,
    date_from: String(formData.get("date_from") ?? "").trim() || null,
    date_to: String(formData.get("date_to") ?? "").trim() || null,
    time_from: String(formData.get("time_from") ?? "").trim() || null,
    time_to: String(formData.get("time_to") ?? "").trim() || null,
    selected_days: safeJsonParse<string[]>(String(formData.get("selected_days") ?? ""), []),
    priority: parseInt(String(formData.get("priority") ?? "0"), 10) || 0,
    active: String(formData.get("active") ?? "") === "on",
    image_url: String(formData.get("image_url") ?? "").trim() || null,
    media_id: String(formData.get("media_id") ?? "").trim() || null,
  };
}

async function loadSpecialRestaurantId(specialId: string): Promise<string> {
  const supabase = await createServerClient();
  const { data: special } = await supabase
    .from("specials")
    .select("restaurant_id")
    .eq("id", specialId)
    .maybeSingle();

  if (!special) throw new NotFoundError("Special not found");
  return special.restaurant_id;
}

export async function listSpecialsForRestaurant(restaurantId: string) {
  const { supabase } = await requireRestaurantAccess(restaurantId, "staff");

  const { data, error } = await supabase
    .from("specials")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("priority", { ascending: false });

  if (error) {
    console.error("listSpecialsForRestaurant error:", error);
    throw actionError("Failed to load specials", error);
  }

  return data ?? [];
}

export async function createSpecial(restaurantId: string, formData: FormData) {
  return safeAction(async () => {
    const { supabase } = await requireRestaurantAccess(restaurantId, "manager");
    const fields = parseSpecialForm(formData);

    if (!fields.title) throw new ValidationError("Title is required.");
    if (!fields.kind) throw new ValidationError("Kind is required.");

    const { data: created, error } = await supabase
      .from("specials")
      .insert({ ...fields, restaurant_id: restaurantId })
      .select()
      .single();

    if (error || !created) {
      console.error("createSpecial error:", error);
      throw actionError("Failed to create special", error);
    }

    if (fields.media_id) {
      try {
        await trackMediaUsage(fields.media_id, "specials", created.id);
      } catch (err) {
        console.error("trackMediaUsage error:", err);
      }
    }

    revalidatePath(`/restaurants/${restaurantId}/specials`);
    return { created: true, id: created.id };
  });
}

export async function updateSpecial(specialId: string, formData: FormData) {
  return safeAction(async () => {
    const restaurantId = await loadSpecialRestaurantId(specialId);
    const { supabase } = await requireRestaurantAccess(restaurantId, "manager");

    const fields = parseSpecialForm(formData);
    if (!fields.title) throw new ValidationError("Title is required.");

    const { data: existing } = await supabase
      .from("specials")
      .select("media_id")
      .eq("id", specialId)
      .maybeSingle();

    const { error } = await supabase
      .from("specials")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", specialId);

    if (error) {
      console.error("updateSpecial error:", error);
      throw actionError("Failed to update special", error);
    }

    if (existing?.media_id && existing.media_id !== fields.media_id) {
      try {
        await untrackMediaUsage(existing.media_id, "specials", specialId);
      } catch (err) {
        console.error("untrackMediaUsage error:", err);
      }
    }
    if (fields.media_id && fields.media_id !== existing?.media_id) {
      try {
        await trackMediaUsage(fields.media_id, "specials", specialId);
      } catch (err) {
        console.error("trackMediaUsage error:", err);
      }
    }

    revalidatePath(`/restaurants/${restaurantId}/specials`);
    return { updated: true };
  });
}

export async function setSpecialActive(specialId: string, active: boolean) {
  return safeAction(async () => {
    const restaurantId = await loadSpecialRestaurantId(specialId);
    const { supabase } = await requireRestaurantAccess(restaurantId, "manager");

    const { error } = await supabase
      .from("specials")
      .update({ active, updated_at: new Date().toISOString() })
      .eq("id", specialId);

    if (error) {
      console.error("setSpecialActive error:", error);
      throw actionError("Failed to update special", error);
    }

    revalidatePath(`/restaurants/${restaurantId}/specials`);
    return { updated: true };
  });
}

export async function deleteSpecial(specialId: string) {
  return safeAction(async () => {
    const restaurantId = await loadSpecialRestaurantId(specialId);
    const { supabase } = await requireRestaurantAccess(restaurantId, "manager");

    const { data: existing } = await supabase
      .from("specials")
      .select("media_id")
      .eq("id", specialId)
      .maybeSingle();

    const { error } = await supabase.from("specials").delete().eq("id", specialId);

    if (error) {
      console.error("deleteSpecial error:", error);
      throw actionError("Failed to delete special", error);
    }

    if (existing?.media_id) {
      try {
        await untrackMediaUsage(existing.media_id, "specials", specialId);
      } catch (err) {
        console.error("untrackMediaUsage error:", err);
      }
    }

    revalidatePath(`/restaurants/${restaurantId}/specials`);
    return { deleted: true };
  });
}
