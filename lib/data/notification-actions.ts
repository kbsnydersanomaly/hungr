"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/session";
import { safeAction } from "@/lib/errors";

export interface NotificationPrefs {
  review_emails?: boolean;
  payment_emails?: boolean;
  team_emails?: boolean;
}

export async function getNotificationPrefs() {
  return safeAction(async () => {
    const { user } = await requireSession();
    const supabase = await createServerClient();
    const { data, error } = (await supabase
      .from("profiles")
      .select("notification_prefs")
      .eq("id", user.id)
      .single()) as { data: { notification_prefs: unknown } | null; error: Error | null };

    if (error) throw new Error(error.message);
    return (data?.notification_prefs ?? {}) as NotificationPrefs;
  });
}

export async function updateNotificationPrefs(formData: FormData) {
  return safeAction(async () => {
    const { user } = await requireSession();
    const supabase = await createServerClient();

    const prefs: NotificationPrefs = {
      review_emails: formData.get("review_emails") === "on",
      payment_emails: formData.get("payment_emails") === "on",
      team_emails: formData.get("team_emails") === "on",
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = (await (supabase.from("profiles") as any)
      .update({ notification_prefs: prefs })
      .eq("id", user.id)) as { error: Error | null };

    if (error) throw new Error(error.message);

    revalidatePath("/settings/notifications");
    return prefs;
  });
}

export async function getUnreadNotificationCount() {
  return safeAction(async () => {
    const { user } = await requireSession();
    const supabase = await createServerClient();
    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null);

    if (error) throw new Error(error.message);
    return count ?? 0;
  });
}

export async function listUnreadNotifications() {
  return safeAction(async () => {
    const { user } = await requireSession();
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("notifications")
      .select("id, type, payload, created_at")
      .eq("user_id", user.id)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) throw new Error(error.message);
    return data ?? [];
  });
}

export async function markNotificationRead(notificationId: string) {
  return safeAction(async () => {
    const { user } = await requireSession();
    const supabase = await createServerClient();
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId)
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);
    return { success: true };
  });
}
