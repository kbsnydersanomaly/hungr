"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { requireRestaurantAccess } from "@/lib/auth/role";
import { safeAction, ValidationError } from "@/lib/errors";

const NAME_CONFLICT_MESSAGE =
  "Another restaurant in your organization already has this name.";

function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === "23505";
}

export async function updateRestaurantSettings(restaurantId: string, formData: FormData): Promise<void> {
  await safeAction(async () => {
    await requireRestaurantAccess(restaurantId, "manager");

    const name = formData.get("name")?.toString().trim();
    const street = formData.get("street")?.toString().trim() ?? "";
    const city = formData.get("city")?.toString().trim() ?? "";
    const province = formData.get("province")?.toString().trim() ?? "";
    const zip = formData.get("zip")?.toString().trim() ?? "";
    const tableCount = parseInt(formData.get("table_count")?.toString() ?? "0", 10);

    if (!name || name.length < 1) {
      throw new ValidationError("Restaurant name is required.");
    }

    const supabase = await createServerClient();
    const { error } = await supabase
      .from("restaurants")
      .update({
        name,
        street: street || null,
        city: city || null,
        province: province || null,
        zip: zip || null,
        table_count: isNaN(tableCount) ? 0 : Math.max(0, tableCount),
        updated_at: new Date().toISOString(),
      })
      .eq("id", restaurantId);

    if (error) {
      if (isUniqueViolation(error)) {
        throw new ValidationError(NAME_CONFLICT_MESSAGE);
      }
      throw new Error(error.message);
    }

    revalidatePath(`/restaurants/${restaurantId}/settings`);
    revalidatePath(`/restaurants/${restaurantId}`);
    return { name };
  });
}

export async function renameRestaurant(restaurantId: string, name: string) {
  return safeAction(async () => {
    await requireRestaurantAccess(restaurantId, "manager");

    const trimmed = name.trim();
    if (!trimmed) throw new ValidationError("Restaurant name is required.");

    const supabase = await createServerClient();
    const { error } = await supabase
      .from("restaurants")
      .update({ name: trimmed, updated_at: new Date().toISOString() })
      .eq("id", restaurantId);

    if (error) {
      if (isUniqueViolation(error)) {
        throw new ValidationError(NAME_CONFLICT_MESSAGE);
      }
      throw new Error(error.message);
    }

    revalidatePath("/", "layout");
    return { name: trimmed };
  });
}
