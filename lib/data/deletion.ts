import { actionError } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Removes the storage objects backing the given media rows. FK cascades
 * (media.org_id / media.owner_user_id `on delete cascade`) clean up the DB
 * rows when an org or user is deleted, but those cascades never touch Supabase
 * storage — without this the underlying files are orphaned. Best-effort: a
 * storage failure is logged but does not abort the surrounding deletion.
 */
export async function purgeMediaStorage(
  media: { bucket: string; path: string }[] | null | undefined
) {
  if (!media || media.length === 0) return;

  const byBucket = new Map<string, string[]>();
  for (const { bucket, path } of media) {
    const paths = byBucket.get(bucket) ?? [];
    paths.push(path);
    byBucket.set(bucket, paths);
  }

  const admin = createAdminClient();
  for (const [bucket, paths] of byBucket) {
    const { error } = await admin.storage.from(bucket).remove(paths);
    if (error) {
      console.error(`purgeMediaStorage error on bucket ${bucket}:`, error);
    }
  }
}

/**
 * Deletes an organization and its dependent rows with the given (admin)
 * client, bypassing RLS. Callers are responsible for authorization. Used by
 * the super-admin panel and by self-service account deletion.
 */
export async function deleteOrganizationUnsafe(
  supabase: AdminClient,
  orgId: string
) {
  // Remove the storage files behind this org's media before the FK cascade
  // drops the rows (the cascade only deletes rows, not storage objects).
  const { data: orgMedia } = await supabase
    .from("media")
    .select("bucket, path")
    .eq("org_id", orgId);
  await purgeMediaStorage(orgMedia);

  // Delete dependent data in FK-safe order.
  // Adjust order based on actual schema constraints.
  const tables = [
    "transactions",
    "invoices",
    "subscriptions",
    "restaurants",
    "organization_members",
  ] as const;

  for (const table of tables) {
    const { error } = await supabase.from(table).delete().eq("org_id", orgId);
    if (error) {
      console.error(`deleteOrganization cascade error on ${table}:`, error);
      throw actionError(`Failed to delete related ${table}`, error);
    }
  }

  const { error } = await supabase.from("organizations").delete().eq("id", orgId);
  if (error) {
    console.error("deleteOrganization error:", error);
    throw actionError("Failed to delete organization", error);
  }

  return { deleted: true };
}
