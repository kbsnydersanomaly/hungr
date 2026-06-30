"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/auth/role";
import { safeAction, ValidationError, NotFoundError } from "@/lib/errors";
import type { Database } from "@/lib/database.types";

type HelpMediaRow = Database["public"]["Tables"]["help_media"]["Row"];

export type HelpMediaItem = Pick<
  HelpMediaRow,
  "id" | "url" | "name" | "mime" | "size" | "created_at"
>;

export async function listHelpMedia(): Promise<HelpMediaItem[]> {
  const { supabase } = await requireSuperAdmin();

  const { data, error } = await supabase
    .from("help_media")
    .select("id, url, name, mime, size, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("listHelpMedia error:", error);
    throw new ValidationError("Failed to load help media.");
  }

  return data ?? [];
}

export async function recordHelpMediaUpload(formData: FormData) {
  return safeAction(async () => {
    const { supabase, user } = await requireSuperAdmin();

    const bucket = String(formData.get("bucket") ?? "").trim();
    const path = String(formData.get("path") ?? "").trim();
    const url = String(formData.get("url") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    const mime = String(formData.get("mime") ?? "").trim();
    const size = parseInt(String(formData.get("size") ?? "0"), 10);

    if (!bucket || !path || !url) {
      throw new ValidationError("Missing upload metadata.");
    }

    const { data: inserted, error } = await supabase
      .from("help_media")
      .insert({
        owner_user_id: user.id,
        bucket,
        path,
        url,
        name: name || path.split("/").pop() || "untitled",
        mime,
        size: Number.isFinite(size) ? size : 0,
      })
      .select("id, url, name, mime, size, created_at")
      .single();

    if (error) {
      console.error("recordHelpMediaUpload error:", error);
      throw new ValidationError("Failed to record upload.");
    }

    revalidatePath("/admin/help/media");
    return { media: inserted };
  });
}

export async function deleteHelpMedia(mediaId: string) {
  return safeAction(async () => {
    const { supabase } = await requireSuperAdmin();

    const { data: media, error: mediaError } = await supabase
      .from("help_media")
      .select("bucket, path")
      .eq("id", mediaId)
      .maybeSingle();

    if (mediaError || !media) throw new NotFoundError("Media not found");

    const adminClient = createAdminClient();
    const { error: storageError } = await adminClient.storage
      .from(media.bucket)
      .remove([media.path]);

    if (storageError) {
      console.error("deleteHelpMedia storage error:", storageError);
    }

    const { error } = await supabase.from("help_media").delete().eq("id", mediaId);

    if (error) {
      console.error("deleteHelpMedia error:", error);
      throw new ValidationError("Failed to delete media.");
    }

    revalidatePath("/admin/help/media");
    return { deleted: true };
  });
}
