"use server";

import { revalidatePath } from "next/cache";
import { actionError, safeAction } from "@/lib/errors";
import { requireRestaurantAccess } from "@/lib/auth/role";
import { writeAudit } from "@/lib/utils/audit";
import { BrandingColorSchema } from "@/lib/schemas/branding";

const COLOR_FIELDS = [
  "primary_color",
  "secondary_color",
  "accent_color",
  "nav_bar_color",
  "background_color",
] as const;

// Colors are typed character-by-character and autosaved mid-keystroke, so we
// clean leniently: drop any field that doesn't validate (e.g. a half-typed
// hex) rather than rejecting the whole save and breaking autosave.
function cleanColor(value: unknown): string | null {
  const parsed = BrandingColorSchema.safeParse(value ?? null);
  return parsed.success ? (parsed.data ?? null) : null;
}

export async function saveDraftAction(
  restaurantId: string,
  draft: Record<string, unknown>
) {
  return safeAction(async () => {
    const { supabase } = await requireRestaurantAccess(restaurantId, "manager");

    const colors = Object.fromEntries(
      COLOR_FIELDS.map((field) => [field, cleanColor(draft[field])])
    );

    const { error } = await supabase
      .from("branding_drafts")
      .upsert({
        restaurant_id: restaurantId,
        ...colors,
        logo_media_id: (draft.logo_media_id as string | null) ?? null,
        logo_url: (draft.logo_url as string | null) ?? null,
        banner_image_urls: (draft.banner_image_urls as string[] | null) ?? [],
        primary_button: (draft.primary_button as Record<string, string> | null) ?? null,
        secondary_button: (draft.secondary_button as Record<string, string> | null) ?? null,
        main_heading: (draft.main_heading as Record<string, string> | null) ?? null,
        sub_heading: (draft.sub_heading as Record<string, string> | null) ?? null,
        body: (draft.body as Record<string, string> | null) ?? null,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error("saveDraftAction error:", error);
      throw actionError("Failed to save draft", error);
    }

    revalidatePath(`/restaurants/${restaurantId}/branding`);
    return { saved: true };
  });
}

export async function publishAction(restaurantId: string) {
  return safeAction(async () => {
    const { supabase } = await requireRestaurantAccess(restaurantId, "manager");

    const { error } = await supabase.rpc("publish_branding", {
      p_restaurant_id: restaurantId,
    });

    if (error) {
      console.error("publishAction error:", error);
      throw actionError("Failed to publish branding", error);
    }

    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("slug")
      .eq("id", restaurantId)
      .maybeSingle();

    await writeAudit({
      action: "branding.publish",
      target_table: "branding",
      target_id: restaurantId,
    });

    revalidatePath(`/restaurants/${restaurantId}/branding`);
    if (restaurant?.slug) revalidatePath(`/m/${restaurant.slug}`);
    return { published: true };
  });
}

export async function discardAction(restaurantId: string) {
  return safeAction(async () => {
    const { supabase } = await requireRestaurantAccess(restaurantId, "manager");

    const { data: live } = await supabase
      .from("branding")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .single();

    if (!live) {
      await supabase.from("branding_drafts").delete().eq("restaurant_id", restaurantId);
    } else {
      await supabase.from("branding_drafts").upsert({
        restaurant_id: restaurantId,
        primary_color: live.primary_color,
        secondary_color: live.secondary_color,
        accent_color: live.accent_color,
        nav_bar_color: live.nav_bar_color,
        background_color: live.background_color,
        logo_media_id: live.logo_media_id,
        logo_url: live.logo_url,
        banner_image_urls: live.banner_image_urls,
        primary_button: live.primary_button,
        secondary_button: live.secondary_button,
        main_heading: live.main_heading,
        sub_heading: live.sub_heading,
        body: live.body,
        updated_at: new Date().toISOString(),
      });
    }

    await writeAudit({
      action: "branding.discard",
      target_table: "branding_drafts",
      target_id: restaurantId,
    });

    revalidatePath(`/restaurants/${restaurantId}/branding`);
    return { discarded: true };
  });
}
