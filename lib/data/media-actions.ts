"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NotFoundError, ValidationError, actionError, safeAction } from "@/lib/errors";
import { requireRestaurantAccess } from "@/lib/auth/role";
import { formatBytes } from "@/lib/utils/bytes";

export async function listMediaForRestaurant(restaurantId: string) {
  const { supabase } = await requireRestaurantAccess(restaurantId, "manager");

  const { data, error } = await supabase
    .from("media")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("listMediaForRestaurant error:", error);
    throw actionError("Failed to load media", error);
  }

  return data ?? [];
}

/**
 * Returns the restaurant's media storage usage and limit, in bytes. Usage is the
 * sum of `media.size` for the restaurant; the limit comes from the per-restaurant
 * `storage_limit_mb` quota (editable by super admins).
 */
export async function getRestaurantStorageUsage(
  restaurantId: string
): Promise<{ usedBytes: number; limitBytes: number }> {
  const { supabase } = await requireRestaurantAccess(restaurantId, "manager");

  const [{ data: rows, error: mediaError }, { data: restaurant, error: restaurantError }] =
    await Promise.all([
      supabase.from("media").select("size").eq("restaurant_id", restaurantId),
      supabase
        .from("restaurants")
        .select("storage_limit_mb")
        .eq("id", restaurantId)
        .maybeSingle(),
    ]);

  if (mediaError || restaurantError) {
    console.error("getRestaurantStorageUsage error:", mediaError ?? restaurantError);
    throw actionError("Failed to load storage usage", mediaError ?? restaurantError);
  }

  const usedBytes = (rows ?? []).reduce((sum, row) => sum + (row.size ?? 0), 0);
  const limitBytes = (restaurant?.storage_limit_mb ?? 500) * 1024 * 1024;

  return { usedBytes, limitBytes };
}

/**
 * Returns a display name that is unique among the restaurant's existing media.
 * The stored file path is already collision-free (it uses a random UUID), so an
 * upload never overwrites another in storage — but a duplicate `name` makes it
 * look like the original was replaced. When a name is already taken we prepend
 * an incrementing prefix (e.g. "photo.png" -> "1-photo.png") so both files
 * remain distinguishable in the library. Pass `excludeMediaId` when renaming
 * so the item being renamed does not count as taking its own current name
 * (renaming "logo.png" to "logo.png" stays "logo.png", not "1-logo.png").
 */
async function uniqueMediaName(
  supabase: Awaited<ReturnType<typeof requireRestaurantAccess>>["supabase"],
  restaurantId: string,
  name: string,
  excludeMediaId?: string
): Promise<string> {
  const { data: existing } = await supabase
    .from("media")
    .select("id, name")
    .eq("restaurant_id", restaurantId);

  const taken = new Set(
    (existing ?? []).filter((m) => m.id !== excludeMediaId).map((m) => m.name)
  );
  if (!taken.has(name)) return name;

  let n = 1;
  let candidate = `${n}-${name}`;
  while (taken.has(candidate)) {
    n += 1;
    candidate = `${n}-${name}`;
  }
  return candidate;
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
      .select("org_id, storage_limit_mb")
      .eq("id", restaurantId)
      .maybeSingle();

    const orgId = restaurant?.org_id ?? null;

    // Enforce the per-restaurant storage quota. The file is already in storage at
    // this point (the client uploads first, then records), so if it would exceed
    // the limit we remove the just-uploaded object to avoid leaving an orphan.
    const limitBytes = (restaurant?.storage_limit_mb ?? 500) * 1024 * 1024;
    const { data: existing } = await supabase
      .from("media")
      .select("size")
      .eq("restaurant_id", restaurantId);
    const usedBytes = (existing ?? []).reduce((sum, row) => sum + (row.size ?? 0), 0);

    if (usedBytes + size > limitBytes) {
      const remaining = Math.max(limitBytes - usedBytes, 0);
      const adminClient = createAdminClient();
      await adminClient.storage.from(bucket).remove([path]);
      throw new ValidationError(
        `Not enough storage. This file is ${formatBytes(size)} but only ${formatBytes(
          remaining
        )} of ${formatBytes(limitBytes)} remains.`
      );
    }

    const displayName = await uniqueMediaName(
      supabase,
      restaurantId,
      name || path.split("/").pop() || "untitled"
    );

    const { data: inserted, error } = await supabase
      .from("media")
      .insert({
        owner_user_id: user.id,
        org_id: orgId,
        restaurant_id: restaurantId,
        bucket,
        path,
        url,
        name: displayName,
        mime,
        size,
      })
      .select("id, url, name, mime, size, created_at")
      .single();

    if (error) {
      console.error("recordMediaUpload error:", error);
      throw actionError("Failed to record upload", error);
    }

    revalidatePath(`/restaurants/${restaurantId}/media`);
    return { media: inserted };
  });
}

export async function renameMedia(mediaId: string, name: string) {
  return safeAction(async () => {
    const supabase = await createServerClient();

    const { data: media, error: mediaError } = await supabase
      .from("media")
      .select("id, restaurant_id")
      .eq("id", mediaId)
      .maybeSingle();

    if (mediaError || !media) throw new NotFoundError("Media not found");

    const { supabase: authed } = await requireRestaurantAccess(
      media.restaurant_id ?? "",
      "manager"
    );

    const trimmed = name.trim();
    if (!trimmed) throw new ValidationError("Media name is required.");
    if (trimmed.length > 120) {
      throw new ValidationError("Media name must be 120 characters or fewer.");
    }

    const finalName = await uniqueMediaName(
      authed,
      media.restaurant_id ?? "",
      trimmed,
      mediaId
    );

    // Only the display `name` column is updated. The storage object key
    // (`path`) and `url` are intentionally left untouched — `name` is purely
    // a display name, so renaming must never break the file or any existing
    // references to its URL.
    const { error } = await authed
      .from("media")
      .update({ name: finalName })
      .eq("id", mediaId);

    if (error) {
      console.error("renameMedia error:", error);
      throw actionError("Failed to rename media", error);
    }

    if (media.restaurant_id) {
      revalidatePath(`/restaurants/${media.restaurant_id}/media`);
    }
    // Return the final (possibly deduped) name so the UI shows what saved.
    return { name: finalName };
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
      throw actionError("Failed to delete media", error);
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
      throw actionError("Failed to track media usage", error);
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
      throw actionError("Failed to untrack media usage", error);
    }
    return { untracked: true };
  });
}
