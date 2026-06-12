"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NotFoundError, ValidationError, safeAction } from "@/lib/errors";
import { requireRestaurantAccess } from "@/lib/auth/role";

export async function listMediaForRestaurant(restaurantId: string) {
  const { supabase } = await requireRestaurantAccess(restaurantId, "manager");

  const { data, error } = await supabase
    .from("media")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("listMediaForRestaurant error:", error);
    throw new ValidationError("Failed to load media.");
  }

  return data ?? [];
}

export async function recordMediaUpload(
  restaurantId: string,
  formData: FormData
) {
  return safeAction(async () => {
    const { supabase, user } = await requireRestaurantAccess(restaurantId, "manager");

    const bucket = String(formData.get("bucket") ?? "").trim();
    const path = String(formData.get("path") ?? "").trim();
    const url = String(formData.get("url") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    const mime = String(formData.get("mime") ?? "").trim();
    const size = parseInt(String(formData.get("size") ?? "0"), 10);

    if (!bucket || !path || !url) {
      throw new ValidationError("Missing upload metadata.");
    }

    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("org_id")
      .eq("id", restaurantId)
      .maybeSingle();

    const orgId = restaurant?.org_id ?? null;

    const { data: inserted, error } = await supabase
      .from("media")
      .insert({
        owner_user_id: user.id,
        org_id: orgId,
        restaurant_id: restaurantId,
        bucket,
        path,
        url,
        name: name || path.split("/").pop() || "untitled",
        mime,
        size,
      })
      .select("id, url, name, mime, size, created_at")
      .single();

    if (error) {
      console.error("recordMediaUpload error:", error);
      throw new ValidationError("Failed to record upload.");
    }

    revalidatePath(`/restaurants/${restaurantId}/media`);
    return { media: inserted };
  });
}

export async function deleteMedia(mediaId: string) {
  return safeAction(async () => {
    const supabase = await createServerClient();

    const { data: media, error: mediaError } = await supabase
      .from("media")
      .select("*")
      .eq("id", mediaId)
      .maybeSingle();

    if (mediaError || !media) throw new NotFoundError("Media not found");

    const { supabase: authed } = await requireRestaurantAccess(media.restaurant_id ?? "", "manager");

    const { data: usage } = await authed
      .from("media_usage")
      .select("*")
      .eq("media_id", mediaId);

    if (usage && usage.length > 0) {
      throw new ValidationError(
        `This media is currently in use (${usage.length} place${usage.length === 1 ? "" : "s"}). Remove it from items/branding first.`
      );
    }

    const adminClient = createAdminClient();
    const { error: storageError } = await adminClient.storage
      .from(media.bucket)
      .remove([media.path]);

    if (storageError) {
      console.error("deleteMedia storage error:", storageError);
    }

    const { error } = await authed.from("media").delete().eq("id", mediaId);

    if (error) {
      console.error("deleteMedia error:", error);
      throw new ValidationError("Failed to delete media.");
    }

    if (media.restaurant_id) {
      revalidatePath(`/restaurants/${media.restaurant_id}/media`);
    }
    return { deleted: true };
  });
}

export async function trackMediaUsage(
  mediaId: string,
  usedInTable: string,
  usedInId: string
) {
  return safeAction(async () => {
    const supabase = await createServerClient();

    const { data: media } = await supabase
      .from("media")
      .select("restaurant_id")
      .eq("id", mediaId)
      .maybeSingle();

    const { supabase: authed } = media?.restaurant_id
      ? await requireRestaurantAccess(media.restaurant_id, "manager")
      : { supabase };

    const { error } = await authed.from("media_usage").upsert(
      { media_id: mediaId, used_in_table: usedInTable, used_in_id: usedInId },
      { onConflict: "media_id,used_in_table,used_in_id" }
    );

    if (error) {
      console.error("trackMediaUsage error:", error);
      throw new ValidationError("Failed to track media usage.");
    }
    return { tracked: true };
  });
}

export async function untrackMediaUsage(
  mediaId: string,
  usedInTable: string,
  usedInId: string
) {
  return safeAction(async () => {
    const supabase = await createServerClient();

    const { data: media } = await supabase
      .from("media")
      .select("restaurant_id")
      .eq("id", mediaId)
      .maybeSingle();

    const { supabase: authed } = media?.restaurant_id
      ? await requireRestaurantAccess(media.restaurant_id, "manager")
      : { supabase };

    const { error } = await authed
      .from("media_usage")
      .delete()
      .eq("media_id", mediaId)
      .eq("used_in_table", usedInTable)
      .eq("used_in_id", usedInId);

    if (error) {
      console.error("untrackMediaUsage error:", error);
      throw new ValidationError("Failed to untrack media usage.");
    }
    return { untracked: true };
  });
}
