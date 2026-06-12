"use server";

import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSuperAdmin } from "@/lib/auth/role";
import { redirect } from "next/navigation";

const IMPERSONATE_COOKIE = "impersonate_user_id";

export async function impersonateUser(userId: string) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !(await isSuperAdmin(user.id))) {
    throw new Error("Unauthorized");
  }

  // Verify target user exists
  const adminClient = createAdminClient();
  const { data: target } = await adminClient
    .from("profiles")
    .select("id, email, display_name")
    .eq("id", userId)
    .maybeSingle();

  if (!target) {
    throw new Error("User not found");
  }

  // Set impersonation cookie
  const cookieStore = await cookies();
  cookieStore.set(IMPERSONATE_COOKIE, userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 4, // 4 hours
    path: "/",
  });

  redirect("/dashboard");
}

export async function stopImpersonating() {
  const cookieStore = await cookies();
  cookieStore.delete(IMPERSONATE_COOKIE);
  redirect("/admin/impersonate");
}

export async function getImpersonationState(): Promise<{
  isImpersonating: boolean;
  targetUser: { id: string; email: string; display_name: string | null } | null;
} | null> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Only super admins can impersonate
  if (!(await isSuperAdmin(user.id))) return null;

  const cookieStore = await cookies();
  const targetId = cookieStore.get(IMPERSONATE_COOKIE)?.value;

  if (!targetId) {
    return { isImpersonating: false, targetUser: null };
  }

  const adminClient = createAdminClient();
  const { data: target } = await adminClient
    .from("profiles")
    .select("id, email, display_name")
    .eq("id", targetId)
    .maybeSingle();

  return {
    isImpersonating: !!target,
    targetUser: target ?? null,
  };
}

/**
 * Get the effective user ID for operations.
 * When impersonating, returns the target user's ID.
 * Use with caution — only in contexts where RLS is handled properly.
 */
export async function getEffectiveUserId(): Promise<string | null> {
  const state = await getImpersonationState();
  if (state?.isImpersonating && state.targetUser) {
    return state.targetUser.id;
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}
